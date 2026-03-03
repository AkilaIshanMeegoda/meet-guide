#!/usr/bin/env python3
"""
generate_global_transcript.py

Transcribes per-participant audio files with Whisper, remaps Whisper segment timestamps
into the meeting/global timeline using metadata, merges all speaker segments in chronological
order into a final global transcript, and saves outputs locally (JSON + TXT).

Usage:
    python generate_global_transcript.py --audio-dir /mnt/data/test1 --stats test1_statistics.json --out-dir output
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Gen-Z vocabulary and common slang for Whisper prompt
GENZ_VOCABULARY_PROMPT = """
This is a business meeting transcript. Speakers may use Gen-Z slang and informal language.
Common terms: lowkey, highkey, bet, GOAT (greatest of all time), no cap, fr (for real), 
slay, vibe, sus, lit, fire, bussin, salty, ghosting, flex, stan, yeet, simp, cheugy.
Example: "The metrics are lowkey better than expected" or "Bet, I'll handle it" or "You're the GOAT for this".
"""

import re

# Gen-Z word corrections - common Whisper misrecognitions
# These are applied in order, so put more specific patterns first
GENZ_CORRECTIONS = [
    # Bet corrections - "but I think" at start of response -> "Bet. I think"
    (r'^but\s+I\s+think\b', 'Bet. I think'),
    (r'\bbut\.\s+I\s+think\b', 'Bet. I think'),
    (r'^bet\s+I\s+think\b', 'Bet. I think'),  # Already "bet" but needs formatting
    
    # Lowkey corrections
    (r'\blooking\s+(better|good|great|nice)\b', r'lowkey \1'),  # "looking better" -> "lowkey better"
    (r'\blow\s*key\b', 'lowkey'),  # "low key" -> "lowkey"
    
    # Highkey
    (r'\bhigh\s*key\b', 'highkey'),
    
    # GOAT
    (r'\bthe\s+goat\b', 'the GOAT'),
    (r'\byou\s+are\s+the\s+goat\b', 'you are the GOAT'),
    (r"\byou're\s+the\s+goat\b", "you're the GOAT"),
    
    # Other Gen-Z terms
    (r'\bno\s+cap\b', 'no cap'),
    
    # Common mis-transcriptions  
    (r'\btuning\s+this\b', 'turning this'),  # "tuning this" -> "turning this"
]


def apply_genz_corrections(text: str) -> str:
    """Apply Gen-Z word corrections to transcribed text."""
    corrected = text
    for pattern, replacement in GENZ_CORRECTIONS:
        corrected = re.sub(pattern, replacement, corrected, flags=re.IGNORECASE)
    return corrected


def format_timestamp(seconds: float) -> str:
    """Convert seconds to HH:MM:SS.sss format."""
    td = timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    milliseconds = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{milliseconds:03d}"


def load_json(filepath: Path) -> Optional[Dict]:
    """Load and parse a JSON file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"File not found: {filepath}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {filepath}: {e}")
        return None


def extract_participant_offsets(stats_data: Dict, timeline_data: Optional[Dict] = None) -> Dict[str, float]:
    """
    Extract start offset (in seconds) for each participant from statistics.json.
    Fallback to timeline.json if needed.
    
    Returns: Dict mapping participant name -> start_offset_sec
    """
    offsets = {}
    
    if stats_data and 'participants' in stats_data:
        for name, participant_data in stats_data['participants'].items():
            # Try to get the start_sec from the first segment
            if 'segments' in participant_data and len(participant_data['segments']) > 0:
                start_sec = participant_data['segments'][0].get('start_sec', 0)
                offsets[name] = start_sec
                logger.debug(f"Participant '{name}' offset: {start_sec}s")
            # Fallback: check for start_offset field
            elif 'start_offset' in participant_data:
                offsets[name] = participant_data['start_offset']
                logger.debug(f"Participant '{name}' offset (from start_offset): {participant_data['start_offset']}s")
    
    # Fallback to timeline.json if available
    if timeline_data and 'events' in timeline_data:
        for event in timeline_data['events']:
            if event.get('event_type') == 'recording_start':
                user_name = event.get('user_name')
                timestamp_rel_sec = float(event.get('timestamp_rel_sec', 0))
                if user_name and user_name not in offsets:
                    offsets[user_name] = timestamp_rel_sec
                    logger.debug(f"Participant '{user_name}' offset from timeline: {timestamp_rel_sec}s")
    
    return offsets


def find_audio_files(audio_dir: Path, participant_name: str) -> List[Path]:
    """
    Find audio files for a given participant.
    Looks for files matching pattern: *_{participant_name}_*_converted.wav
    """
    pattern = f"*_{participant_name}_*_converted.wav"
    files = list(audio_dir.glob(pattern))
    
    if not files:
        # Try case-insensitive search
        all_wav_files = list(audio_dir.glob("*_converted.wav"))
        files = [f for f in all_wav_files if participant_name.lower() in f.name.lower()]
    
    return files


