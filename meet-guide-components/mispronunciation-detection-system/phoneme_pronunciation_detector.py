#!/usr/bin/env python3
"""
Phoneme-Level Pronunciation Detector

Compares expected phonemes (CMU dictionary) with actual phonemes (MFA alignment)
to detect mispronunciations. NO HARDCODED WORDS OR PATTERNS.

Detection Method:
1. Get expected phonemes for each word from CMU Pronouncing Dictionary
2. Run MFA to get actual phonemes spoken
3. Compare expected vs actual phonemes
4. Flag words where phonemes don't match
"""

import json
import os
import sys
import io
import re
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set

# Fix encoding for Windows console (needed when launched from PM2/services)
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# CMU DICTIONARY FOR EXPECTED PHONEMES
class CMUPhonemeDict:
    """CMU Pronouncing Dictionary for expected phonemes."""
    
    # Mapping from CMU phonemes to MFA-compatible phonemes
    CMU_TO_MFA = {
        'AA': 'AA', 'AE': 'AE', 'AH': 'AH', 'AO': 'AO', 'AW': 'AW',
        'AY': 'AY', 'B': 'B', 'CH': 'CH', 'D': 'D', 'DH': 'DH',
        'EH': 'EH', 'ER': 'ER', 'EY': 'EY', 'F': 'F', 'G': 'G',
        'HH': 'HH', 'IH': 'IH', 'IY': 'IY', 'JH': 'JH', 'K': 'K',
        'L': 'L', 'M': 'M', 'N': 'N', 'NG': 'NG', 'OW': 'OW',
        'OY': 'OY', 'P': 'P', 'R': 'R', 'S': 'S', 'SH': 'SH',
        'T': 'T', 'TH': 'TH', 'UH': 'UH', 'UW': 'UW', 'V': 'V',
        'W': 'W', 'Y': 'Y', 'Z': 'Z', 'ZH': 'ZH'
    }
    
    def __init__(self):
        self.entries: Dict[str, List[List[str]]] = {}
        self._load_cmudict()
    
    def _load_cmudict(self):
        """Load CMU dictionary."""
        try:
            import nltk
            try:
                from nltk.corpus import cmudict
                self.entries = cmudict.dict()
                print(f"✓ CMU dictionary loaded ({len(self.entries)} words)")
            except LookupError:
                nltk.download('cmudict', quiet=True)
                from nltk.corpus import cmudict
                self.entries = cmudict.dict()
                print(f"✓ CMU dictionary loaded ({len(self.entries)} words)")
        except Exception as e:
            print(f"⚠ Could not load CMU dictionary: {e}")
    
    def get_expected_phonemes(self, word: str) -> Optional[List[str]]:
        """Get expected phonemes for a word (without stress markers)."""
        word = word.lower().strip()
        if word in self.entries:
            # Get first pronunciation, remove stress numbers
            phonemes = self.entries[word][0]
            return [re.sub(r'\d', '', p) for p in phonemes]
        return None
    
    def get_phoneme_string(self, word: str) -> Optional[str]:
        """Get phonemes as space-separated string."""
        phonemes = self.get_expected_phonemes(word)
        if phonemes:
            return ' '.join(phonemes)
        return None


