#!/usr/bin/env python3
"""
Whisper Confidence Scorer

Uses the fine-tuned Whisper model to validate Deepgram transcriptions
and assign per-word confidence scores.

How it works:
1. Reads Deepgram transcript JSON (words + timestamps) from participant_transcripts/
2. Runs fine-tuned Whisper on the same participant WAV file
3. Aligns Deepgram words with Whisper words using sequence matching
4. Words both models agree on  → high confidence (0.92)
   Words the models disagree on → low confidence (0.45)  ← likely mispronounced
5. Overwrites confidence scores in the participant JSON files
   (Deepgram timestamps are always preserved)

This gives us the best of both:
  - Deepgram  : accurate word boundaries and timestamps
  - Whisper   : accent-aware recognition for reliable confidence scoring

Usage:
    python whisper_confidence_scorer.py <meeting_folder>
    python whisper_confidence_scorer.py meet_abc123
"""

import json
import sys
import os
import io
import re
from pathlib import Path
from difflib import SequenceMatcher
from typing import List, Dict, Optional

# Fix encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Confidence values assigned after alignment
CONF_AGREE    = 0.80   
CONF_DISAGREE = 0.70   
CONF_UNKNOWN  = 0.50   


def _normalize(word: str) -> str:
    """Lowercase and strip punctuation for word comparison."""
    return re.sub(r'[^\w]', '', word.lower().strip())