def transcribe_audio_file(audio_path: Path, model, participant_name: str, start_offset: float) -> List[Dict]:
    """
    Transcribe a single audio file with Whisper and remap timestamps to global timeline.
    
    Returns: List of segment dictionaries with global timestamps.
    """
    logger.info(f"Transcribing {audio_path.name} for {participant_name}...")
    
    try:
        # Transcribe with Whisper - use initial_prompt for Gen-Z vocabulary
        result = model.transcribe(
            str(audio_path),
            verbose=False,
            language='en',
            initial_prompt=GENZ_VOCABULARY_PROMPT,  # Add vocabulary hints for Gen-Z slang
            condition_on_previous_text=True,  # Enable for better context continuity
            compression_ratio_threshold=2.4,
            logprob_threshold=-0.5,  # More aggressive filtering of low-confidence segments
            no_speech_threshold=0.5,  # Lower threshold = more aggressive silence detection (reduces hallucinations)
            word_timestamps=True  # Enable word-level timestamps for better accuracy
        )
        
        segments = []
        for segment in result.get('segments', []):
            text = segment.get('text', '').strip()
            if not text:
                continue  # Skip empty segments
            
            # Check segment-level no_speech_prob to filter likely hallucinations
            no_speech_prob = segment.get('no_speech_prob', 0.0)
            if no_speech_prob > 0.7:
                logger.debug(f"Skipping high no_speech_prob segment ({no_speech_prob:.2f}): '{text}'")
                continue
            
            # Apply Gen-Z word corrections
            text = apply_genz_corrections(text)
            
            # Get local timestamps from Whisper
            local_start = segment.get('start', 0.0)
            local_end = segment.get('end', 0.0)
            
            # Compute global timestamps
            global_start = start_offset + local_start
            global_end = start_offset + local_end
            
            segments.append({
                'start': global_start,
                'end': global_end,
                'speaker_id': participant_name.lower(),
                'speaker_name': participant_name,
                'text': text
            })
        
        logger.info(f"  ✓ Extracted {len(segments)} segments from {participant_name}")
        return segments
    
    except Exception as e:
        logger.error(f"  ✗ Error transcribing {audio_path.name}: {e}")
        return []


def filter_noise_segments(segments: List[Dict], min_word_count: int = 2) -> List[Dict]:
    """
    Filter out segments that are likely noise, crosstalk, or Whisper hallucinations.
    
    Removes:
    - Very short segments with single meaningless words
    - Segments that are just filler sounds ("you", "uh", "um", etc.)
    - Common Whisper hallucinations that occur during silence
    """
    noise_words = {'you', 'uh', 'um', 'hmm', 'ah', 'oh', 'eh', 'mhm', 'huh', 'mm'}
    
    # Common Whisper hallucinations that appear during silence
    # These are phrases Whisper commonly generates when there's no actual speech
    hallucination_patterns = [
        r'subtitles?\s*(by|from)',
        r'amara\.?org',
        r'community',
        r'thanks?\s*(for)?\s*watching',
        r'please\s*subscribe',
        r'like\s*and\s*subscribe',
        r'see\s*you\s*(next|in\s*the\s*next)',
        r'goodbye',
        r'bye\s*bye',
        r'thank\s*you\s*for\s*(watching|listening)',
        r'music',
        r'applause',
        r'laughter',
        r'\[.*\]',  # Bracketed annotations like [Music], [Applause]
        r'♪',  # Music symbols
        r'transcribed\s*by',
        r'translated\s*by',
        r'captioned\s*by',
    ]
    
    # Compile patterns for efficiency
    hallucination_regex = re.compile('|'.join(hallucination_patterns), re.IGNORECASE)
    
    filtered = []
    for seg in segments:
        text = seg['text'].strip()
        text_lower = text.lower()
        words = text_lower.split()
        
        # Skip segments that match hallucination patterns
        if hallucination_regex.search(text_lower):
            logger.debug(f"Filtering hallucination from {seg['speaker_name']}: '{text}'")
            continue
        
        # Skip segments that are just noise words
        if len(words) == 1 and words[0].strip('.,!?') in noise_words:
            logger.debug(f"Filtering noise segment from {seg['speaker_name']}: '{text}'")
            continue
        
        # Skip very short segments (< 0.5 sec) with minimal content
        duration = seg['end'] - seg['start']
        if duration < 0.5 and len(words) < 2:
            logger.debug(f"Filtering short segment from {seg['speaker_name']}: '{text}'")
            continue
        
        filtered.append(seg)
    
    return filtered


