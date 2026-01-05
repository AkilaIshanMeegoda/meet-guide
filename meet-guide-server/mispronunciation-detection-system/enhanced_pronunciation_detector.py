"""
==============================================================================
ENHANCED PRONUNCIATION ERROR DETECTION SYSTEM
==============================================================================

This module implements an advanced pronunciation detection pipeline that:
1. Uses wav2vec2 phoneme recognition to get ACTUAL spoken phonemes from audio
2. Compares with CMU dictionary expected phonemes
3. Does NOT rely on ASR transcript - detects what was actually said

Key difference from MFA approach:
- MFA aligns audio to transcript (so if ASR "fixed" pronunciation, MFA misses it)
- This approach recognizes phonemes directly from audio signal

Author: Research Team
Date: December 2025
"""

import os
import json
import re
import warnings
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, asdict
from collections import defaultdict
import numpy as np

warnings.filterwarnings('ignore')

# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class EnhancedPronunciationError:
    """Represents a detected pronunciation error with enhanced analysis"""
    user_id: str
    word: str
    transcript_word: str        # What ASR transcribed
    expected_phonemes: List[str]
    actual_phonemes: List[str]  # What was actually spoken (from audio)
    phoneme_similarity: float   # How similar expected vs actual
    error_type: str
    severity: str
    confidence: float
    start_time: float
    end_time: float
    details: str


# =============================================================================
# PHONEME DISTANCE CALCULATOR
# =============================================================================

class PhonemeDistanceCalculator:
    """
    Calculate phonetic distance between phoneme sequences.
    Uses articulatory features for more accurate similarity.
    """
    
    # ARPAbet phoneme features: (manner, place, voicing)
    PHONEME_FEATURES = {
        # Vowels (manner=vowel, height, backness)
        'AA': ('vowel', 'low', 'back'),
        'AE': ('vowel', 'low', 'front'),
        'AH': ('vowel', 'mid', 'central'),
        'AO': ('vowel', 'mid', 'back'),
        'AW': ('diphthong', 'low', 'back'),
        'AY': ('diphthong', 'low', 'front'),
        'EH': ('vowel', 'mid', 'front'),
        'ER': ('vowel', 'mid', 'central'),
        'EY': ('diphthong', 'mid', 'front'),
        'IH': ('vowel', 'high', 'front'),
        'IY': ('vowel', 'high', 'front'),
        'OW': ('diphthong', 'mid', 'back'),
        'OY': ('diphthong', 'mid', 'back'),
        'UH': ('vowel', 'high', 'back'),
        'UW': ('vowel', 'high', 'back'),
        # Consonants (manner, place, voicing)
        'B': ('stop', 'bilabial', 'voiced'),
        'CH': ('affricate', 'palatal', 'voiceless'),
        'D': ('stop', 'alveolar', 'voiced'),
        'DH': ('fricative', 'dental', 'voiced'),
        'F': ('fricative', 'labiodental', 'voiceless'),
        'G': ('stop', 'velar', 'voiced'),
        'HH': ('fricative', 'glottal', 'voiceless'),
        'JH': ('affricate', 'palatal', 'voiced'),
        'K': ('stop', 'velar', 'voiceless'),
        'L': ('liquid', 'alveolar', 'voiced'),
        'M': ('nasal', 'bilabial', 'voiced'),
        'N': ('nasal', 'alveolar', 'voiced'),
        'NG': ('nasal', 'velar', 'voiced'),
        'P': ('stop', 'bilabial', 'voiceless'),
        'R': ('liquid', 'alveolar', 'voiced'),
        'S': ('fricative', 'alveolar', 'voiceless'),
        'SH': ('fricative', 'palatal', 'voiceless'),
        'T': ('stop', 'alveolar', 'voiceless'),
        'TH': ('fricative', 'dental', 'voiceless'),
        'V': ('fricative', 'labiodental', 'voiced'),
        'W': ('glide', 'bilabial', 'voiced'),
        'Y': ('glide', 'palatal', 'voiced'),
        'Z': ('fricative', 'alveolar', 'voiced'),
        'ZH': ('fricative', 'palatal', 'voiced'),
    }
    
    def phoneme_distance(self, p1: str, p2: str) -> float:
        """Calculate distance between two phonemes (0=same, 1=very different)"""
        p1 = re.sub(r'\d+$', '', p1.upper())
        p2 = re.sub(r'\d+$', '', p2.upper())
        
        if p1 == p2:
            return 0.0
        
        f1 = self.PHONEME_FEATURES.get(p1)
        f2 = self.PHONEME_FEATURES.get(p2)
        
        if not f1 or not f2:
            return 0.8  # Unknown phoneme
        
        # Calculate feature-based distance
        distance = 0.0
        for i, (feat1, feat2) in enumerate(zip(f1, f2)):
            if feat1 != feat2:
                # Manner differences are more significant
                if i == 0:
                    distance += 0.5
                else:
                    distance += 0.25
        
        return min(distance, 1.0)
    
    def sequence_similarity(self, expected: List[str], actual: List[str]) -> float:
        """
        Calculate similarity between two phoneme sequences.
        Returns 0.0 to 1.0 where 1.0 is identical.
        """
        if not expected or not actual:
            return 0.0
        
        # Normalize phonemes
        expected = [re.sub(r'\d+$', '', p.upper()) for p in expected]
        actual = [re.sub(r'\d+$', '', p.upper()) for p in actual]
        
        # Use dynamic programming alignment
        m, n = len(expected), len(actual)
        dp = [[0.0] * (n + 1) for _ in range(m + 1)]
        
        # Initialize
        for i in range(m + 1):
            dp[i][0] = i
        for j in range(n + 1):
            dp[0][j] = j
        
        # Fill matrix
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                cost = self.phoneme_distance(expected[i-1], actual[j-1])
                dp[i][j] = min(
                    dp[i-1][j] + 1,      # deletion
                    dp[i][j-1] + 1,      # insertion
                    dp[i-1][j-1] + cost  # substitution
                )
        
        # Convert distance to similarity
        max_len = max(m, n)
        if max_len == 0:
            return 1.0
        
        distance = dp[m][n]
        similarity = 1.0 - (distance / max_len)
        return max(0.0, similarity)


