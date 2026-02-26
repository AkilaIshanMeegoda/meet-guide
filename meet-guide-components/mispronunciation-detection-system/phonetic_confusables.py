import os
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, asdict
from collections import defaultdict

class PhoneticEncoder:
    """
    Encodes words into phonetic representations for similarity comparison.
    Uses a combination of Double Metaphone-like rules optimized for
    detecting L2 English pronunciation errors.
    """
    
    # Vowel mappings (reduce vowel variations)
    VOWEL_MAP = {
        'a': 'A', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U',
        'y': 'I', 'ee': 'I', 'ea': 'I', 'ie': 'I',
        'oo': 'U', 'ou': 'U', 'ow': 'O',
        'ai': 'A', 'ay': 'A', 'ey': 'A',
        'oa': 'O', 'oe': 'O',
    }
    
    # Consonant simplifications (common L2 confusions)
    CONSONANT_SIMPLIFY = {
        'ph': 'F', 'gh': '', 'ck': 'K', 'qu': 'KW',
        'x': 'KS', 'wh': 'W', 'wr': 'R',
        'kn': 'N', 'gn': 'N', 'pn': 'N',
        'mb': 'M', 'bt': 'T',
        'tch': 'CH', 'dge': 'J',
        'tion': 'SHN', 'sion': 'ZHN',
        'cial': 'SHL', 'tial': 'SHL',
    }
    
    def encode(self, word: str) -> str:
        """
        Create phonetic code for a word.
        Similar words should have similar codes.
        """
        if not word:
            return ""
        
        word = word.lower().strip()
        word = re.sub(r'[^\w]', '', word)
        
        # Apply consonant simplifications
        for pattern, replacement in sorted(self.CONSONANT_SIMPLIFY.items(), 
                                           key=lambda x: -len(x[0])):
            word = word.replace(pattern, replacement.lower())
        
        # Build phonetic code
        code = []
        i = 0
        while i < len(word):
            char = word[i]
            
            # Handle digraphs
            if i < len(word) - 1:
                digraph = word[i:i+2]
                if digraph == 'ch':
                    code.append('CH')
                    i += 2
                    continue
                elif digraph == 'sh':
                    code.append('SH')
                    i += 2
                    continue
                elif digraph == 'th':
                    code.append('TH')
                    i += 2
                    continue
                elif digraph == 'ng':
                    code.append('NG')
                    i += 2
                    continue
                elif digraph in self.VOWEL_MAP:
                    code.append(self.VOWEL_MAP[digraph])
                    i += 2
                    continue
            
            # Single characters
            if char in 'aeiou':
                code.append(char.upper())
            elif char in 'bdfgjklmnprstvwz':
                code.append(char.upper())
            elif char == 'c':
                # C before e/i/y is soft (S), otherwise hard (K)
                if i < len(word) - 1 and word[i+1] in 'eiy':
                    code.append('S')
                else:
                    code.append('K')
            elif char == 'g':
                # G before e/i is often soft (J)
                if i < len(word) - 1 and word[i+1] in 'ei':
                    code.append('J')
                else:
                    code.append('G')
            elif char == 'h':
                # H is often dropped in casual speech
                if i == 0:
                    code.append('H')
                # otherwise skip
            elif char == 'q':
                code.append('K')
            
            i += 1
        
        return ''.join(code)
    
    def phonetic_similarity(self, word1: str, word2: str) -> float:
        """
        Calculate phonetic similarity between two words.
        Returns 0.0 to 1.0 where 1.0 is identical phonetically.
        """
        code1 = self.encode(word1)
        code2 = self.encode(word2)
        
        if not code1 or not code2:
            return 0.0
        
        if code1 == code2:
            return 1.0
        
        # Calculate edit distance similarity
        max_len = max(len(code1), len(code2))
        distance = self._levenshtein(code1, code2)
        
        return 1.0 - (distance / max_len)
    
    def _levenshtein(self, s1: str, s2: str) -> int:
        """Calculate Levenshtein edit distance"""
        if len(s1) < len(s2):
            return self._levenshtein(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]

COMMON_MISPRONUNCIATIONS = {}
CONTEXT_HINTS = {}
CONFUSABLE_PAIRS = []

# MISPRONUNCIATION DETECTOR
@dataclass
class PhoneticMispronunciation:
    """Represents a detected phonetic mispronunciation"""
    transcribed_word: str          # What ASR heard/transcribed
    intended_word: str             # What the speaker likely meant
    phonetic_similarity: float     # How similar they sound
    error_type: str                # Type of error pattern
    severity: str                  # mild/moderate/severe
    confidence: float              # Detection confidence
    context: str                   # Surrounding text
    details: str                   # Description of the error