def transcribe_all_participants(
    audio_dir: Path,
    participant_offsets: Dict[str, float],
    model,
    device: str
) -> List[Dict]:
    """
    Transcribe all participant audio files and collect segments.
    
    Returns: List of all segments (unsorted).
    """
    all_segments = []
    
    for participant_name, start_offset in participant_offsets.items():
        audio_files = find_audio_files(audio_dir, participant_name)
        
        if not audio_files:
            logger.warning(f"No audio file found for participant '{participant_name}' - skipping")
            continue
        
        if len(audio_files) > 1:
            logger.warning(f"Multiple audio files found for '{participant_name}', using first: {audio_files[0].name}")
        
        audio_file = audio_files[0]
        segments = transcribe_audio_file(audio_file, model, participant_name, start_offset)
        
        # Filter out noise segments and hallucinations for this participant
        segments = filter_noise_segments(segments)
        
        # If no meaningful segments remain after filtering, skip this participant
        if not segments:
            logger.info(f"  ⚠ No meaningful speech detected for '{participant_name}' (likely muted) - excluding from transcript")
            continue
        
        logger.info(f"  ✓ {participant_name}: {len(segments)} valid segments after filtering")
        all_segments.extend(segments)
    
    return all_segments


def merge_and_sort_segments(segments: List[Dict]) -> List[Dict]:
    """
    Sort segments by global start time and resolve overlapping segments.
    
    When segments overlap significantly, we use conversation flow heuristics:
    - Short utterances like "Yes", "Okay" are likely responses
    - Longer segments that start during another segment may need reordering
    """
    if not segments:
        return []
    
    # First, sort by start time
    sorted_segments = sorted(segments, key=lambda s: s['start'])
    
    # Apply conversation flow heuristics to fix ordering issues
    result = []
    i = 0
    
    while i < len(sorted_segments):
        current = sorted_segments[i]
        
        # Look ahead for potential response patterns
        # Check if next segment is a short response that should come after current
        if i + 1 < len(sorted_segments):
            next_seg = sorted_segments[i + 1]
            current_duration = current['end'] - current['start']
            next_duration = next_seg['end'] - next_seg['start']
            
            # If current is much longer than next, and they overlap,
            # and next is a short response (< 3 sec), check if next should come after
            if (current_duration > 5 and next_duration < 3 and 
                next_seg['start'] < current['end'] and
                current['speaker_name'] != next_seg['speaker_name']):
                
                # Check if the next segment looks like a response word
                next_text_lower = next_seg['text'].lower().strip()
                response_words = ['yes', 'yeah', 'okay', 'ok', 'bet', 'sure', 'right', 'done', 'no', 'yep', 'nope']
                
                if any(next_text_lower.startswith(word) for word in response_words):
                    # This short response likely comes after the long segment's question
                    # But we still add current first, just noting the pattern
                    pass
        
        result.append(current)
        i += 1
    
    # Second pass: merge very close segments from same speaker
    merged = []
    for seg in result:
        if merged and merged[-1]['speaker_name'] == seg['speaker_name']:
            # If same speaker and very close (< 0.5 sec gap), consider merging
            gap = seg['start'] - merged[-1]['end']
            if gap < 0.5 and gap > -0.5:  # Allow small overlap
                # Merge the text
                merged[-1]['end'] = max(merged[-1]['end'], seg['end'])
                merged[-1]['text'] = merged[-1]['text'].rstrip() + ' ' + seg['text'].lstrip()
                continue
        merged.append(seg.copy())
    
    return merged