# =============================================================================
# WAV2VEC2 PHONEME RECOGNIZER
# =============================================================================

class Wav2Vec2PhonemeRecognizer:
    """
    Uses wav2vec2 to recognize actual phonemes from audio.
    This gives us what was ACTUALLY spoken, not what ASR thinks was said.
    """
    
    def __init__(self):
        self.model = None
        self.processor = None
        self.vocab = None
        self._load_model()
    
    def _load_model(self):
        """Load wav2vec2 phoneme recognition model"""
        try:
            from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
            import torch
            
            # Use wav2vec2 phoneme model
            model_name = "facebook/wav2vec2-lv-60-espeak-cv-ft"
            
            print(f"Loading phoneme recognition model: {model_name}")
            self.processor = Wav2Vec2Processor.from_pretrained(model_name)
            self.model = Wav2Vec2ForCTC.from_pretrained(model_name)
            self.model.eval()
            
            # Get vocabulary for decoding
            self.vocab = self.processor.tokenizer.get_vocab()
            self.id_to_token = {v: k for k, v in self.vocab.items()}
            
            print(f"✓ Phoneme recognition model loaded")
            return True
            
        except Exception as e:
            print(f"⚠ Error loading wav2vec2 model: {e}")
            print("  Falling back to alternative method...")
            return False
    
    def recognize_phonemes(self, audio_path: str, start_time: float = None, 
                          end_time: float = None) -> List[str]:
        """
        Recognize phonemes from audio file or segment.
        
        Args:
            audio_path: Path to audio file
            start_time: Optional start time in seconds
            end_time: Optional end time in seconds
            
        Returns:
            List of IPA phonemes recognized from audio
        """
        if self.model is None:
            return self._fallback_recognize(audio_path, start_time, end_time)
        
        try:
            import torch
            import librosa
            
            # Load audio
            audio, sr = librosa.load(audio_path, sr=16000)
            
            # Extract segment if times provided
            if start_time is not None and end_time is not None:
                start_sample = int(start_time * sr)
                end_sample = int(end_time * sr)
                audio = audio[start_sample:end_sample]
            
            if len(audio) < 100:
                return []
            
            # Process audio
            inputs = self.processor(audio, sampling_rate=16000, return_tensors="pt", padding=True)
            
            with torch.no_grad():
                logits = self.model(inputs.input_values).logits
            
            # Decode to phonemes
            predicted_ids = torch.argmax(logits, dim=-1)
            phonemes = self.processor.batch_decode(predicted_ids)[0]
            
            # Convert IPA to ARPAbet-like format for comparison
            arpabet_phonemes = self._ipa_to_arpabet(phonemes)
            
            return arpabet_phonemes
            
        except Exception as e:
            print(f"⚠ Error in phoneme recognition: {e}")
            return self._fallback_recognize(audio_path, start_time, end_time)
    
    def _ipa_to_arpabet(self, ipa_string: str) -> List[str]:
        """Convert IPA phonemes to ARPAbet format"""
        # IPA to ARPAbet mapping (simplified)
        ipa_map = {
            'i': 'IY', 'ɪ': 'IH', 'e': 'EY', 'ɛ': 'EH', 'æ': 'AE',
            'ɑ': 'AA', 'ɔ': 'AO', 'o': 'OW', 'ʊ': 'UH', 'u': 'UW',
            'ʌ': 'AH', 'ə': 'AH', 'ɝ': 'ER', 'ɚ': 'ER',
            'aɪ': 'AY', 'aʊ': 'AW', 'ɔɪ': 'OY', 'eɪ': 'EY', 'oʊ': 'OW',
            'p': 'P', 'b': 'B', 't': 'T', 'd': 'D', 'k': 'K', 'ɡ': 'G',
            'tʃ': 'CH', 'dʒ': 'JH', 'f': 'F', 'v': 'V', 'θ': 'TH', 'ð': 'DH',
            's': 'S', 'z': 'Z', 'ʃ': 'SH', 'ʒ': 'ZH', 'h': 'HH',
            'm': 'M', 'n': 'N', 'ŋ': 'NG', 'l': 'L', 'ɹ': 'R', 'r': 'R',
            'w': 'W', 'j': 'Y',
        }
        
        phonemes = []
        ipa_string = ipa_string.replace(' ', '')
        
        i = 0
        while i < len(ipa_string):
            # Try two-character sequences first
            if i < len(ipa_string) - 1:
                digraph = ipa_string[i:i+2]
                if digraph in ipa_map:
                    phonemes.append(ipa_map[digraph])
                    i += 2
                    continue
            
            # Single character
            char = ipa_string[i]
            if char in ipa_map:
                phonemes.append(ipa_map[char])
            i += 1
        
        return phonemes
    
    def _fallback_recognize(self, audio_path: str, start_time: float = None,
                           end_time: float = None) -> List[str]:
        """Fallback phoneme recognition using acoustic analysis"""
        try:
            import librosa
            
            # Load audio
            audio, sr = librosa.load(audio_path, sr=16000)
            
            if start_time is not None and end_time is not None:
                start_sample = int(start_time * sr)
                end_sample = int(end_time * sr)
                audio = audio[start_sample:end_sample]
            
            # Use MFCC-based simple phoneme estimation
            mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13)
            
            # This is a placeholder - returns empty for fallback
            return []
            
        except Exception as e:
            return []


