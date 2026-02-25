#!/usr/bin/env python3
"""
Sync Global Transcript Corrections to Individual Participant Files

This script takes the corrected global transcript (source of truth) and propagates 
corrections back to individual participant JSON and TXT files.

The global transcript is considered the authoritative source. This script ensures
all individual participant files match exactly what's in the global transcript.

Key features:
- Global transcript is the single source of truth
- Updates BOTH JSON and TXT files
- Preserves word-level metadata (timestamps, confidence scores) where possible
- Universal - works for any meeting folder

Usage:
    python sync_corrections.py <meeting_folder>
    python sync_corrections.py projectmeeting1
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from difflib import SequenceMatcher


def parse_global_transcript(filepath: Path) -> Dict[str, str]:
    """
    Parse the speaker-attributed global transcript.
    Returns dict mapping speaker name to their FULL combined text.
    """
    speaker_texts = {}
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern: "Speaker: text" 
    pattern = r'^([A-Za-z]+):\s*(.+)$'
    
    for line in content.strip().split('\n'):
        line = line.strip()
        if not line:
            continue
            
        match = re.match(pattern, line)
        if match:
            speaker = match.group(1)
            utterance = match.group(2).strip()
            
            if speaker not in speaker_texts:
                speaker_texts[speaker] = []
            speaker_texts[speaker].append(utterance)
    
    # Combine all utterances for each speaker
    return {speaker: ' '.join(utterances) for speaker, utterances in speaker_texts.items()}


def normalize_word(word: str) -> str:
    """Normalize a single word for comparison (lowercase, no punctuation)."""
    return re.sub(r'[^\w]', '', word.lower())


def tokenize_text(text: str) -> List[str]:
    """Split text into words, preserving the original form."""
    return re.findall(r'\S+', text)


def align_words(original_words: List[str], corrected_words: List[str]) -> List[Tuple[Optional[int], str, str]]:
    """
    Align original words with corrected words using sequence matching.
    
    Returns list of (original_index, original_word, corrected_word) tuples.
    """
    # Normalize for comparison
    orig_normalized = [normalize_word(w) for w in original_words]
    corr_normalized = [normalize_word(w) for w in corrected_words]
    
    matcher = SequenceMatcher(None, orig_normalized, corr_normalized, autojunk=False)
    
    alignments = []
    
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            # Words match - use corrected version (preserves global's formatting)
            for k in range(i2 - i1):
                corr_word = corrected_words[j1 + k]
                # Clean punctuation for word storage
                corr_clean = re.sub(r'^[^\w]+|[^\w]+$', '', corr_word)
                alignments.append((i1 + k, original_words[i1 + k], corr_clean if corr_clean else corr_word))
                
        elif tag == 'replace':
            # Words differ - use corrected version
            orig_count = i2 - i1
            corr_count = j2 - j1
            
            for k in range(max(orig_count, corr_count)):
                if k < orig_count and k < corr_count:
                    corr_word = corrected_words[j1 + k]
                    corr_clean = re.sub(r'^[^\w]+|[^\w]+$', '', corr_word)
                    alignments.append((i1 + k, original_words[i1 + k], corr_clean if corr_clean else corr_word))
                elif k < orig_count:
                    # Extra original word - mark for deletion
                    alignments.append((i1 + k, original_words[i1 + k], ''))
                
        elif tag == 'delete':
            # Original has extra words - mark for deletion
            for k in range(i2 - i1):
                alignments.append((i1 + k, original_words[i1 + k], ''))
                
        elif tag == 'insert':
            # Corrected has new words - can't add without timestamps
            pass
    
    return alignments


def update_participant_files(
    participant_json: Path,
    participant_txt: Path,
    corrected_text: str,
    verbose: bool = True,
    dry_run: bool = False
) -> Tuple[int, List[Tuple[str, str]]]:
    """
    Update a participant's JSON and TXT files with corrections from global transcript.
    
    The global transcript text is the source of truth.
    
    Args:
        participant_json: Path to the participant's JSON file
        participant_txt: Path to the participant's TXT file
        corrected_text: The corrected text from global transcript (for this speaker)
        verbose: Print detailed correction info
        dry_run: If True, don't write changes, just report
    
    Returns:
        Tuple of (corrections_count, list of (original, corrected) pairs)
    """
    corrections_made = 0
    correction_pairs = []
    
    # Tokenize the corrected text from global
    corrected_words = tokenize_text(corrected_text)
    
    # ========== UPDATE JSON FILE ==========
    if participant_json.exists():
        with open(participant_json, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        words_list = data.get('words', [])
        
        if words_list:
            # Get original words from JSON
            original_words = [w['word'] for w in words_list]
            
            if verbose:
                print(f"  JSON: {len(original_words)} words -> {len(corrected_words)} words")
            
            # Get alignment between original and corrected
            alignments = align_words(original_words, corrected_words)
            
            words_to_keep = []
            
            for idx, orig, corrected in alignments:
                if idx is None or idx >= len(words_list):
                    continue
                    
                word_entry = words_list[idx].copy()
                
                # Skip if marked for deletion
                if not corrected:
                    if verbose:
                        print(f"    Deletion: '{orig}'")
                    continue
                
                # Check if correction needed
                orig_norm = normalize_word(orig)
                corr_norm = normalize_word(corrected)
                
                if orig_norm != corr_norm:
                    if verbose:
                        print(f"    Correction: '{orig}' -> '{corrected}'")
                    
                    word_entry['original_word'] = orig
                    word_entry['word'] = corrected
                    word_entry['corrected'] = True
                    
                    corrections_made += 1
                    correction_pairs.append((orig, corrected))
                else:
                    # Even if normalized same, use the global's version
                    word_entry['word'] = corrected
                
                words_to_keep.append(word_entry)
            
            if not dry_run:
                # Update the JSON data
                data['words'] = words_to_keep
                data['transcript'] = ' '.join(w['word'] for w in words_to_keep)
                data['sync_metadata'] = {
                    'corrections_applied': True,
                    'corrections_count': corrections_made,
                    'source': 'global_transcript'
                }
                
                with open(participant_json, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
    
    # ========== UPDATE TXT FILE ==========
    txt_corrections = 0
    if participant_txt.exists():
        with open(participant_txt, 'r', encoding='utf-8') as f:
            original_txt_content = f.read()
        
        # Tokenize original TXT content for comparison
        orig_txt_words = tokenize_text(original_txt_content)
        
        # Compare TXT words to corrected words from global
        min_len = min(len(orig_txt_words), len(corrected_words))
        for i in range(min_len):
            orig = orig_txt_words[i]
            corr = corrected_words[i]
            corr_clean = re.sub(r'^[^\w]+|[^\w]+$', '', corr)
            if normalize_word(orig) != normalize_word(corr_clean):
                if verbose:
                    print(f"    TXT fix: '{orig}' -> '{corr_clean}'")
                txt_corrections += 1
                if (orig, corr_clean) not in correction_pairs:
                    correction_pairs.append((orig, corr_clean))
        
        # Create new TXT content from global transcript
        new_txt_content = format_text_for_display(corrected_text)
        
        if not dry_run:
            with open(participant_txt, 'w', encoding='utf-8') as f:
                f.write(new_txt_content)
        
        if verbose:
            if txt_corrections > 0:
                print(f"  TXT: {txt_corrections} corrections applied")
            else:
                print(f"  TXT: Synced")
    
    return corrections_made + txt_corrections, correction_pairs


def format_text_for_display(text: str) -> str:
    """
    Format text for TXT file display - split into sentences.
    """
    # Add newlines after sentence-ending punctuation
    text = re.sub(r'([.!?])\s+', r'\1\n', text)
    # Add newlines after commas in long sentences (for readability)
    lines = text.split('\n')
    formatted_lines = []
    for line in lines:
        line = line.strip()
        if line:
            formatted_lines.append(line)
    return '\n'.join(formatted_lines) + '\n'


def sync_corrections(meeting_folder: Path, verbose: bool = True, dry_run: bool = False):
    """
    Main function to sync corrections from global transcript to participant files.
    
    The global transcript is the SINGLE SOURCE OF TRUTH.
    This updates both JSON and TXT files for each participant.
    
    Args:
        meeting_folder: Path to meeting folder
        verbose: Print detailed output
        dry_run: If True, report changes without applying them
    """
    global_transcript = meeting_folder / "global_transcript" / f"{meeting_folder.name}_speaker_attributed.txt"
    participant_dir = meeting_folder / "participant_transcripts"
    
    if not global_transcript.exists():
        print(f"Error: Global transcript not found: {global_transcript}")
        return None
    
    if not participant_dir.exists():
        print(f"Error: Participant transcripts directory not found: {participant_dir}")
        return None
    
    print(f"\n{'='*70}")
    print(f"SYNCING CORRECTIONS FROM GLOBAL TRANSCRIPT")
    print(f"{'='*70}")
    print(f"Source: {global_transcript}")
    print(f"Target: {participant_dir}")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'APPLY CHANGES'}")
    
    # Parse global transcript - get full text per speaker
    speaker_texts = parse_global_transcript(global_transcript)
    print(f"\nFound {len(speaker_texts)} speakers: {', '.join(speaker_texts.keys())}")
    
    total_corrections = 0
    all_corrections = {}
    
    for speaker, corrected_text in speaker_texts.items():
        participant_json = participant_dir / f"{speaker}.json"
        participant_txt = participant_dir / f"{speaker}.txt"
        
        if not participant_json.exists() and not participant_txt.exists():
            print(f"\n⚠ Warning: No files found for speaker '{speaker}'")
            continue
        
        print(f"\n{'─'*50}")
        print(f"Processing: {speaker}")
        print(f"{'─'*50}")
        
        corrections, pairs = update_participant_files(
            participant_json,
            participant_txt,
            corrected_text,
            verbose=verbose,
            dry_run=dry_run
        )
        
        total_corrections += corrections
        all_corrections[speaker] = pairs
        
        if corrections > 0:
            print(f"  ✓ Corrections {'would be ' if dry_run else ''}applied: {corrections}")
        else:
            print(f"  ✓ Files synced (no word corrections needed)")
    
    print(f"\n{'='*70}")
    print(f"SYNC {'REPORT' if dry_run else 'COMPLETE'}")
    print(f"{'='*70}")
    print(f"Total corrections {'to apply' if dry_run else 'made'}: {total_corrections}")
    
    if dry_run and total_corrections > 0:
        print(f"\nRun without --dry-run to apply these corrections.")
    
    return all_corrections
    

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Sync corrections from global transcript to participant files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python sync_corrections.py projectmeeting1              # Apply corrections
  python sync_corrections.py projectmeeting1 --dry-run    # Preview changes only
  python sync_corrections.py projectmeeting1 -q           # Quiet mode
        """
    )
    parser.add_argument('meeting_folder', help='Path to meeting folder')
    parser.add_argument('-q', '--quiet', action='store_true', 
                        help='Suppress detailed correction output')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview changes without applying them')
    
    args = parser.parse_args()
    
    meeting_path = Path(args.meeting_folder)
    if not meeting_path.is_absolute():
        meeting_path = Path(__file__).parent / args.meeting_folder
    
    sync_corrections(meeting_path, verbose=not args.quiet, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
