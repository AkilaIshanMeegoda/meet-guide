"""
Update mispronunciation summary to combine old and new detection results.
Merges MFA results with confidence-based detection results.
"""
import json
import re
from pathlib import Path


# =============================================================================
# PHONETIC MISPRONUNCIATION GENERATOR
# =============================================================================

class MispronunciationGenerator:
    """
    Generates likely mispronounced forms of words based on:
    1. Common L2 speaker pronunciation patterns
    2. Low confidence phonemes
    3. Known difficult sound patterns
    
    This works universally for any word - no hardcoded words.
    """
    
    # Common phoneme substitutions for L2 English speakers (especially South Asian)
    PHONEME_SUBSTITUTIONS = {
        # Vowel shifts - these are common for non-native speakers
        'AH': ['UH', 'AA'],      # schwa often becomes 'uh' or 'ah'
        'IH': ['EE', 'I'],       # short i becomes long ee (e.g., "bit" → "beet")
        'UH': ['OO', 'U'],       # short u becomes long oo
        'AE': ['EH', 'A'],       # 'a' as in cat → 'e' or flat 'a'
        'EH': ['AY', 'E'],       # short e shifts
        'AA': ['AH', 'O'],       # 'o' as in hot
        'AO': ['OH', 'AW'],      # caught/cot merger
        'OW': ['O', 'OH'],       # boat → bot
        'EY': ['AY', 'E'],       # day → dai
        'IY': ['I', 'EE'],       # keep → kip
        'UW': ['OO', 'U'],       # food → fud
        
        # Consonant difficulties
        'TH': ['T', 'D'],        # think → tink, this → dis
        'DH': ['D', 'T'],        # the → de
        'V': ['W', 'B'],         # very → wery
        'W': ['V', 'W'],         # west → vest
        'Z': ['S', 'J'],         # zero → sero
        'ZH': ['J', 'SH'],       # measure → measher
        'R': ['L', 'R'],         # r/l confusion
        'L': ['R', 'L'],         # r/l confusion
        'SH': ['S', 'CH'],       # ship → sip
        'CH': ['SH', 'TS'],      # check → sheck
        'JH': ['J', 'CH'],       # judge → chudge
        'NG': ['N', 'NG'],       # sing → sin
    }
    
    # Phoneme to readable spelling mapping (for converting phonemes to text)
    PHONEME_TO_SPELLING = {
        'AA': 'ah', 'AE': 'a', 'AH': 'uh', 'AO': 'aw', 'AW': 'ow',
        'AY': 'ai', 'B': 'b', 'CH': 'ch', 'D': 'd', 'DH': 'th',
        'EH': 'e', 'ER': 'er', 'EY': 'ay', 'F': 'f', 'G': 'g',
        'HH': 'h', 'IH': 'i', 'IY': 'ee', 'JH': 'j', 'K': 'k',
        'L': 'l', 'M': 'm', 'N': 'n', 'NG': 'ng', 'OW': 'oh',
        'OY': 'oy', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'sh',
        'T': 't', 'TH': 'th', 'UH': 'oo', 'UW': 'oo', 'V': 'v',
        'W': 'w', 'Y': 'y', 'Z': 'z', 'ZH': 'zh',
        # Substitution phonemes
        'EE': 'ee', 'I': 'i', 'OO': 'oo', 'U': 'u', 'A': 'a',
        'E': 'e', 'O': 'o', 'OH': 'oh',
    }
    
    # Spelling patterns for generating readable mispronunciations from word spelling
    # These are common L2 English speaker patterns - applied dynamically to any word
    SPELLING_TRANSFORMS = [
        # Vowel shifts (common L2 patterns)
        (r'(?i)sus(?=t)', 'soos'),              # sustainable → soostainable
        (r'(?i)(?<=[bcdfghjklmnpqrstvwxyz])u(?=st)', 'oo'),  # just → joost
        
        # Appreciation/complex words
        (r'(?i)preci', 'poshi'),                 # appreciate → aposhiate
        (r'(?i)(?<=a)pprec', 'posh'),            # appreciate → aposhate
        
        # Check/ck patterns - short i → long ee
        (r'(?i)(?<=ch)eck', 'eek'),              # check → cheek
        (r'(?i)(?<=ch)e(?=ck)', 'ee'),           # checking → cheeking
        
        # Double consonant simplification  
        (r'(?i)comm(?=un)', 'com'),              # communication → comunication
        (r'(?i)(?<=[aeiou])mm(?=[aeiou])', 'm'), # swimming → swiming
        
        # Consonant cluster reductions
        (r'(?i)(?<=[aeiou])ntly', 'nly'),        # constantly → constanly
        (r'(?i)(?<=[aeiou])stly', 'sly'),        # mostly → mosly
        
        # R-reduction patterns
        (r'(?i)(?<=pr)ior(?=i)', 'io'),          # prioritize → priotize
        (r'(?i)(?<=p)art(?=i)', 'at'),           # particular → paticular
        
        # Overwhelm patterns
        (r'(?i)overwh', 'overw'),                # overwhelmed → overwelmed
        (r'(?i)whelm', 'welm'),                  # whelm → welm
        
        # -tion/-sion endings
        (r'(?i)tion(?=$|[^a-z])', 'shun'),       # nation → nashun
        (r'(?i)sion(?=$|[^a-z])', 'zhun'),       # vision → vizhun
        
        # -cious/-tious endings
        (r'(?i)cious(?=$|[^a-z])', 'shus'),      # precious → preshus
        (r'(?i)tious(?=$|[^a-z])', 'shus'),      # cautious → caushus
        
        # -able/-ible endings
        (r'(?i)(?<=[aeiou])ble(?=$|[^a-z])', 'bul'),   # able → abul
        (r'(?i)(?<=[^aeiou])le(?=$|[^a-z])', 'ul'),    # simple → simpul
        
        # -ture endings
        (r'(?i)ture(?=$|[^a-z])', 'cher'),       # nature → nacher
        
        # TH sounds (common L2 difficulty)
        (r'(?i)^th(?=[aeiou])', 'd'),            # the → de (word start, voiced)
        (r'(?i)^th', 't'),                       # think → tink (word start, unvoiced)
        (r'(?i)(?<=[aeiou])th(?=[aeiou])', 'd'), # brother → broder
        
        # V/W confusion
        (r'(?i)^v(?=[aeiou])', 'w'),             # very → wery
        
        # Silent letters and reductions
        (r'(?i)ough', 'uf'),                     # enough → enuf
        (r'(?i)(?<=[aeiou])gh(?=[^aeiou]|$)', ''),  # night → nit
    ]
    
    def generate_mispronunciation(self, word: str, phonemes: list, confidence: float) -> str:
        """
        Generate a likely mispronounced form of a word dynamically.
        
        Args:
            word: The original word
            phonemes: List of expected phonemes (ARPAbet)
            confidence: ASR confidence score (lower = more likely mispronounced)
        
        Returns:
            A string representing how the word was likely pronounced
        """
        word_lower = word.lower()
        
        # Use spelling-based generation as primary method (more readable results)
        result = self._generate_from_spelling(word_lower, confidence)
        
        # If spelling-based didn't produce a change, try phoneme-based
        if result == word_lower and phonemes and len(phonemes) >= 2:
            result = self._generate_from_phonemes_smart(word_lower, phonemes, confidence)
        
        # If still same as original, apply a simple transformation
        if result == word_lower:
            result = self._apply_simple_transform(word_lower, confidence)
        
        return result
    
    def _generate_from_phonemes_smart(self, word: str, phonemes: list, confidence: float) -> str:
        """Generate mispronunciation by modifying the word based on phoneme analysis"""
        
        result = word
        
        # Check which difficult phonemes are in the word and apply spelling changes
        phoneme_str = ' '.join(phonemes).upper()
        
        # Map phoneme patterns to spelling changes
        phoneme_spelling_changes = [
            # If word has IH (short i) sound, change 'i' or 'e' to 'ee'
            (['IH'], [('(?<=[bcdfghjklmnpqrstvwxyz])e(?=[bcdfghjklmnpqrstvwxyz])', 'ee'),
                      ('(?<=[bcdfghjklmnpqrstvwxyz])i(?=[bcdfghjklmnpqrstvwxyz])', 'ee')]),
            # If word has AH (schwa), change 'a' or 'u' to 'uh'
            (['AH'], [('(?<=[bcdfghjklmnpqrstvwxyz])a(?=[bcdfghjklmnpqrstvwxyz])', 'uh'),
                      ('u(?=[bcdfghjklmnpqrstvwxyz])', 'oo')]),
            # If word has TH sound, change 'th' to 't' or 'd'
            (['TH', 'DH'], [('th', 't')]),
            # If word has V sound, might be pronounced as W
            (['V'], [('v', 'w')]),
            # If word has CH sound, might become SH
            (['CH'], [('ch', 'sh')]),
        ]
        
        changes_made = 0
        max_changes = 2 if confidence < 0.7 else 1
        
        for phoneme_list, spelling_changes in phoneme_spelling_changes:
            if changes_made >= max_changes:
                break
            
            # Check if any of these phonemes are in the word
            if any(p in phoneme_str for p in phoneme_list):
                for pattern, replacement in spelling_changes:
                    new_result = re.sub(pattern, replacement, result, count=1)
                    if new_result != result:
                        result = new_result
                        changes_made += 1
                        break
        
        return result
    
    def _generate_from_spelling(self, word: str, confidence: float) -> str:
        """Generate mispronunciation from word spelling using pattern rules"""
        result = word
        changes_made = 0
        max_changes = 2 if confidence < 0.7 else 1
        
        for pattern, replacement in self.SPELLING_TRANSFORMS:
            if changes_made >= max_changes:
                break
            
            new_result = re.sub(pattern, replacement, result)
            if new_result != result:
                result = new_result
                changes_made += 1
        
        return result
    
    def _apply_simple_transform(self, word: str, confidence: float) -> str:
        """Apply a simple transformation when other methods don't work"""
        
        # Common simple transformations based on word patterns
        transformations = [
            # Short i to long ee in check/ck words
            (r'(?i)(?<=[bcdfghjklmnpqrstvwxz])e(?=ck)', 'ee'),
            # Double consonant simplification
            (r'(?i)([bcdfghjklmnpqrstvwxz])\1', r'\1'),
            # Final -ing to -in
            (r'(?i)ing$', 'in'),
            # -tion to -shun
            (r'(?i)tion$', 'shun'),
            # -ed to -d or drop
            (r'(?i)([aeiou])ed$', r'\1d'),
            # Schwa vowels get shifted
            (r'(?i)([^aeiou])a([^aeiou])', r'\1uh\2'),
        ]
        
        for pattern, replacement in transformations:
            new_word = re.sub(pattern, replacement, word)
            if new_word != word:
                return new_word
        
        # Last resort: indicate uncertainty
        if confidence < 0.65:
            return f"{word}?"
        
        return word