# =============================================================================
# WHISPER WORD-LEVEL ANALYZER
# =============================================================================

class WhisperWordAnalyzer:
    """
    Uses Whisper to get word-level timestamps and confidence scores.
    Low confidence often indicates pronunciation issues.
    """
    
    def __init__(self):
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """Load Whisper model"""
        try:
            import whisper
            print("Loading Whisper model for word analysis...")
            self.model = whisper.load_model("base")
            print("✓ Whisper model loaded")
        except Exception as e:
            print(f"⚠ Error loading Whisper: {e}")
    
    def analyze_audio(self, audio_path: str) -> List[Dict]:
        """
        Analyze audio and return word-level information.
        
        Returns list of dicts with:
        - word: transcribed word
        - start: start time
        - end: end time  
        - probability: confidence (low = possible mispronunciation)
        """
        if self.model is None:
            return []
        
        try:
            result = self.model.transcribe(
                audio_path,
                word_timestamps=True,
                language='en'
            )
            
            words = []
            for segment in result.get('segments', []):
                for word_info in segment.get('words', []):
                    words.append({
                        'word': word_info.get('word', '').strip(),
                        'start': word_info.get('start', 0),
                        'end': word_info.get('end', 0),
                        'probability': word_info.get('probability', 1.0)
                    })
            
            return words
            
        except Exception as e:
            print(f"⚠ Whisper analysis error: {e}")
            return []


# =============================================================================
# CMU DICTIONARY
# =============================================================================

