import json
import re
from pathlib import Path


def update_summary(meeting_folder: str):
    """Update summary with MFA results, confidence detection, and ensure web compatibility"""
    folder = Path(meeting_folder)
    transcript_folder = folder / "participant_transcripts"
    
    if not transcript_folder.exists():
        print(f"No participant_transcripts folder in {meeting_folder}")
        return
    
    print(f"\n{'='*60}")
    print(f"UPDATING SUMMARY: {meeting_folder}")
    print(f"{'='*60}")
    
    # Load or create summary
    summary_file = transcript_folder / "mispronunciation_summary.json"
    
    summary = {
        "meeting": folder.name,
        "total_participants": 0,
        "analyzed_participants": 0,
        "participants": {},
        "overall_stats": {}
    }
    
    # Process each participant
    participants = {}
    total_words = 0
    total_errors = 0
    
    # Find all participant transcript files
    for txt_file in transcript_folder.glob("*.txt"):
        user_id = txt_file.stem
        
        # Skip if it's not a participant file
        if user_id.startswith('_') or 'summary' in user_id.lower():
            continue
        
        print(f"\nProcessing: {user_id}")
        
        # Check for multiple result sources
        mfa_file = transcript_folder / f"{user_id}_mfa_pronunciation.json"
        confidence_file = transcript_folder / f"{user_id}_confidence_pronunciation.json"
        old_file = transcript_folder / f"{user_id}_mispronunciation.json"
        json_file = transcript_folder / f"{user_id}.json"
        
        # Get total words from transcript
        data_total_words = 0
        if json_file.exists():
            with open(json_file, 'r') as f:
                trans_data = json.load(f)
            data_total_words = len(trans_data.get("words", []))
        
        # Collect errors from all sources
        all_errors = []
        seen_words = set()  # Track words to avoid duplicates
        
        # Load confidence-based detections (primary source for mispronunciations)
        if confidence_file.exists():
            with open(confidence_file, 'r') as f:
                conf_data = json.load(f)
            
            errors_list = conf_data.get("errors", [])
            
            for i, err in enumerate(errors_list):
                word_key = f"{err.get('word', '')}_{err.get('start_time', 0):.1f}"
                if word_key not in seen_words:
                    seen_words.add(word_key)
                    
                    # Determine what was "spoken" - for low confidence, it's unclear pronunciation
                    word = err.get("word", "")
                    confidence = err.get("confidence", 0.5)
                    error_type = err.get("error_type", "")
                    actual_word = err.get("actual_word", word)
                    context = err.get("context", "")
                    details = err.get("details", "")
                    
                    # Check if this looks like a word fragment (short word followed by similar longer word)
                    is_fragment = False
                    intended_word = None
                    if len(word) <= 4 and context:
                        context_words = context.lower().split()
                        try:
                            word_idx = context_words.index(word.lower())
                            if word_idx < len(context_words) - 1:
                                next_word = context_words[word_idx + 1]
                                # Check if next word starts with similar letters
                                if len(next_word) > len(word) and next_word.startswith(word[:2]):
                                    is_fragment = True
                                    intended_word = next_word
                        except ValueError:
                            pass
                    
                    # Get phonemes
                    phonemes = err.get("expected_phonemes", "").split() if err.get("expected_phonemes") else []
                    
                    # Set details for fragments
                    if is_fragment and intended_word:
                        details = f"False start: said '{word}' before '{intended_word}'"
                    
                    all_errors.append({
                        "word": word,
                        "expected": intended_word if is_fragment and intended_word else (actual_word if actual_word != word else word),
                        "error_type": "word_fragment" if is_fragment else "pronunciation",
                        "severity": err.get("severity", "medium"),
                        "confidence": confidence,
                        "accuracy": confidence,
                        "start_time": err.get("start_time", 0.0),
                        "end_time": err.get("end_time", 0.0),
                        "expected_phonemes": phonemes,
                        "context": context,
                        "suggestion": err.get("suggestion", ""),
                        "difficulty_reasons": err.get("difficulty_reasons", []),
                        "details": details,
                        "user_id": user_id,
                        "source": "confidence"
                    })
            print(f"  ✓ Loaded {len(conf_data.get('errors', []))} confidence-based errors")
        
        if mfa_file.exists():
            print(f"  ⚠ Skipping MFA errors (too many false positives)")
            with open(mfa_file, 'r') as f:
                mfa_data = json.load(f)
            if data_total_words == 0:
                data_total_words = mfa_data.get("total_words", 0)
        
        # Sort errors by time
        all_errors.sort(key=lambda x: x.get("start_time", 0))
        
        # Calculate accuracy
        accuracy = 1.0 - (len(all_errors) / max(data_total_words, 1))
        
        # Save combined results to mispronunciation file for web display
        web_format = {
            "total_words": data_total_words,
            "errors_detected": len(all_errors),
            "accuracy": accuracy,
            "errors": all_errors
        }
        
        with open(old_file, 'w') as f:
            json.dump(web_format, f, indent=2)
        print(f"  ✓ Saved combined results: {old_file.name} ({len(all_errors)} errors)")
        
        # Update participant summary
        participants[user_id] = {
            "status": "success" if all_errors or confidence_file.exists() or mfa_file.exists() else "no_data",
            "total_words": data_total_words,
            "errors_detected": len(all_errors),
            "accuracy": accuracy,
            "sources": []
        }
        
        if confidence_file.exists():
            participants[user_id]["sources"].append("confidence")
        if mfa_file.exists():
            participants[user_id]["sources"].append("mfa")
        
        if participants[user_id]["status"] == "success":
            total_words += data_total_words
            total_errors += len(all_errors)
    
    # Build final summary
    summary["participants"] = participants
    summary["total_participants"] = len(participants)
    summary["analyzed_participants"] = sum(1 for p in participants.values() if p["status"] == "success")
    summary["overall_stats"] = {
        "total_words": total_words,
        "total_errors": total_errors,
        "average_accuracy": 1.0 - (total_errors / max(total_words, 1))
    }
    
    # Save summary
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"SUMMARY COMPLETE")
    print(f"{'='*60}")
    print(f"  Participants: {summary['analyzed_participants']}")
    print(f"  Total errors: {total_errors}")
    print(f"  Accuracy: {summary['overall_stats']['average_accuracy']:.1%}")
    print(f"  Saved to: {summary_file}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        for folder in sys.argv[1:]:
            update_summary(folder)
    else:
        update_summary("projectmeeting1")
        update_summary("meet6")
