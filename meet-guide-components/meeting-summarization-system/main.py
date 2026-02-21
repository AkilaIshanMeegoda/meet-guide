# Entry Point - Intent Detection Pipeline

import json
from pipeline import run_full_pipeline


def main():
    """Run the full pipeline on sample transcript."""
    # Load sample transcript
    with open("sample_transcript.json", "r", encoding="utf-8") as f:
        sample_meeting = json.load(f)

    # Run the full pipeline (models load automatically on first use)
    results, final_topics = run_full_pipeline(sample_meeting)

    # Output results
    print("\n" + "="*80)
    print("FINAL OUTPUT - GROUPED BY TOPICS")
    print("="*80)
    print(json.dumps(final_topics, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