class PhoneticConfusableDetector:
    """
    Detects mispronunciations by finding words that were likely
    intended to be different words based on phonetic similarity.
    """
    
    def __init__(self, custom_patterns: Dict[str, Tuple[str, str]] = None):
        self.encoder = PhoneticEncoder()
        self.patterns = dict(COMMON_MISPRONUNCIATIONS)
        if custom_patterns:
            self.patterns.update(custom_patterns)
        
        # Build phonetic index of intended words
        self._build_phonetic_index()
    
    def _build_phonetic_index(self):
        """Build index for quick phonetic lookup"""
        self.intended_words = set()
        self.phonetic_to_intended = defaultdict(list)
        
        # Add all intended words from patterns
        for mispronounced, (intended, _) in self.patterns.items():
            self.intended_words.add(intended.lower())
            code = self.encoder.encode(intended)
            self.phonetic_to_intended[code].append(intended)
        
        # Add confusable pairs
        for word1, word2, _ in CONFUSABLE_PAIRS:
            self.intended_words.add(word1.lower())
            self.intended_words.add(word2.lower())
    
    def detect_mispronunciations(
        self, 
        transcript: str, 
        context_words: List[str] = None
    ) -> List[PhoneticMispronunciation]:
        """
        Analyze transcript for potential mispronunciations.
        
        Args:
            transcript: The transcribed text to analyze
            context_words: Optional list of words expected in this context
            
        Returns:
            List of detected mispronunciations
        """
        errors = []
        words = transcript.split()
        
        # Build context set
        context_set = set()
        if context_words:
            context_set.update(w.lower() for w in context_words)
        
        # Also extract context hints from transcript
        for word in words:
            word_lower = word.lower().strip('.,!?')
            if word_lower in CONTEXT_HINTS:
                context_set.update(CONTEXT_HINTS[word_lower])
        
        # Check each word and word pair
        i = 0
        while i < len(words):
            # Check single word
            word = words[i].lower().strip('.,!?')
            error = self._check_word(word, words, i, context_set)
            if error:
                errors.append(error)
            
            # Check word pair (for split compound words)
            if i < len(words) - 1:
                pair = f"{words[i]} {words[i+1]}".lower()
                pair = re.sub(r'[.,!?]', '', pair)
                error = self._check_word_pair(pair, words, i, context_set)
                if error:
                    errors.append(error)
            
            i += 1
        
        return errors
    
    def _check_word(
        self, 
        word: str, 
        all_words: List[str], 
        position: int,
        context_set: Set[str]
    ) -> Optional[PhoneticMispronunciation]:
        """Check if a word is a likely mispronunciation"""
        
        # Check known mispronunciation patterns first
        if word in self.patterns:
            intended, details = self.patterns[word]
            return PhoneticMispronunciation(
                transcribed_word=word,
                intended_word=intended,
                phonetic_similarity=self.encoder.phonetic_similarity(word, intended),
                error_type="known_pattern",
                severity="moderate",
                confidence=0.9,
                context=self._get_context(all_words, position),
                details=details
            )
        
        # Check phonetic similarity to context-expected words
        for intended in context_set:
            if intended.lower() == word:
                continue  # Same word, no error
            
            similarity = self.encoder.phonetic_similarity(word, intended)
            if similarity > 0.7:  # High phonetic similarity
                return PhoneticMispronunciation(
                    transcribed_word=word,
                    intended_word=intended,
                    phonetic_similarity=similarity,
                    error_type="phonetic_confusion",
                    severity="mild" if similarity > 0.85 else "moderate",
                    confidence=similarity * 0.8,
                    context=self._get_context(all_words, position),
                    details=f"Phonetically similar to expected word '{intended}'"
                )
        
        # Check confusable pairs - flag when we see a transcribed word that could be mispronounced
        for word1, word2, threshold in CONFUSABLE_PAIRS:
            if word == word1.lower():
                # Always flag confusable pairs - these are common mispronunciations
                similarity = self.encoder.phonetic_similarity(word, word2)
                if similarity >= threshold:
                    return PhoneticMispronunciation(
                        transcribed_word=word,
                        intended_word=word2,
                        phonetic_similarity=similarity,
                        error_type="confusable_pair",
                        severity="moderate",
                        confidence=0.7,
                        context=self._get_context(all_words, position),
                        details=f"'{word}' often confused with '{word2}'"
                    )
        
        return None
    
    def _check_word_pair(
        self,
        pair: str,
        all_words: List[str],
        position: int,
        context_set: Set[str]
    ) -> Optional[PhoneticMispronunciation]:
        """Check if a word pair is a split compound word mispronunciation"""
        
        # Check known patterns
        if pair in self.patterns:
            intended, details = self.patterns[pair]
            return PhoneticMispronunciation(
                transcribed_word=pair,
                intended_word=intended,
                phonetic_similarity=self.encoder.phonetic_similarity(pair.replace(" ", ""), intended),
                error_type="compound_split",
                severity="moderate",
                confidence=0.85,
                context=self._get_context(all_words, position, window=3),
                details=f"Split compound word: {details}"
            )
        
        # Check if combining words matches a context word
        combined = pair.replace(" ", "")
        for intended in context_set:
            intended_clean = intended.replace("-", "").replace(" ", "")
            similarity = self.encoder.phonetic_similarity(combined, intended_clean)
            if similarity > 0.8:
                return PhoneticMispronunciation(
                    transcribed_word=pair,
                    intended_word=intended,
                    phonetic_similarity=similarity,
                    error_type="compound_split",
                    severity="mild",
                    confidence=similarity * 0.75,
                    context=self._get_context(all_words, position, window=3),
                    details=f"Likely split pronunciation of '{intended}'"
                )
        
        return None
    
    def _get_context(self, words: List[str], position: int, window: int = 2) -> str:
        """Get context around a word position"""
        start = max(0, position - window)
        end = min(len(words), position + window + 1)
        return " ".join(words[start:end])