class CMUDictionary:
    """CMU Pronouncing Dictionary handler"""
    
    def __init__(self):
        self.pronunciations = {}
        self._load()
    
    def _load(self):
        """Load CMU dictionary"""
        try:
            import nltk
            try:
                from nltk.corpus import cmudict
                cmu = cmudict.dict()
                self.pronunciations = {
                    word: [[re.sub(r'\d+$', '', p) for p in pron] for pron in prons]
                    for word, prons in cmu.items()
                }
                print(f"✓ CMU dictionary loaded ({len(self.pronunciations)} words)")
            except LookupError:
                nltk.download('cmudict', quiet=True)
                from nltk.corpus import cmudict
                cmu = cmudict.dict()
                self.pronunciations = {
                    word: [[re.sub(r'\d+$', '', p) for p in pron] for pron in prons]
                    for word, prons in cmu.items()
                }
        except Exception as e:
            print(f"⚠ Error loading CMU dictionary: {e}")
    
    def get_phonemes(self, word: str) -> Optional[List[str]]:
        """Get expected phonemes for a word"""
        word = word.lower().strip()
        word = re.sub(r'[^\w\'-]', '', word)
        if word in self.pronunciations:
            return self.pronunciations[word][0]
        return None
    
    def get_all_variants(self, word: str) -> List[List[str]]:
        """Get all pronunciation variants"""
        word = word.lower().strip()
        word = re.sub(r'[^\w\'-]', '', word)
        return self.pronunciations.get(word, [])


# =============================================================================
# ENHANCED PRONUNCIATION DETECTOR
# =============================================================================

