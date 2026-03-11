import sys
import os
import subprocess
import argparse
import io
from pathlib import Path

# Fix encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Import sync_corrections function
from sync_corrections import sync_corrections


# Dual-model pipeline configuration
# Step 1 : Deepgram API  → transcript text + word-level timestamps
# Step 1b: Fine-tuned Whisper → confidence scores via Deepgram-Whisper word alignment
PIPELINE_CONFIG = {
    "transcription_model": "Deepgram nova-2",
    "confidence_model":    "whisper-small-finetuned-nptel",
    "fine_tuned_path":     "./finetuned_whisper_nptel",
    "dataset":             "NPTEL Indian English Lectures",
    "training_epochs":     3,
    "language":            "en",
    "description": (
        "Deepgram provides accurate word boundaries and timestamps. "
        "Fine-tuned Whisper validates each word and assigns confidence scores "
        "based on agreement between the two models."
    ),
}


def show_model_info():
    """Display dual-model pipeline information."""
    print("\n" + "="*70)
    print("  DUAL-MODEL PRONUNCIATION PIPELINE")
    print("="*70)

    print("\n+" + "-"*68 + "+")
    print("|  STEP 1 — TRANSCRIPTION: Deepgram API                            |")
    print("+" + "-"*68 + "+")
    print("|  * Generates word-level transcript with accurate timestamps       |")
    print("|  * Cloud ASR (nova-2) with speaker diarization                   |")
    print("|  * Transcript text = source of truth for all downstream steps    |")
    print("+" + "-"*68 + "+")

    print("\n+" + "-"*68 + "+")
    print("|  STEP 1b — CONFIDENCE SCORING: Fine-Tuned Whisper                |")
    print("+" + "-"*68 + "+")
    print(f"|  * Model: {PIPELINE_CONFIG['confidence_model']:<57} |")
    print(f"|  * Dataset: {PIPELINE_CONFIG['dataset']:<55} |")
    print(f"|  * Epochs: {PIPELINE_CONFIG['training_epochs']:<56} |")
    print("|  * Aligns Whisper output to Deepgram words via SequenceMatcher   |")
    print("|  * Agree → confidence 0.92 | Disagree → confidence 0.45         |")
    print("+" + "-"*68 + "+")

    print("\n" + "="*70)
    print("  Both models always run. Deepgram timestamps are never modified.")
    print("="*70 + "\n")