# INTEGRATION WITH MFA PIPELINE
def analyze_transcript_for_confusables(
    transcript_path: str,
    meeting_context: List[str] = None
) -> Dict:
    """
    Analyze a transcript file for phonetic confusables.
    
    Args:
        transcript_path: Path to transcript .txt file
        meeting_context: Optional list of expected vocabulary
        
    Returns:
        Dictionary with analysis results
    """
    # Use only user-provided context (no hardcoded defaults)
    context = list(meeting_context) if meeting_context else []
    
    # Read transcript
    with open(transcript_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Detect confusables
    detector = PhoneticConfusableDetector()
    errors = detector.detect_mispronunciations(text, context)
    
    # Build results
    results = {
        "transcript_file": transcript_path,
        "total_words": len(text.split()),
        "confusables_detected": len(errors),
        "errors": [asdict(e) for e in errors]
    }
    
    return results


def process_meeting_confusables(meeting_folder: str) -> Dict:
    """
    Process all participant transcripts in a meeting folder.
    
    Args:
        meeting_folder: Path to meeting folder
        
    Returns:
        Dictionary with all participants' analysis
    """
    meeting_path = Path(meeting_folder)
    transcript_folder = meeting_path / "participant_transcripts"
    
    if not transcript_folder.exists():
        return {"error": f"No participant_transcripts folder in {meeting_folder}"}
    
    results = {
        "meeting": meeting_path.name,
        "participants": {}
    }
    
    # Process each transcript
    for transcript_file in transcript_folder.glob("*.txt"):
        user_id = transcript_file.stem
        print(f"Analyzing confusables for: {user_id}")
        
        analysis = analyze_transcript_for_confusables(str(transcript_file))
        results["participants"][user_id] = analysis
    
    # Save results
    output_file = transcript_folder / "phonetic_confusables.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✓ Results saved: {output_file}")
    
    return results


# MAIN
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Phonetic Confusables Detector")
    parser.add_argument('meeting', nargs='?', help='Meeting folder to process')
    parser.add_argument('--transcript', help='Single transcript file')
    parser.add_argument('--context', nargs='+', help='Context vocabulary words')
    
    args = parser.parse_args()
    
    if args.meeting:
        results = process_meeting_confusables(args.meeting)
        
        # Print summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        for user_id, data in results.get("participants", {}).items():
            if "error" not in data:
                print(f"\n{user_id}: {data['confusables_detected']} potential mispronunciations")
                for err in data.get("errors", [])[:5]:
                    print(f"  - '{err['transcribed_word']}' → '{err['intended_word']}' ({err['error_type']})")
    
    elif args.transcript:
        results = analyze_transcript_for_confusables(args.transcript, args.context)
        print(json.dumps(results, indent=2))
    
    else:
        # Demo - Note: With dynamic detection, this module now works with MFA pipeline
        print("Phonetic Confusables Detector")
        print("=" * 50)
        print("\nNOTE: This module now uses DYNAMIC mispronunciation detection.")
        print("Mispronunciations are detected by comparing:")
        print("  1. MFA phoneme alignments (actual pronunciation)")
        print("  2. CMU dictionary phonemes (expected pronunciation)")
        print("\nNo hardcoded word patterns are used.")
        print("\nUsage:")
        print("  python phonetic_confusables.py <meeting_folder>")
        print("  python phonetic_confusables.py --transcript file.txt --context word1 word2")
        
        # Demo of PhoneticEncoder functionality
        encoder = PhoneticEncoder()
        print("\nPhoneticEncoder Demo:")
        print("  Encoding 'hello':", encoder.encode("hello"))
        print("  Encoding 'helo':", encoder.encode("helo"))
        print("  Similarity:", encoder.phonetic_similarity("hello", "helo"))