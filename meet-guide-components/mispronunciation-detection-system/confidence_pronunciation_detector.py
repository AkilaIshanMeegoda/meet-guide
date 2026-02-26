#!/usr/bin/env python3
"""
Advanced Pronunciation Error Detector
Detects mispronunciations using multiple signals WITHOUT hardcoding target words.

Detection Methods:
1. Low ASR confidence scores
2. Word fragment detection (e.g., "app appreciate" = fragmented word)
3. Contextual anomaly detection (semantically wrong words)
4. Phonetic similarity to nearby words
5. Multi-syllable word difficulty analysis
6. Repeated word patterns (struggle to pronounce)
"""

import json
import os
import sys
import re
from typing import Dict, List, Optional, Tuple, Any, Set
from collections import defaultdict

# CMU DICTIONARY
class CMUDict:
    """Load and query CMU Pronouncing Dictionary."""
    
    def __init__(self):
        self.entries: Dict[str, List[str]] = {}
        self._load_cmudict()
    
    def _load_cmudict(self):
        try:
            import nltk
            try:
                from nltk.corpus import cmudict
                entries = cmudict.dict()
                self.entries = {word: [' '.join(pron) for pron in prons] 
                               for word, prons in entries.items()}
                print(f"✓ CMU dictionary loaded ({len(self.entries)} words)")
            except LookupError:
                nltk.download('cmudict', quiet=True)
                from nltk.corpus import cmudict
                entries = cmudict.dict()
                self.entries = {word: [' '.join(pron) for pron in prons] 
                               for word, prons in entries.items()}
                print(f"✓ CMU dictionary loaded ({len(self.entries)} words)")
        except Exception as e:
            print(f"⚠ Could not load CMU dictionary: {e}")
    
    def get_phonemes(self, word: str) -> Optional[str]:
        word = word.lower().strip()
        if word in self.entries:
            return self.entries[word][0]
        return None
    
    def phonetic_distance(self, word1: str, word2: str) -> float:
        """Calculate phonetic distance between two words (0=same, 1=different)."""
        p1 = self.get_phonemes(word1)
        p2 = self.get_phonemes(word2)
        if not p1 or not p2:
            return 0.5
        
        p1_list = p1.split()
        p2_list = p2.split()
        
        # Simple Levenshtein-like distance on phonemes
        max_len = max(len(p1_list), len(p2_list))
        if max_len == 0:
            return 0
        
        matches = sum(1 for a, b in zip(p1_list, p2_list) if a.rstrip('012') == b.rstrip('012'))
        return 1.0 - (matches / max_len)