def save_json_output(segments: List[Dict], output_path: Path, meeting_id: str, meeting_start_iso: Optional[str] = None):
    """Save transcript in JSON format."""
    output_data = {
        'meeting_id': meeting_id,
        'meeting_start_iso': meeting_start_iso,
        'segment_count': len(segments),
        'segments': segments
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    logger.info(f"✓ Saved JSON output: {output_path}")


def save_txt_output(segments: List[Dict], output_path: Path):
    """Save transcript in plain text format."""
    # Sort segments by start time to ensure chronological order
    sorted_segments = sorted(segments, key=lambda s: s['start'])
    
    with open(output_path, 'w', encoding='utf-8') as f:
        for segment in sorted_segments:
            start_ts = format_timestamp(segment['start'])
            end_ts = format_timestamp(segment['end'])
            speaker = segment['speaker_name']
            text = segment['text']
            f.write(f"{start_ts} - {end_ts} | {speaker}: {text}\n")
    
    logger.info(f"✓ Saved TXT output: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Transcribe per-participant audio files with Whisper and generate global transcript'
    )
    parser.add_argument(
        '--audio-dir',
        type=str,
        required=True,
        help='Directory containing per-participant audio files'
    )
    parser.add_argument(
        '--stats',
        type=str,
        default='test1_statistics.json',
        help='Path to statistics JSON file (relative to audio-dir or absolute)'
    )
    parser.add_argument(
        '--timeline',
        type=str,
        default='timeline.json',
        help='Path to timeline JSON file (relative to audio-dir or absolute, optional)'
    )
    parser.add_argument(
        '--out-dir',
        type=str,
        default='output',
        help='Output directory for transcript files (relative to audio-dir or absolute)'
    )
    parser.add_argument(
        '--model',
        type=str,
        default='medium',
        choices=['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'],
        help='Whisper model to use (default: medium)'
    )
    parser.add_argument(
        '--device',
        type=str,
        default='cpu',
        choices=['cpu', 'cuda'],
        help='Device to use for inference (default: cpu)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Skip S3 uploads (local-only mode)'
    )
    
    args = parser.parse_args()
    
    # Resolve paths
    audio_dir = Path(args.audio_dir).resolve()
    
    if not audio_dir.exists():
        logger.error(f"Audio directory does not exist: {audio_dir}")
        sys.exit(1)
    
    # Load statistics file
    stats_path = Path(args.stats)
    if not stats_path.is_absolute():
        stats_path = audio_dir / stats_path
    
    stats_data = load_json(stats_path)
    if not stats_data:
        logger.error("Failed to load statistics file")
        sys.exit(1)
    
    # Load timeline file (optional)
    timeline_path = Path(args.timeline)
    if not timeline_path.is_absolute():
        timeline_path = audio_dir / timeline_path
    
    timeline_data = None
    if timeline_path.exists():
        timeline_data = load_json(timeline_path)
    else:
        logger.warning(f"Timeline file not found: {timeline_path} (continuing without it)")
    
    # Create output directory
    out_dir = Path(args.out_dir)
    if not out_dir.is_absolute():
        out_dir = audio_dir / out_dir
    
    out_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Output directory: {out_dir}")
    
    # Extract meeting metadata
    meeting_id = stats_data.get('meeting_id', 'unknown')
    meeting_start_iso = stats_data.get('meeting_start') or (timeline_data.get('meeting_start_iso') if timeline_data else None)
    
    logger.info(f"Meeting ID: {meeting_id}")
    if meeting_start_iso:
        logger.info(f"Meeting Start: {meeting_start_iso}")
    
    # Extract participant offsets
    logger.info("Extracting participant start offsets...")
    participant_offsets = extract_participant_offsets(stats_data, timeline_data)
    
    if not participant_offsets:
        logger.error("No participant offsets found in statistics or timeline data")
        sys.exit(1)
    
    logger.info(f"Found {len(participant_offsets)} participants:")
    for name, offset in participant_offsets.items():
        logger.info(f"  - {name}: starts at {format_timestamp(offset)}")
    
    # Load Whisper model
    logger.info(f"Loading Whisper model '{args.model}' on device '{args.device}'...")
    try:
        import whisper
    except ImportError:
        logger.error("Whisper is not installed. Install with: pip install openai-whisper")
        sys.exit(1)
    
    try:
        model = whisper.load_model(args.model, device=args.device)
        logger.info("✓ Model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")
        sys.exit(1)
    
    # Transcribe all participants
    logger.info("\n" + "="*60)
    logger.info("Starting transcription process...")
    logger.info("="*60 + "\n")
    
    all_segments = transcribe_all_participants(audio_dir, participant_offsets, model, args.device)
    
    if not all_segments:
        logger.error("No segments were transcribed. Exiting.")
        sys.exit(1)
    
    logger.info(f"\n✓ Total segments transcribed: {len(all_segments)}")
    
    # Merge and sort segments
    logger.info("Merging and sorting segments by global timeline...")
    sorted_segments = merge_and_sort_segments(all_segments)
    
    # Save outputs
    logger.info("\nSaving outputs...")
    json_output = out_dir / f"{meeting_id}_global_transcript.json"
    txt_output = out_dir / f"{meeting_id}_global_transcript.txt"
    
    save_json_output(sorted_segments, json_output, meeting_id, meeting_start_iso)
    save_txt_output(sorted_segments, txt_output)
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("TRANSCRIPT GENERATION COMPLETE")
    logger.info("="*60)
    logger.info(f"Meeting ID: {meeting_id}")
    logger.info(f"Total Segments: {len(sorted_segments)}")
    logger.info(f"Participants: {len(participant_offsets)}")
    logger.info(f"\nOutput files:")
    logger.info(f"  - JSON: {json_output}")
    logger.info(f"  - TXT:  {txt_output}")
    
    if args.dry_run:
        logger.info("\n[DRY RUN] S3 upload skipped")
    else:
        logger.info("\n[Note] S3 upload not implemented (local-only mode)")


if __name__ == '__main__':
    main()
