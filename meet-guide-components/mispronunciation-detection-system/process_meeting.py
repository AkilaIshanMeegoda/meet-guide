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


# Fine-tuned Whisper model configuration
WHISPER_MODEL_CONFIG = {
    "model_name": "openai/whisper-small",
    "fine_tuned_path": "./finetuned_whisper_nptel",
    "dataset": "NPTEL Indian English Lectures",
    "training_epochs": 3,
    "language": "en",
    "task": "transcribe",
    "optimizations": [
        "Indian English accent adaptation",
        "Technical vocabulary fine-tuning",
        "Low WER on NPTEL test set"
    ]
}


def show_model_info():
    """Display information about available transcription models"""
    print("\n" + "="*70)
    print("  TRANSCRIPTION MODELS AVAILABLE")
    print("="*70)
    
    print("\n+" + "-"*68 + "+")
    print("|  1. DEEPGRAM API (Default)                                        |")
    print("+" + "-"*68 + "+")
    print("|  * Cloud-based automatic speech recognition                       |")
    print("|  * Fast processing with word-level timestamps                     |")
    print("|  * Confidence scores for pronunciation analysis                   |")
    print("|  * Speaker diarization support                                    |")
    print("+" + "-"*68 + "+")
    
    print("\n+" + "-"*68 + "+")
    print("|  2. FINE-TUNED WHISPER MODEL                                      |")
    print("+" + "-"*68 + "+")
    print(f"|  * Base Model: {WHISPER_MODEL_CONFIG['model_name']:<51} |")
    print(f"|  * Fine-tuned on: {WHISPER_MODEL_CONFIG['dataset']:<48} |")
    print(f"|  * Training Epochs: {WHISPER_MODEL_CONFIG['training_epochs']:<46} |")
    print("|  * Location: ./finetuned_whisper_nptel                            |")
    print("+" + "-"*68 + "+")
    print("|  Optimizations:                                                   |")
    for opt in WHISPER_MODEL_CONFIG['optimizations']:
        print(f"|    [OK] {opt:<58} |")
    print("+" + "-"*68 + "+")
    
    print("\n" + "="*70)
    print("  Use --use-whisper flag to enable fine-tuned Whisper transcription")
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
  python process_meeting.py projectmeeting1              # Use Deepgram (default)
  python process_meeting.py projectmeeting1 --use-whisper  # Use fine-tuned Whisper
  python process_meeting.py --model-info                 # Show model information
        """
    )
    parser.add_argument('meeting_folder', nargs='?', help='Meeting folder to process')
    parser.add_argument('--use-whisper', action='store_true', 
                        help='Use fine-tuned Whisper model for transcription')
    parser.add_argument('--model-info', action='store_true',
                        help='Show information about available transcription models')
    
    return parser.parse_args()


def main():
    args = parse_arguments()
    
    # Show model info if requested
    if args.model_info:
        show_model_info()
        sys.exit(0)
    
    if not args.meeting_folder:
        print("Usage: python process_meeting.py <meeting_folder> [--use-whisper]")
        print("\nExample: python process_meeting.py projectmeeting1")
        print("         python process_meeting.py projectmeeting1 --use-whisper")
        print("\nUse --model-info to see available transcription models")
        sys.exit(1)
    
    meeting_folder = args.meeting_folder
    meeting_path = Path(meeting_folder)
    
    if not meeting_path.exists():
        print(f"Error: Meeting folder '{meeting_folder}' not found")
        sys.exit(1)
    
    # Determine transcription backend
    use_whisper = args.use_whisper
    backend_name = "Fine-tuned Whisper (NPTEL)" if use_whisper else "Deepgram API"
    
    print(f"\n{'#'*60}")
    print(f"PROCESSING MEETING: {meeting_folder}")
    print(f"Transcription Backend: {backend_name}")
    print(f"{'#'*60}")
    
    if use_whisper:
        print("\n+" + "-"*56 + "+")
        print("|  Fine-tuned Whisper Model Configuration:              |")
        print("+" + "-"*56 + "+")
        print(f"|  Model: {WHISPER_MODEL_CONFIG['model_name']:<45} |")
        print(f"|  Dataset: {WHISPER_MODEL_CONFIG['dataset']:<43} |")
        print(f"|  Path: {WHISPER_MODEL_CONFIG['fine_tuned_path']:<47} |")
        print("+" + "-"*56 + "+")
    
    # Check if transcripts already exist
    transcript_folder = meeting_path / "participant_transcripts"
    has_transcripts = transcript_folder.exists() and any(transcript_folder.glob("*.txt"))
    
    # Step 1: Run transcription
    transcribe_script = "whisper_finetuned_transcribe.py" if use_whisper else "transcribe.py"
    step_desc = f"Step 1/4: Transcribing audio with {backend_name}"
    
    if has_transcripts:
        print(f"\n{'='*60}")
        print(step_desc)
        print(f"{'='*60}")
        print("[OK] Transcripts already exist, skipping this step")
        step1 = True
    else:
        step1 = run_command(
            [sys.executable, transcribe_script, meeting_folder],
            step_desc
        )
        
        if not step1:
            print("\n[ERROR] Transcription failed. Please check the error above.")
            sys.exit(1)
    
    # Step 2: Sync corrections from global transcript (if exists)
    global_transcript = meeting_path / "global_transcript" / f"{meeting_folder}_speaker_attributed.txt"
    if global_transcript.exists():
        print(f"\n{'='*60}")
        print("Step 2/4: Syncing corrections from global transcript")
        print(f"{'='*60}")
        try:
            sync_corrections(meeting_path, verbose=False, dry_run=False)
            print("[OK] Corrections synced successfully")
            step2_sync = True
        except Exception as e:
            print(f"[!] Warning: Sync failed - {e}")
            step2_sync = False
    else:
        print(f"\n{'='*60}")
        print("Step 2/4: Syncing corrections from global transcript")
        print(f"{'='*60}")
        print("[!] No global transcript found, skipping sync")
        step2_sync = True
    
    # Step 3: Run phoneme-based pronunciation detection
    step3 = run_command(
        [sys.executable, "phoneme_pronunciation_detector.py", meeting_folder],
        "Step 3/4: Detecting pronunciation errors (phoneme comparison)"
    )
    
    if not step3:
        print("\n[!] Pronunciation detection had issues, but continuing...")
    
    # Step 4: Update summary for web compatibility
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