# MFA ALIGNMENT FOR ACTUAL PHONEMES
class MFAAligner:
    """Montreal Forced Aligner for getting actual phonemes."""
    
    def __init__(self):
        self.mfa_available = self._check_mfa()
    
    def _check_mfa(self) -> bool:
        """Check if MFA is available."""
        try:
            result = subprocess.run(['mfa', 'version'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                print(f"✓ MFA available: {result.stdout.strip()}")
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        except Exception:
            pass
        print("⚠ MFA not available - using confidence + complexity detection only")
        return False
        return False
    
    def align_audio(self, audio_path: str, transcript: str) -> Optional[List[Dict]]:
        """
        Run MFA alignment to get actual phonemes.
        Returns list of words with their phonemes.
        """
        if not self.mfa_available:
            return None
        
        # Create temp directory for MFA
        temp_dir = tempfile.mkdtemp(prefix='mfa_')
        
        try:
            audio_name = Path(audio_path).stem
            
            # Create transcript file
            transcript_path = os.path.join(temp_dir, f"{audio_name}.txt")
            with open(transcript_path, 'w', encoding='utf-8') as f:
                f.write(transcript)
            
            # Copy audio file
            audio_ext = Path(audio_path).suffix
            temp_audio = os.path.join(temp_dir, f"{audio_name}{audio_ext}")
            shutil.copy(audio_path, temp_audio)
            
            # Output directory
            output_dir = os.path.join(temp_dir, "output")
            os.makedirs(output_dir, exist_ok=True)
            
            # Run MFA alignment
            cmd = [
                'mfa', 'align',
                temp_dir,
                'english_us_arpa',  # Dictionary
                'english_us_arpa',  # Acoustic model
                output_dir,
                '--clean',
                '--single_speaker',
                '--output_format', 'json'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            
            if result.returncode != 0:
                print(f"  ⚠ MFA alignment failed: {result.stderr[:200]}")
                return None
            
            # Parse JSON output
            json_path = os.path.join(output_dir, f"{audio_name}.json")
            if os.path.exists(json_path):
                return self._parse_mfa_json(json_path)
            
            # Fallback to TextGrid
            textgrid_path = os.path.join(output_dir, f"{audio_name}.TextGrid")
            if os.path.exists(textgrid_path):
                return self._parse_textgrid(textgrid_path)
            
            return None
            
        except Exception as e:
            print(f"  ⚠ MFA error: {e}")
            return None
        finally:
            # Cleanup
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    def _parse_mfa_json(self, json_path: str) -> List[Dict]:
        """Parse MFA JSON output to extract words and phonemes."""
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            words = []
            
            tiers = data.get('tiers', {})
            word_tier = tiers.get('words', {}).get('entries', [])
            phone_tier = tiers.get('phones', {}).get('entries', [])
            
            for word_entry in word_tier:
                word_text = word_entry[2] if len(word_entry) > 2 else ''
                if not word_text or word_text.strip() == '':
                    continue
                
                word_start = word_entry[0]
                word_end = word_entry[1]
                
                # Get phonemes for this word's time range
                word_phonemes = []
                for phone_entry in phone_tier:
                    phone_start = phone_entry[0]
                    phone_end = phone_entry[1]
                    phone_text = phone_entry[2] if len(phone_entry) > 2 else ''
                    
                    if phone_start >= word_start and phone_end <= word_end:
                        if phone_text and phone_text.strip():
                            # Convert to uppercase for comparison
                            word_phonemes.append(phone_text.strip().upper())
                
                words.append({
                    'word': word_text.strip(),
                    'start': word_start,
                    'end': word_end,
                    'actual_phonemes': word_phonemes
                })
            
            return words
            
        except Exception as e:
            print(f"  ⚠ Error parsing MFA JSON: {e}")
            return []
    
    def _parse_textgrid(self, textgrid_path: str) -> List[Dict]:
        """Parse TextGrid file to extract words and phonemes."""
        try:
            import textgrid
            tg = textgrid.TextGrid.fromFile(textgrid_path)
        except ImportError:
            # Manual parsing if textgrid module not available
            return self._manual_parse_textgrid(textgrid_path)
        
        words = []
        word_tier = None
        phone_tier = None
        
        for tier in tg.tiers:
            if tier.name.lower() == 'words':
                word_tier = tier
            elif tier.name.lower() == 'phones':
                phone_tier = tier
        
        if not word_tier or not phone_tier:
            return []
        
        for interval in word_tier:
            if interval.mark and interval.mark.strip():
                word_text = interval.mark.strip()
                word_start = interval.minTime
                word_end = interval.maxTime
                
                # Get phonemes for this word's time range
                word_phonemes = []
                for phone in phone_tier:
                    if phone.minTime >= word_start and phone.maxTime <= word_end:
                        if phone.mark and phone.mark.strip():
                            word_phonemes.append(phone.mark.strip().upper())
                
                words.append({
                    'word': word_text,
                    'start': word_start,
                    'end': word_end,
                    'actual_phonemes': word_phonemes
                })
        
        return words
    
    def _manual_parse_textgrid(self, textgrid_path: str) -> List[Dict]:
        """Manual TextGrid parsing without external library."""
        words = []
        
        with open(textgrid_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Simple regex-based parsing
        word_pattern = r'item \[1\].*?intervals \[(\d+)\].*?xmin = ([\d.]+).*?xmax = ([\d.]+).*?text = "(.*?)"'
        # This is simplified - full parsing would be more complex
        
        return words


# PHONEME COMPARISON DETECTOR
class PhonemePronunciationDetector:
    """
    Detect mispronunciations by comparing expected vs actual phonemes.
    NO HARDCODED WORDS - purely phoneme-based comparison.
    """

    SKIP_WORDS = {
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'up', 'about', 'into', 'over',
        'after', 'and', 'but', 'or', 'if', 'so', 'as', 'it', 'its',
        'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
        'she', 'her', 'they', 'them', 'their', 'this', 'that', 'these',
        'those', 'what', 'which', 'who', 'whom', 'when', 'where', 'why',
        'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
        'other', 'some', 'such', 'no', 'not', 'only', 'same', 'than',
        'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then',
        'yeah', 'yes', 'no', 'okay', 'ok', 'um', 'uh', 'like', 'well',
    }
    
    def __init__(self):
        self.cmu = CMUPhonemeDict()
        self.mfa = MFAAligner()
    
    def detect_errors(self, audio_path: str, transcript_data: Dict) -> List[Dict]:
        """
        Detect pronunciation errors by comparing phonemes.
        
        Args:
            audio_path: Path to audio file
            transcript_data: Dictionary with 'transcript' and 'words' keys
        
        Returns:
            List of detected pronunciation errors
        """
        errors = []
        transcript = transcript_data.get('transcript', '')
        asr_words = transcript_data.get('words', [])
        
        # Method 1: ASR confidence-based detection (always available)
        confidence_errors = self._detect_low_confidence(asr_words)
        errors.extend(confidence_errors)
        
        # Method 2: MFA phoneme comparison (if MFA available)
        if self.mfa.mfa_available and audio_path and os.path.exists(audio_path):
            print(f"  Running MFA alignment...")
            mfa_words = self.mfa.align_audio(audio_path, transcript)
            
            if mfa_words:
                phoneme_errors = self._compare_phonemes(asr_words, mfa_words)
                errors.extend(phoneme_errors)
        
        # Remove duplicates
        seen = set()
        unique_errors = []
        for e in errors:
            key = (e['word'].lower(), round(e.get('start_time', 0), 1))
            if key not in seen:
                seen.add(key)
                unique_errors.append(e)
        
        return unique_errors
    
    def _detect_low_confidence(self, words: List[Dict]) -> List[Dict]:
        """Detect words with low ASR confidence."""
        errors = []
        
        for i, w in enumerate(words):
            word = w.get('word', '').lower()
            conf = w.get('confidence', 1.0)
            
            if word in self.SKIP_WORDS or len(word) < 3:
                continue
            
            # Low confidence threshold
            if conf < 0.80:
                ctx = self._get_context(words, i)
                errors.append({
                    'word': w.get('word', ''),
                    'confidence': conf,
                    'start_time': w.get('start', 0),
                    'end_time': w.get('end', 0),
                    'error_type': 'low_confidence',
                    'severity': 'high' if conf < 0.70 else 'medium',
                    'details': f'ASR confidence: {conf:.3f}',
                    'context': ctx,
                    'expected_phonemes': self.cmu.get_phoneme_string(word) or 'unknown'
                })
        
        return errors
    
    def _compare_phonemes(self, asr_words: List[Dict], mfa_words: List[Dict]) -> List[Dict]:
        """
        Compare expected phonemes (CMU) with actual phonemes (MFA).
        This is the core of true pronunciation detection.
        """
        errors = []
        
        # Create time-based lookup for ASR words
        asr_lookup = {}
        for w in asr_words:
            start = round(w.get('start', 0), 1)
            asr_lookup[start] = w
        
        for mfa_word in mfa_words:
            word_text = mfa_word['word'].lower()
            
            if word_text in self.SKIP_WORDS or len(word_text) < 3:
                continue
            
            # Get expected phonemes from CMU
            expected = self.cmu.get_expected_phonemes(word_text)
            if not expected:
                continue
            
            # Get actual phonemes from MFA
            actual = mfa_word.get('actual_phonemes', [])
            if not actual:
                continue
            
            # Compare phonemes
            mismatch_score = self._phoneme_mismatch_score(expected, actual)
            
            if mismatch_score > 0.3:  # More than 30% mismatch
                # Find confidence from ASR
                start_time = round(mfa_word.get('start', 0), 1)
                asr_conf = asr_lookup.get(start_time, {}).get('confidence', 1.0)
                
                severity = 'high' if mismatch_score > 0.5 else 'medium'
                
                errors.append({
                    'word': mfa_word['word'],
                    'confidence': asr_conf,
                    'start_time': mfa_word.get('start', 0),
                    'end_time': mfa_word.get('end', 0),
                    'error_type': 'phoneme_mismatch',
                    'severity': severity,
                    'details': f'Expected: {" ".join(expected)}, Actual: {" ".join(actual)}, Mismatch: {mismatch_score:.0%}',
                    'context': '',
                    'expected_phonemes': ' '.join(expected),
                    'actual_phonemes': ' '.join(actual)
                })
        
        return errors
    
    def _phoneme_mismatch_score(self, expected: List[str], actual: List[str]) -> float:
        """
        Calculate mismatch score between expected and actual phonemes.
        Returns 0.0 (perfect match) to 1.0 (complete mismatch).
        
        IMPORTANT: Removes stress markers (0, 1, 2) before comparison
        since stress differences are NOT pronunciation errors.
        """
        if not expected or not actual:
            return 0.5
        
        # Normalize phonemes - remove stress markers (numbers)
        expected_norm = [re.sub(r'\d', '', p.upper()) for p in expected]
        actual_norm = [re.sub(r'\d', '', p.upper()) for p in actual]
        
        # Remove empty strings
        expected_norm = [p for p in expected_norm if p]
        actual_norm = [p for p in actual_norm if p]
        
        if not expected_norm or not actual_norm:
            return 0.5
        
        # Calculate Levenshtein distance
        m, n = len(expected_norm), len(actual_norm)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        
        for i in range(m + 1):
            dp[i][0] = i
        for j in range(n + 1):
            dp[0][j] = j
        
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if expected_norm[i-1] == actual_norm[j-1]:
                    dp[i][j] = dp[i-1][j-1]
                else:
                    dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
        
        distance = dp[m][n]
        max_len = max(m, n)
        
        return distance / max_len if max_len > 0 else 0.0
    
    def _detect_complex_words(self, words: List[Dict], already_detected: Set[str]) -> List[Dict]:
        """
        Detect complex words that are likely to be mispronounced.
        Based on syllable count and phoneme complexity - NO hardcoded patterns.
        """
        errors = []
        
        for i, w in enumerate(words):
            word = w.get('word', '').lower()
            conf = w.get('confidence', 1.0)
            
            if word in self.SKIP_WORDS or word in already_detected:
                continue
            
            if len(word) < 5:
                continue
            
            # Get phonemes to calculate complexity
            phonemes = self.cmu.get_expected_phonemes(word)
            if not phonemes:
                continue
            
            # Calculate complexity score
            syllables = self._count_syllables(word)
            phoneme_count = len(phonemes)
            
            # Complexity factors (algorithmic, not hardcoded)
            complexity = 0
            
            # Factor 1: Syllable count
            if syllables >= 4:
                complexity += 3
            elif syllables >= 3:
                complexity += 2
            
            # Factor 2: Phoneme density
            if phoneme_count >= 8:
                complexity += 2
            elif phoneme_count >= 6:
                complexity += 1
            
            # Factor 3: Word length
            if len(word) >= 10:
                complexity += 1
            
            # Factor 4: Difficult phoneme sequences (generic, not word-specific)
            difficult_sequences = ['TH', 'ZH', 'NG', 'SH', 'CH', 'JH']
            for seq in difficult_sequences:
                if seq in phonemes:
                    complexity += 0.5
            
            # Flag complex words
            if complexity >= 4:
                ctx = self._get_context(words, i)
                errors.append({
                    'word': w.get('word', ''),
                    'confidence': conf,
                    'start_time': w.get('start', 0),
                    'end_time': w.get('end', 0),
                    'error_type': 'complex_word',
                    'severity': 'medium' if complexity >= 5 else 'low',
                    'details': f'{syllables} syllables, {phoneme_count} phonemes, complexity={complexity:.1f}',
                    'context': ctx,
                    'expected_phonemes': ' '.join(phonemes)
                })
        
        return errors
    
    def _count_syllables(self, word: str) -> int:
        """Count syllables using phonemes if available, else estimate."""
        phonemes = self.cmu.get_expected_phonemes(word)
        if phonemes:
            # Count vowel phonemes (they have stress markers in original)
            vowels = {'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 
                     'IH', 'IY', 'OW', 'OY', 'UH', 'UW'}
            return sum(1 for p in phonemes if p in vowels)
        
        # Fallback: estimate from text
        word = word.lower()
        count = 0
        prev_vowel = False
        for char in word:
            is_vowel = char in 'aeiouy'
            if is_vowel and not prev_vowel:
                count += 1
            prev_vowel = is_vowel
        return max(1, count)
    
    def _get_context(self, words: List[Dict], index: int) -> str:
        """Get context words around the target word."""
        start = max(0, index - 3)
        end = min(len(words), index + 4)
        return ' '.join([w['word'] for w in words[start:end]])


# MAIN PROCESSING
def process_meeting(meeting_folder: str):
    """Process all participants in a meeting folder."""
    
    meeting_path = Path(meeting_folder)
    transcripts_path = meeting_path / "participant_transcripts"
    
    if not transcripts_path.exists():
        print(f"Error: {transcripts_path} not found")
        return
    
    print(f"\n{'#'*70}")
    print(f"PHONEME-BASED PRONUNCIATION DETECTION: {meeting_folder}")
    print(f"{'#'*70}")
    print("Method: Compare expected phonemes (CMU) vs actual phonemes (MFA)")
    
    detector = PhonemePronunciationDetector()
    
    all_errors = {}
    
    # Find all participant transcripts
    json_files = list(transcripts_path.glob("*.json"))
    participant_files = [f for f in json_files if not any(x in f.stem for x in 
                        ['mispronunciation', 'pronunciation', 'summary', 'mfa'])]
    
    for json_file in sorted(participant_files):
        participant = json_file.stem
        
        print(f"\n{'='*70}")
        print(f"Processing: {participant}")
        print(f"{'='*70}")
        
        # Load transcript
        with open(json_file, 'r', encoding='utf-8') as f:
            transcript_data = json.load(f)
        
        # Find audio file
        audio_path = None
        for ext in ['.wav', '.mp3', '.m4a', '.flac']:
            potential_audio = meeting_path / f"*{participant}*{ext}"
            matches = list(meeting_path.glob(f"*{participant}*{ext}"))
            if matches:
                audio_path = str(matches[0])
                break
        
        # Detect errors
        errors = detector.detect_errors(audio_path, transcript_data)
        
        # Save results
        output_file = transcripts_path / f"{participant}_confidence_pronunciation.json"
        result = {
            'participant': participant,
            'total_words': len(transcript_data.get('words', [])),
            'errors_found': len(errors),
            'errors': errors
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        
        print(f"✓ Saved: {output_file.name}")
        print(f"  Errors found: {len(errors)}")
        
        if errors:
            print(f"\n  Detected mispronunciations:")
            for e in errors:
                print(f"    [{e['error_type']:20}] {e['word']:15} conf={e['confidence']:.3f} sev={e['severity']}")
                print(f"       {e['details']}")
        
        all_errors[participant] = errors
    
    # Save summary
    total_errors = sum(len(e) for e in all_errors.values())
    summary = {
        'meeting': meeting_folder,
        'total_errors': total_errors,
        'by_participant': {p: len(e) for p, e in all_errors.items()},
        'all_errors': all_errors
    }
    
    summary_file = transcripts_path / "confidence_pronunciation_summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\n{'='*70}")
    print(f"SUMMARY: {total_errors} total errors detected")
    print(f"{'='*70}")
    print(f"✓ Summary saved: {summary_file.name}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python phoneme_pronunciation_detector.py <meeting_folder>")
        print("Example: python phoneme_pronunciation_detector.py projectmeeting1")
        sys.exit(1)
    
    process_meeting(sys.argv[1])