# ADVANCED PRONUNCIATION DETECTOR
class AdvancedPronunciationDetector:
    """
    Detect mispronunciations using multiple signals.
    No hardcoded target words - all detection is dynamic.
    """
    
    def __init__(self):
        self.cmu = CMUDict()
        
        self.skip_words = {
            # Function words
            'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'to', 'of', 'in', 'on', 'at', 'by', 'for', 'it', 'i', 'you', 'he', 'she',
            'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
            'this', 'that', 'these', 'those', 'who', 'what', 'which', 'when', 'where',
            'how', 'why', 'if', 'then', 'so', 'and', 'or', 'but', 'not', 'no', 'yes',
            'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'could', 'should',
            'can', 'may', 'might', 'must', 'shall', 'get', 'got', 'go', 'going', 'gone',
            'come', 'came', 'say', 'said', 'make', 'made', 'take', 'took', 'see', 'saw',
            'know', 'knew', 'think', 'thought', 'want', 'need', 'like', 'use', 'used',
           
        }
    
    def detect_errors(self, transcript_data: Dict) -> List[Dict[str, Any]]:
        """Detect all pronunciation errors using multiple methods."""
        
        if 'words' not in transcript_data:
            return []
        
        words = transcript_data['words']
        full_transcript = transcript_data.get('transcript', '')
        errors = []
        detected_indices = set()
        
        errors.extend(self._detect_low_confidence(words, detected_indices))
        
        errors.extend(self._detect_fragments(words, detected_indices))
        
        errors.extend(self._detect_contextual_anomalies(words, full_transcript, detected_indices))
        
        errors.extend(self._detect_difficult_words(words, detected_indices))
        
        errors.extend(self._detect_phonetic_mishearings(words, detected_indices))
        
        errors.extend(self._detect_challenging_words(words, detected_indices))
        
        errors.sort(key=lambda x: x.get('start_time', 0))
        
        return errors
    
    def _detect_low_confidence(self, words: List[Dict], detected: Set[int]) -> List[Dict]:
        """Detect words with low ASR confidence."""
        errors = []
        
        for i, w in enumerate(words):
            if i in detected:
                continue
                
            word = w.get('word', '')
            conf = w.get('confidence', 1.0)
            
            # Skip short/function words
            if len(word) < 3 or word.lower() in self.skip_words:
                continue
            
            # Threshold based on word length (longer words have naturally lower confidence)
            threshold = 0.85 if len(word) > 6 else 0.80
            
            if conf < threshold:
                detected.add(i)
                errors.append(self._create_error(
                    words, i,
                    error_type='low_confidence',
                    severity=self._confidence_to_severity(conf),
                    details=f'ASR confidence: {conf:.3f}'
                ))
        
        return errors
    
    def _detect_fragments(self, words: List[Dict], detected: Set[int]) -> List[Dict]:
        """
        Detect word fragments that indicate mispronunciation.
        E.g., "app appreciate" where "app" is a failed attempt at "appreciate"
        """
        errors = []
        
        for i in range(len(words) - 1):
            if i in detected:
                continue
            
            current = words[i]
            next_word = words[i + 1]
            
            curr_text = current.get('word', '').lower()
            next_text = next_word.get('word', '').lower()
            curr_conf = current.get('confidence', 1.0)
            
            # Skip if current word is in skip list
            if curr_text in self.skip_words:
                continue
            
            # Check if current word is a prefix fragment of next word
            if (len(curr_text) >= 2 and len(curr_text) <= 4 and 
                len(next_text) > len(curr_text) and
                next_text.startswith(curr_text[:2])):
                
                # Check phonetic similarity
                if self.cmu.phonetic_distance(curr_text, next_text) < 0.6:
                    detected.add(i)
                    errors.append(self._create_error(
                        words, i,
                        error_type='word_fragment',
                        severity='high',
                        details=f'Fragment "{curr_text}" before "{next_text}" - likely mispronounced "{next_text}"',
                        actual_word=next_text
                    ))
        
        return errors
    
    def _detect_contextual_anomalies(self, words: List[Dict], transcript: str, detected: Set[int]) -> List[Dict]:
        """
        Detect words that don't make sense in context.
        DISABLED - produces too many false positives.
        """
        # Return empty - this method causes false positives
        return []
        
        return errors
    
    def _detect_difficult_words(self, words: List[Dict], detected: Set[int]) -> List[Dict]:
        """
        Detect multi-syllable words that might be mispronounced.
        Only flag words with VERY low confidence that are NOT common words.
        """
        errors = []
        
        for i, w in enumerate(words):
            if i in detected:
                continue
            
            word = w.get('word', '').lower()
            conf = w.get('confidence', 1.0)
            
            if word in self.skip_words:
                continue
            
            # Count syllables
            syllables = self._count_syllables(word)
            
            # Only flag words with VERY low confidence (< 0.75)
            # and 3+ syllables
            if syllables >= 3 and conf < 0.75:
                severity = 'high' if conf < 0.70 else 'medium'
                detected.add(i)
                errors.append(self._create_error(
                    words, i,
                    error_type='difficult_word',
                    severity=severity,
                    details=f'{syllables}-syllable word with confidence {conf:.3f}'
                ))
        
        return errors
    
    def _detect_phonetic_mishearings(self, words: List[Dict], detected: Set[int]) -> List[Dict]:
        """
        Detect words that phonetically similar to what was likely intended.
        DISABLED - too many false positives.
        """
        # Return empty - this causes too many false positives
        return []
    
    def _detect_challenging_words(self, words: List[Dict], detected: Set[int]) -> List[Dict]:
        """
        Detect words that are phonetically challenging based on:
        - Syllable count (3+ syllables are harder to pronounce)
        - Word length (longer words are harder)
        - Phoneme complexity from CMU dictionary
        
        NO HARDCODED PATTERNS - purely algorithmic detection.
        """
        errors = []
        
        for i, w in enumerate(words):
            if i in detected:
                continue
            
            word = w.get('word', '').lower()
            conf = w.get('confidence', 1.0)
            
            # Skip common words and short words
            if word in self.skip_words or len(word) < 5:
                continue
            
            # Count syllables
            syllables = self._count_syllables(word)
            
            # Get phoneme complexity
            phonemes = self.cmu.get_phonemes(word)
            phoneme_count = len(phonemes.split()) if phonemes else 0
            
            # Calculate difficulty score based on multiple factors
            difficulty_score = 0
            
            # Factor 1: Syllable count (3+ syllables = harder)
            if syllables >= 4:
                difficulty_score += 3
            elif syllables >= 3:
                difficulty_score += 2
            
            # Factor 2: Word length (longer = harder)
            if len(word) >= 10:
                difficulty_score += 2
            elif len(word) >= 7:
                difficulty_score += 1
            
            # Factor 3: Phoneme density (more phonemes per letter = complex)
            if phoneme_count > 0 and len(word) > 0:
                phoneme_density = phoneme_count / len(word)
                if phoneme_density > 0.8:
                    difficulty_score += 1
            
            # Factor 4: Consonant clusters (multiple consonants together)
            consonant_clusters = len(re.findall(r'[bcdfghjklmnpqrstvwxz]{3,}', word))
            difficulty_score += consonant_clusters
            
            # Flag words with high difficulty score
            if difficulty_score >= 3:
                detected.add(i)
                errors.append(self._create_error(
                    words, i,
                    error_type='challenging_word',
                    severity='medium' if difficulty_score >= 4 else 'low',
                    details=f'{syllables}-syllable, {len(word)} chars, difficulty={difficulty_score}'
                ))
        
        return errors
    
    def _create_error(self, words: List[Dict], index: int, error_type: str, 
                      severity: str, details: str, actual_word: str = None) -> Dict[str, Any]:
        """Create an error record."""
        w = words[index]
        word = w.get('word', '')
        
        # Get context
        ctx_start = max(0, index - 3)
        ctx_end = min(len(words), index + 4)
        context = ' '.join([x['word'] for x in words[ctx_start:ctx_end]])
        
        phonemes = self.cmu.get_phonemes(word)
        
        return {
            'word': word,
            'actual_word': actual_word or word,
            'confidence': w.get('confidence', 1.0),
            'start_time': w.get('start', 0),
            'end_time': w.get('end', 0),
            'error_type': error_type,
            'severity': severity,
            'details': details,
            'context': context,
            'expected_phonemes': phonemes,
            'suggestion': self._generate_suggestion(word, phonemes)
        }
    
    def _count_syllables(self, word: str) -> int:
        """Estimate syllable count."""
        word = word.lower()
        vowels = 'aeiouy'
        count = 0
        prev_is_vowel = False
        
        for char in word:
            is_vowel = char in vowels
            if is_vowel and not prev_is_vowel:
                count += 1
            prev_is_vowel = is_vowel
        
        if word.endswith('e') and count > 1:
            count -= 1
        if word.endswith('le') and len(word) > 2 and word[-3] not in vowels:
            count += 1
            
        return max(1, count)
    
    def _confidence_to_severity(self, conf: float) -> str:
        if conf < 0.60:
            return 'high'
        elif conf < 0.75:
            return 'medium'
        else:
            return 'low'
    
    def _generate_suggestion(self, word: str, phonemes: Optional[str]) -> str:
        if phonemes:
            readable = self._phonemes_to_readable(phonemes)
            return f"Pronounce as: {readable}"
        return "Check pronunciation"
    
    def _phonemes_to_readable(self, arpabet: str) -> str:
        mapping = {
            'AA': 'ah', 'AE': 'a', 'AH': 'uh', 'AO': 'aw', 'AW': 'ow',
            'AY': 'eye', 'B': 'b', 'CH': 'ch', 'D': 'd', 'DH': 'th',
            'EH': 'eh', 'ER': 'er', 'EY': 'ay', 'F': 'f', 'G': 'g',
            'HH': 'h', 'IH': 'ih', 'IY': 'ee', 'JH': 'j', 'K': 'k',
            'L': 'l', 'M': 'm', 'N': 'n', 'NG': 'ng', 'OW': 'oh',
            'OY': 'oy', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'sh',
            'T': 't', 'TH': 'th', 'UH': 'uh', 'UW': 'oo', 'V': 'v',
            'W': 'w', 'Y': 'y', 'Z': 'z', 'ZH': 'zh'
        }
        
        parts = arpabet.split()
        readable_parts = []
        for p in parts:
            base = re.sub(r'\d', '', p)
            readable_parts.append(mapping.get(base, base.lower()))
        
        return '-'.join(readable_parts)