class EnhancedPronunciationDetector:
    """
    Enhanced pronunciation detector that combines:
    1. Wav2vec2 phoneme recognition (actual spoken phonemes)
    2. Whisper word-level confidence
    3. CMU dictionary comparison
    4. Phonetic distance analysis
    """
    
    # Common function words to skip
    SKIP_WORDS = {
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'it', 'its', 'as', 'if', 'so', 'up', 'out', 'do', 'by', 'i', 'you',
        'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their',
        'this', 'that', 'these', 'those', 'here', 'there', 'when', 'where',
        'what', 'who', 'how', 'why', 'all', 'each', 'every', 'both', 'few',
        'more', 'most', 'some', 'any', 'no', 'not', 'only', 'own', 'same',
        'than', 'too', 'very', 'just', 'also', 'now', 'will', 'can', 'could',
        'would', 'should', 'may', 'might', 'must', 'shall'
    }
    
    def __init__(self):
        self.cmu = CMUDictionary()
        self.distance_calc = PhonemeDistanceCalculator()
        self.phoneme_recognizer = Wav2Vec2PhonemeRecognizer()
        self.whisper_analyzer = WhisperWordAnalyzer()
    
    def detect_errors(self, audio_path: str, transcript_path: str, 
                     user_id: str) -> List[EnhancedPronunciationError]:
        """
        Detect pronunciation errors by comparing:
        1. Expected phonemes (from CMU dictionary)
        2. Actual phonemes (from wav2vec2 audio analysis)
        3. Whisper confidence scores
        """
        errors = []
        
        # Load transcript
        with open(transcript_path, 'r', encoding='utf-8') as f:
            transcript = f.read().strip()
        
        if not transcript:
            return errors
        
        print(f"   Analyzing audio with Whisper...")
        whisper_words = self.whisper_analyzer.analyze_audio(audio_path)
        
        if not whisper_words:
            print(f"   ⚠ No words from Whisper, using transcript only")
            # Fall back to transcript words without timing
            words = transcript.split()
            for word in words:
                clean_word = re.sub(r'[^\w\'-]', '', word).lower()
                if clean_word and clean_word not in self.SKIP_WORDS:
                    expected = self.cmu.get_phonemes(clean_word)
                    if expected:
                        # Without timing, we can only do basic analysis
                        pass
            return errors
        
        print(f"   Found {len(whisper_words)} words with timestamps")
        print(f"   Analyzing phonemes from audio segments...")
        
        # Analyze each word
        analyzed_count = 0
        for word_info in whisper_words:
            word = word_info['word'].strip()
            clean_word = re.sub(r'[^\w\'-]', '', word).lower()
            
            # Skip function words and short words
            if not clean_word or clean_word in self.SKIP_WORDS or len(clean_word) < 3:
                continue
            
            # Get expected phonemes from CMU
            expected_phonemes = self.cmu.get_phonemes(clean_word)
            if not expected_phonemes:
                continue
            
            # Get actual phonemes from audio segment
            actual_phonemes = self.phoneme_recognizer.recognize_phonemes(
                audio_path,
                start_time=word_info['start'],
                end_time=word_info['end']
            )
            
            # Calculate phoneme similarity
            if actual_phonemes:
                similarity = self.distance_calc.sequence_similarity(
                    expected_phonemes, actual_phonemes
                )
            else:
                # Use Whisper probability as proxy
                similarity = word_info.get('probability', 1.0)
            
            # Determine if there's an error
            whisper_prob = word_info.get('probability', 1.0)
            
            # Multiple criteria for error detection:
            # 1. Low phoneme similarity (actual vs expected)
            # 2. Low Whisper confidence
            # 3. Phoneme count mismatch
            
            is_error = False
            error_details = []
            
            # Check phoneme similarity
            if actual_phonemes and similarity < 0.7:
                is_error = True
                error_details.append(f"Phoneme similarity: {similarity:.2f}")
            
            # Check Whisper confidence
            if whisper_prob < 0.8:
                is_error = True
                error_details.append(f"Low confidence: {whisper_prob:.2f}")
            
            # Check phoneme count difference
            if actual_phonemes:
                count_diff = abs(len(expected_phonemes) - len(actual_phonemes))
                if count_diff >= 2:
                    is_error = True
                    error_details.append(f"Phoneme count diff: {count_diff}")
            
            # Check for specific phoneme patterns that indicate errors
            if actual_phonemes and expected_phonemes:
                # Check for missing phonemes
                missing = self._find_missing_phonemes(expected_phonemes, actual_phonemes)
                if missing:
                    is_error = True
                    error_details.append(f"Missing: {', '.join(missing)}")
                
                # Check for substituted phonemes
                substituted = self._find_substitutions(expected_phonemes, actual_phonemes)
                if substituted:
                    is_error = True
                    error_details.append(f"Substituted: {', '.join(substituted)}")
            
            if is_error:
                # Determine severity
                if similarity < 0.5 or whisper_prob < 0.6:
                    severity = "high"
                elif similarity < 0.7 or whisper_prob < 0.75:
                    severity = "medium"
                else:
                    severity = "low"
                
                # Determine error type
                if actual_phonemes:
                    if len(actual_phonemes) < len(expected_phonemes) - 1:
                        error_type = "deletion"
                    elif len(actual_phonemes) > len(expected_phonemes) + 1:
                        error_type = "insertion"
                    else:
                        error_type = "substitution"
                else:
                    error_type = "unclear_pronunciation"
                
                errors.append(EnhancedPronunciationError(
                    user_id=user_id,
                    word=clean_word,
                    transcript_word=word,
                    expected_phonemes=expected_phonemes,
                    actual_phonemes=actual_phonemes,
                    phoneme_similarity=similarity,
                    error_type=error_type,
                    severity=severity,
                    confidence=1.0 - similarity if actual_phonemes else 1.0 - whisper_prob,
                    start_time=word_info['start'],
                    end_time=word_info['end'],
                    details="; ".join(error_details)
                ))
                analyzed_count += 1
        
        print(f"   Detected {len(errors)} pronunciation errors")
        return errors
    
    def _find_missing_phonemes(self, expected: List[str], actual: List[str]) -> List[str]:
        """Find phonemes that are in expected but missing from actual"""
        expected_set = set(p.upper() for p in expected)
        actual_set = set(p.upper() for p in actual)
        return list(expected_set - actual_set)
    
    def _find_substitutions(self, expected: List[str], actual: List[str]) -> List[str]:
        """Find obvious phoneme substitutions"""
        substitutions = []
        
        # Simple alignment comparison
        min_len = min(len(expected), len(actual))
        for i in range(min_len):
            exp = expected[i].upper()
            act = actual[i].upper() if i < len(actual) else None
            
            if act and exp != act:
                distance = self.distance_calc.phoneme_distance(exp, act)
                if distance > 0.3:  # Significant difference
                    substitutions.append(f"{exp}→{act}")
        
        return substitutions[:3]  # Limit to top 3


# =============================================================================
# MAIN PIPELINE
# =============================================================================