def run_command(cmd, description):
    """Run a command and display progress"""
    print(f"\n{'='*60}")
    print(f"{description}")
    print(f"{'='*60}")
    print(f"Running: {' '.join(cmd)}")
    
    # Ensure UTF-8 encoding for subprocesses on Windows
    env = os.environ.copy()
    env['PYTHONIOENCODING'] = 'utf-8'
    
    # On Windows, use CREATE_NO_WINDOW to prevent CMD popups
    kwargs = {}
    if sys.platform == 'win32':
        kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
    
    result = subprocess.run(cmd, capture_output=False, text=True, env=env, **kwargs)
    
    if result.returncode != 0:
        print(f"\n[!] Warning: Command exited with code {result.returncode}")
    else:
        print(f"\n[OK] Completed successfully")
    
    return result.returncode == 0


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Process meeting recordings for pronunciation analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python process_meeting.py projectmeeting1              # Run full dual-model pipeline
  python process_meeting.py --model-info                 # Show pipeline information
        """
    )
    parser.add_argument('meeting_folder', nargs='?', help='Meeting folder to process')
    parser.add_argument('--model-info', action='store_true',
                        help='Show information about the dual-model pipeline')

    return parser.parse_args()


def main():
    args = parse_arguments()

    # Show pipeline info if requested
    if args.model_info:
        show_model_info()
        sys.exit(0)

    if not args.meeting_folder:
        print("Usage: python process_meeting.py <meeting_folder>")
        print("\nExample: python process_meeting.py projectmeeting1")
        print("\nUse --model-info to see the dual-model pipeline details")
        sys.exit(1)

    meeting_folder = args.meeting_folder
    meeting_path = Path(meeting_folder)

    if not meeting_path.exists():
        print(f"Error: Meeting folder '{meeting_folder}' not found")
        sys.exit(1)

    print(f"\n{'#'*60}")
    print(f"PROCESSING MEETING: {meeting_folder}")
    print(f"Pipeline: Deepgram (transcription) + Whisper (confidence)")
    print(f"{'#'*60}")

    # ----------------------------------------------------------------
    # Step 1/4 — Deepgram transcription
    #   Always uses transcribe.py regardless of any flags.
    #   Produces: participant_transcripts/<email>.json  with Deepgram
    #             confidence scores (these will be replaced in Step 1b).
    # ----------------------------------------------------------------
    transcript_folder = meeting_path / "participant_transcripts"
    has_transcripts = transcript_folder.exists() and any(transcript_folder.glob("*.txt"))

    if has_transcripts:
        print(f"\n{'='*60}")
        print("Step 1/4: Transcribing audio with Deepgram API")
        print(f"{'='*60}")
        print("[OK] Transcripts already exist, skipping this step")
        step1 = True
    else:
        step1 = run_command(
            [sys.executable, "transcribe.py", meeting_folder],
            "Step 1/4: Transcribing audio with Deepgram API"
        )

        if not step1:
            print("\n[ERROR] Deepgram transcription failed. Please check the error above.")
            sys.exit(1)

    # ----------------------------------------------------------------
    # Step 2/4 — Sync corrections from global transcript
    # ----------------------------------------------------------------
    global_transcript = meeting_path / "global_transcript" / f"{meeting_folder}_speaker_attributed.txt"
    if global_transcript.exists():
        print(f"\n{'='*60}")
        print("Step 2/4: Syncing corrections from global transcript")
        print(f"{'='*60}")
        try:
            sync_corrections(meeting_path, verbose=False, dry_run=False)
            print("[OK] Corrections synced successfully")
        except Exception as e:
            print(f"[!] Warning: Sync failed - {e}")
    else:
        print(f"\n{'='*60}")
        print("Step 2/4: Syncing corrections from global transcript")
        print(f"{'='*60}")
        print("[!] No global transcript found, skipping sync")

    # ----------------------------------------------------------------
    # Step 2b — Whisper confidence scoring
    #   Runs fine-tuned Whisper on each participant WAV, aligns output
    #   to Deepgram words, and overwrites confidence scores in the JSON.
    #   Deepgram timestamps (start, end) are never modified.
    # ----------------------------------------------------------------
    step2b = run_command(
        [sys.executable, "whisper_confidence_scorer.py", meeting_folder],
        "Step 2b/4: Scoring word confidence with fine-tuned Whisper"
    )

    if not step2b:
        print("\n[!] Whisper confidence scoring had issues. "
              "Deepgram confidence scores will be used as fallback.")

    # ----------------------------------------------------------------
    # Step 3/4 — Phoneme-based pronunciation detection
    #   Uses the Whisper confidence scores written in Step 2b.
    # ----------------------------------------------------------------
    step3 = run_command(
        [sys.executable, "phoneme_pronunciation_detector.py", meeting_folder],
        "Step 3/4: Detecting pronunciation errors (phoneme comparison + Whisper confidence)"
    )

    if not step3:
        print("\n[!] Pronunciation detection had issues, but continuing...")

    # ----------------------------------------------------------------
    # Step 4/4 — Build web-ready summary JSON
    # ----------------------------------------------------------------
    step4 = run_command(
        [sys.executable, "update_pronunciation_summary.py", meeting_folder],
        "Step 4/4: Preparing data for web visualization"
    )

    if not step4:
        print("\n[ERROR] Summary update failed. Please check the error above.")
        sys.exit(1)

    # Final summary
    print(f"\n{'='*60}")
    print("PROCESSING COMPLETE!")
    print(f"{'='*60}")
    print(f"\nMeeting '{meeting_folder}' is ready for visualization.")
    print("\nTo view in browser:")
    print("  1. Run: python web/server.py --port 8900")
    print("  2. Open: http://localhost:8900")
    print(f"  3. Select '{meeting_folder}' from dropdown")
    print("  4. Click 'Load Meeting'\n")


if __name__ == "__main__":
    main()