def align_whisper_to_deepgram(
    deepgram_words: List[Dict],
    whisper_words: List[str]
) -> List[float]:
    """
    Align Whisper word list to Deepgram word list using SequenceMatcher.

    Returns one confidence float per Deepgram word:
      - 0.92  if Deepgram word == Whisper word at that position  (agree)
      - 0.45  if Deepgram word != Whisper word at that position  (disagree)
      - 0.50  if Whisper has no aligned word for this position   (unknown)
    """
    dg_norm = [_normalize(w.get('word', '')) for w in deepgram_words]
    wh_norm = [_normalize(w) for w in whisper_words]

    scores = [CONF_UNKNOWN] * len(deepgram_words)

    matcher = SequenceMatcher(None, dg_norm, wh_norm, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            # Both models produced the same word → high confidence
            for idx in range(i1, i2):
                scores[idx] = CONF_AGREE
        elif tag == 'replace':
            # Models disagree on these words → low confidence (likely mispronounced)
            for idx in range(i1, i2):
                scores[idx] = CONF_DISAGREE
        elif tag == 'delete':
            # Deepgram produced a word Whisper did not → uncertain
            for idx in range(i1, i2):
                scores[idx] = CONF_UNKNOWN
        # 'insert': extra Whisper words with no Deepgram match — skip

    return scores


def score_participant(
    participant_json_path: Path,
    participant_wav_path: Optional[Path],
    transcriber
) -> int:
    """
    Score one participant's words and update their JSON file in-place.

    - Reads:  participant_transcripts/<email>.json  (Deepgram output)
    - Writes: same file with updated 'confidence' fields from Whisper alignment
    - All timestamps (start, end) from Deepgram are preserved unchanged.

    Returns number of words scored.
    """
    if not participant_json_path.exists():
        print(f"  [!] JSON not found: {participant_json_path}")
        return 0

    with open(participant_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    deepgram_words = data.get('words', [])
    if not deepgram_words:
        print(f"  [!] No words in {participant_json_path.name}, skipping")
        return 0

    whisper_tokens: List[str] = []

    if participant_wav_path and participant_wav_path.exists():
        print(f"  Running Whisper on: {participant_wav_path.name}")
        result = transcriber.transcribe(str(participant_wav_path))

        if 'error' not in result:
            if result.get('words'):
                # Use word-level output if available
                whisper_tokens = [w['word'] for w in result['words']]
            elif result.get('transcript'):
                # Fall back to splitting the plain transcript text
                whisper_tokens = result['transcript'].split()

        if whisper_tokens:
            print(f"  Whisper: {len(whisper_tokens)} words  |  "
                  f"Deepgram: {len(deepgram_words)} words")
        else:
            print(f"  [!] Whisper returned no output — using neutral scores")
    else:
        print(f"  [!] WAV not found for '{participant_json_path.stem}' "
              f"— using neutral scores")

    # Build confidence list from alignment (or fall back to neutral)
    if whisper_tokens:
        scores = align_whisper_to_deepgram(deepgram_words, whisper_tokens)
    else:
        # Keep Deepgram confidence if it exists, else neutral
        scores = [w.get('confidence', CONF_UNKNOWN) for w in deepgram_words]

    # Write scores back — timestamps and all other fields are untouched
    for word_entry, new_conf in zip(deepgram_words, scores):
        word_entry['confidence'] = round(new_conf, 4)
        word_entry['confidence_source'] = 'whisper_finetuned'

    data['words'] = deepgram_words
    data['confidence_scoring'] = {
        'method':      'deepgram_whisper_alignment',
        'whisper_model': 'whisper-small-finetuned-nptel',
        'description': (
            'Timestamps from Deepgram. Confidence scores derived from '
            'word-level agreement between Deepgram and fine-tuned Whisper.'
        ),
    }

    with open(participant_json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    high = sum(1 for s in scores if s >= 0.80)
    low  = sum(1 for s in scores if s <  0.80)
    print(f"  Scored {len(scores)} words: {high} high-confidence, {low} low-confidence")
    return len(scores)


def score_meeting(meeting_folder: str) -> bool:
    """
    Score all participants in a meeting folder.

    Args:
        meeting_folder: folder name, e.g. 'meet_abc123'
                        (relative to cwd = mispronunciation-detection-system)
    Returns:
        True on success, False on failure.
    """
    meeting_path = Path(meeting_folder)

    if not meeting_path.exists():
        print(f"[ERROR] Meeting folder not found: {meeting_folder}")
        return False

    participant_dir = meeting_path / 'participant_transcripts'
    if not participant_dir.exists():
        print(f"[ERROR] participant_transcripts/ not found inside {meeting_folder}")
        print("        Run transcribe.py first (Step 1) before running this scorer.")
        return False

    print(f"\n{'='*60}")
    print(f"WHISPER CONFIDENCE SCORING")
    print(f"{'='*60}")
    print(f"Meeting : {meeting_folder}")
    print(f"Method  : Deepgram timestamps + Whisper agreement confidence")
    print(f"{'='*60}")

    # Load fine-tuned Whisper model once — shared across all participants
    try:
        from whisper_finetuned_transcribe import FineTunedWhisperTranscriber
        transcriber = FineTunedWhisperTranscriber()
        if not transcriber.load_model():
            print("[ERROR] Failed to load Whisper model — check torch/transformers install.")
            return False
    except ImportError as e:
        print(f"[ERROR] Could not import FineTunedWhisperTranscriber: {e}")
        return False

    # Find participant JSON files — skip already-generated analysis files
    skip_keywords = ['mispronunciation', 'pronunciation', 'summary', 'mfa', 'confidence_pronunciation']
    json_files = [
        f for f in participant_dir.glob('*.json')
        if not any(kw in f.stem for kw in skip_keywords)
    ]

    if not json_files:
        print("[ERROR] No participant JSON files found in participant_transcripts/")
        return False

    print(f"\nParticipants found: {len(json_files)}\n")

    total_words = 0
    for json_file in sorted(json_files):
        participant = json_file.stem   # e.g. 'user1@gmail.com'
        print(f"{'─'*50}")
        print(f"Participant: {participant}")

        # Locate the converted WAV file in the meeting root
        # Deepgram named it: meet_abc123_<socketId>_<participant>_converted.wav
        # Email @ and . become _ in the filename
        email_as_path = participant.replace('@', '_').replace('.', '_')
        wav_candidates = list(meeting_path.glob(f"*{email_as_path}*_converted.wav"))

        if not wav_candidates:
            # Try matching by the local-part of the email only
            local_part = participant.split('@')[0].lower()
            wav_candidates = [
                w for w in meeting_path.glob('*_converted.wav')
                if local_part in w.name.lower()
            ]

        wav_path = wav_candidates[0] if wav_candidates else None
        if wav_path:
            print(f"  WAV: {wav_path.name}")
        else:
            print(f"  WAV: not found (neutral scores will be used)")

        n = score_participant(json_file, wav_path, transcriber)
        total_words += n

    print(f"\n{'='*60}")
    print(f"SCORING COMPLETE")
    print(f"Total words scored: {total_words}")
    print(f"{'='*60}\n")
    return True


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Assign Whisper-based confidence scores to Deepgram transcripts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python whisper_confidence_scorer.py meet_abc123"
    )
    parser.add_argument('meeting_folder', help='Meeting folder to score')
    args = parser.parse_args()

    success = score_meeting(args.meeting_folder)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