class EnhancedPronunciationPipeline:
    """
    Complete pipeline for enhanced pronunciation detection.
    """
    
    def __init__(self):
        self.detector = EnhancedPronunciationDetector()
    
    def process_participant(self, audio_path: str, transcript_path: str,
                           user_id: str, output_dir: str) -> Dict:
        """Process a single participant's audio and transcript."""
        print(f"\n{'='*60}")
        print(f"Processing: {user_id}")
        print(f"{'='*60}")
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Check files exist
        if not Path(audio_path).exists():
            return {"error": "Audio file not found", "user_id": user_id}
        
        if not Path(transcript_path).exists():
            return {"error": "Transcript file not found", "user_id": user_id}
        
        # Load transcript for word count
        with open(transcript_path, 'r', encoding='utf-8') as f:
            transcript = f.read().strip()
        
        if len(transcript) < 5:
            return {
                "user_id": user_id,
                "errors_detected": 0,
                "errors": [],
                "note": "Transcript too short"
            }
        
        # Detect errors
        errors = self.detector.detect_errors(audio_path, transcript_path, user_id)
        
        # Prepare results
        result = {
            "user_id": user_id,
            "audio_file": str(audio_path),
            "transcript_file": str(transcript_path),
            "total_words": len(transcript.split()),
            "errors_detected": len(errors),
            "accuracy": 1.0 - (len(errors) / max(len(transcript.split()), 1)),
            "errors": [asdict(e) for e in errors]
        }
        
        # Save results
        output_file = output_path / f"{user_id}_enhanced_pronunciation.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        
        print(f"\n✓ Results saved: {output_file}")
        print(f"  Errors found: {len(errors)}")
        
        return result
    
    def process_meeting(self, meeting_folder: str) -> Dict:
        """Process all participants in a meeting folder."""
        meeting_path = Path(meeting_folder)
        print(f"\n{'#'*60}")
        print(f"ENHANCED PRONUNCIATION DETECTION: {meeting_path.name}")
        print(f"{'#'*60}")
        
        # Find participant transcripts
        transcript_folder = meeting_path / "participant_transcripts"
        if not transcript_folder.exists():
            return {"error": "No transcripts found"}
        
        results = {
            "meeting": meeting_path.name,
            "participants": {},
            "summary": {}
        }
        
        # Process each participant
        for transcript_file in transcript_folder.glob("*.txt"):
            user_id = transcript_file.stem
            
            # Skip summary files
            if 'summary' in user_id.lower() or user_id.startswith('_'):
                continue
            
            # Find audio file
            audio_file = self._find_audio_file(meeting_path, user_id)
            if not audio_file:
                print(f"\n⚠ No audio found for {user_id}")
                continue
            
            # Process
            result = self.process_participant(
                str(audio_file),
                str(transcript_file),
                user_id,
                str(transcript_folder)
            )
            
            results["participants"][user_id] = result
        
        # Generate summary
        total_words = sum(p.get("total_words", 0) for p in results["participants"].values())
        total_errors = sum(p.get("errors_detected", 0) for p in results["participants"].values())
        
        results["summary"] = {
            "total_participants": len(results["participants"]),
            "total_words": total_words,
            "total_errors": total_errors,
            "overall_accuracy": 1.0 - (total_errors / max(total_words, 1))
        }
        
        # Save summary
        summary_file = transcript_folder / "enhanced_pronunciation_summary.json"
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"Participants: {results['summary']['total_participants']}")
        print(f"Total errors: {results['summary']['total_errors']}")
        print(f"\n✓ Summary saved: {summary_file}")
        
        return results
    
    def _find_audio_file(self, meeting_path: Path, user_id: str) -> Optional[Path]:
        """Find audio file for a user"""
        # Try direct match
        for ext in ['.wav', '.mp3', '.flac']:
            direct = meeting_path / f"{user_id}{ext}"
            if direct.exists():
                return direct
        
        # Try patterns
        patterns = [
            f"*{user_id}*.wav",
            f"*{user_id.lower()}*.wav",
            f"*{user_id}*_converted.wav",
        ]
        
        for pattern in patterns:
            matches = list(meeting_path.glob(pattern))
            if matches:
                return matches[0]
        
        return None


# =============================================================================
# MAIN
# =============================================================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced Pronunciation Detection")
    parser.add_argument('meeting', nargs='?', help='Meeting folder to process')
    parser.add_argument('--audio', help='Single audio file')
    parser.add_argument('--transcript', help='Single transcript file')
    parser.add_argument('--user', help='User ID')
    parser.add_argument('--output', default='output', help='Output directory')
    
    args = parser.parse_args()
    
    pipeline = EnhancedPronunciationPipeline()
    
    if args.meeting:
        pipeline.process_meeting(args.meeting)
    elif args.audio and args.transcript:
        user_id = args.user or Path(args.audio).stem
        pipeline.process_participant(args.audio, args.transcript, user_id, args.output)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