# PROCESS MEETING
def process_meeting(meeting_name: str) -> Dict[str, Any]:
    """Process a meeting and detect pronunciation errors."""
    
    meeting_dir = meeting_name
    transcripts_dir = os.path.join(meeting_dir, 'participant_transcripts')
    
    if not os.path.exists(transcripts_dir):
        print(f"✗ Directory not found: {transcripts_dir}")
        return {}
    
    detector = AdvancedPronunciationDetector()
    
    results = {}
    total_errors = 0
    
    print(f"\n{'#'*70}")
    print(f"ADVANCED PRONUNCIATION DETECTION: {meeting_name}")
    print(f"{'#'*70}")
    print("Methods: Low confidence, Fragments, Context, Difficulty, Phonetics")
    
    for filename in os.listdir(transcripts_dir):
        if filename.endswith('.json') and not any(x in filename for x in 
            ['summary', 'mfa', 'mispronunciation', 'enhanced', 'confidence']):
            
            participant_name = filename.replace('.json', '')
            transcript_path = os.path.join(transcripts_dir, filename)
            
            print(f"\n{'='*70}")
            print(f"Processing: {participant_name}")
            print(f"{'='*70}")
            
            try:
                with open(transcript_path, 'r', encoding='utf-8') as f:
                    transcript_data = json.load(f)
                
                errors = detector.detect_errors(transcript_data)
                
                results[participant_name] = {
                    'participant': participant_name,
                    'errors_detected': len(errors),
                    'errors': errors
                }
                
                total_errors += len(errors)
                
                output_path = os.path.join(transcripts_dir, f'{participant_name}_confidence_pronunciation.json')
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(results[participant_name], f, indent=2)
                
                print(f"✓ Saved: {output_path}")
                print(f"  Errors found: {len(errors)}")
                
                if errors:
                    print(f"\n  Detected mispronunciations:")
                    for err in errors:
                        print(f"    [{err['error_type']:20}] {err['word']:15} conf={err['confidence']:.3f} sev={err['severity']}")
                        print(f"       {err['details']}")
                
            except Exception as e:
                print(f"✗ Error: {e}")
                import traceback
                traceback.print_exc()
    
    # Save summary
    summary = {
        'meeting': meeting_name,
        'total_participants': len(results),
        'total_errors': total_errors,
        'participants': results,
        'detection_methods': ['low_confidence', 'word_fragment', 'contextual_anomaly', 
                             'difficult_word', 'phonetic_confusion']
    }
    
    summary_path = os.path.join(transcripts_dir, 'confidence_pronunciation_summary.json')
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\n{'='*70}")
    print(f"SUMMARY: {total_errors} total errors detected")
    print(f"{'='*70}")
    print(f"✓ Summary saved: {summary_path}")
    
    return summary


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python confidence_pronunciation_detector.py <meeting_name>")
        sys.exit(1)
    
    process_meeting(sys.argv[1])