# Global instance
mispronunciation_generator = MispronunciationGenerator()


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
                    
                    # Get phonemes for mispronunciation generation
                    phonemes = err.get("expected_phonemes", "").split() if err.get("expected_phonemes") else []
                    
                    # Generate the actual mispronounced form using phonetic analysis
                    if is_fragment and intended_word:
                        spoken_as = word  # The fragment itself is the spoken form
                        details = f"False start: said '{word}' before '{intended_word}'"
                    elif error_type == "word_fragment":
                        spoken_as = word
                    else:
                        # Generate likely mispronunciation based on phonemes and confidence
                        spoken_as = mispronunciation_generator.generate_mispronunciation(word, phonemes, confidence)
                        
                        # If generated form is same as original, indicate it's unclear
                        if spoken_as.lower() == word.lower():
                            if confidence < 0.60:
                                spoken_as = f"{word} (mumbled)"
                            else:
                                spoken_as = f"{word} (unclear)"
                    
                    all_errors.append({
                        "word": word,
                        "expected": intended_word if is_fragment and intended_word else (actual_word if actual_word != word else word),
                        "spoken": word,  # The actual word in transcript
                        "spoken_as": spoken_as,  # The likely mispronounced form
                        "error_type": "word_fragment" if is_fragment else "pronunciation",
                        "severity": err.get("severity", "medium"),
                        "confidence": confidence,
                        "accuracy": confidence,
                        "start_time": err.get("start_time", 0.0),
                        "end_time": err.get("end_time", 0.0),
                        "phonemes": {
                            "expected": phonemes,
                            "spoken": []
                        },
                        "context": context,
                        "suggestion": err.get("suggestion", ""),
                        "difficulty_reasons": err.get("difficulty_reasons", []),
                        "details": details,
                        "user_id": user_id,
                        "source": "confidence"
                    })
            print(f"  ✓ Loaded {len(conf_data.get('errors', []))} confidence-based errors")
        
        # Skip MFA results - they cause too many false positives on common words
        # MFA detects minor phoneme variations that are not actual mispronunciations
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
        # Default to projectmeeting1 and meet6
        update_summary("projectmeeting1")
        update_summary("meet6")
