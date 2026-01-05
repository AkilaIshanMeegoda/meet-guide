"""
==============================================================================
MFA-BASED PRONUNCIATION ERROR DETECTION SYSTEM
==============================================================================

This module implements a research-grade pronunciation error detection pipeline
using Montreal Forced Aligner (MFA) for accurate phoneme-level analysis.

WHY FORCED ALIGNMENT (MFA) INSTEAD OF ASR-BASED DETECTION?
-----------------------------------------------------------
1. ACCURACY: ASR models like wav2vec2 are trained to RECOGNIZE speech, not to
   evaluate pronunciation quality. They may "correct" mispronunciations during
   recognition, missing the actual errors.

2. GROUND TRUTH ALIGNMENT: MFA uses the known transcript to force-align the
   audio, giving us the actual phoneme realizations against expected phonemes.

3. PHONEME BOUNDARIES: MFA provides precise timestamps for each phoneme,
   enabling detailed temporal analysis of pronunciation.

4. RESEARCH STANDARD: Forced alignment is the gold standard in phonetics
   research and L2 pronunciation studies.

5. NO RECOGNITION BIAS: Unlike ASR, MFA doesn't guess what was said - it
   aligns what was SUPPOSED to be said with acoustic evidence.

PIPELINE OVERVIEW:
------------------
1. Prepare input data (audio + transcript) for MFA
2. Run MFA forced alignment to get TextGrid output
3. Parse TextGrid to extract word and phoneme alignments
4. Compare observed phonemes with CMU dictionary expected phonemes
5. Classify errors by type (substitution, deletion, insertion)
6. Assign severity levels based on phonetic distance
7. Output structured JSON with full context

Author: Research Team
Date: December 2025
"""

import os
import json
import subprocess
import shutil
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import tempfile


# =============================================================================
# DATA STRUCTURES
# =============================================================================

class ErrorType(Enum):
    """Classification of pronunciation error types"""
    SUBSTITUTION = "substitution"  # Different phoneme produced
    DELETION = "deletion"          # Phoneme was omitted
    INSERTION = "insertion"        # Extra phoneme added
    CORRECT = "correct"            # No error


class Severity(Enum):
    """Severity levels for pronunciation errors"""
    LOW = "low"        # Minor vowel shifts, acceptable variation
    MEDIUM = "medium"  # Consonant substitutions, noticeable errors
    HIGH = "high"      # Dropped phonemes, multiple errors, unintelligible


@dataclass
class PhonemeAlignment:
    """Represents a single phoneme alignment from MFA"""
    phoneme: str
    start_time: float
    end_time: float
    
    
@dataclass
class WordAlignment:
    """Represents word-level alignment with phoneme details"""
    word: str
    start_time: float
    end_time: float
    phonemes: List[PhonemeAlignment]


@dataclass
class PronunciationError:
    """Represents a detected pronunciation error"""
    user_id: str
    word: str
    expected_phonemes: List[str]
    observed_phonemes: List[str]
    error_type: str
    severity: str
    start_time: float
    end_time: float
    context: str = ""
    details: str = ""


# =============================================================================
# CMU DICTIONARY HANDLER
# =============================================================================

# Common function words to skip in pronunciation error detection
SKIP_WORDS = {
    'on', 'the', 'and', 'can', 'to', 'all', 'for', 
    'a', 'an', 'in', 'at', 'of', 'or', 'is', 'are', 
    'was', 'were', 'be', 'been', 'by', 'it', 'as',
    'if', 'but', 'not', 'so', 'up', 'out', 'do'
}

class CMUDictionary:
    """
    Handles CMU Pronouncing Dictionary for canonical pronunciations.
    
    The CMU dictionary provides standard American English pronunciations
    using ARPAbet phoneme notation. This serves as our ground truth for
    expected pronunciations.
    """
    
    def __init__(self, dict_path: Optional[str] = None):
        self.pronunciations: Dict[str, List[List[str]]] = {}
        self._load_dictionary(dict_path)
    
    def _load_dictionary(self, dict_path: Optional[str] = None):
        """Load CMU dictionary from file or download if needed"""
        if dict_path and Path(dict_path).exists():
            self._parse_dict_file(dict_path)
        else:
            # Try to use NLTK's CMU dict
            try:
                import nltk
                try:
                    from nltk.corpus import cmudict
                    cmu = cmudict.dict()
                    self.pronunciations = {
                        word: [self._normalize_phonemes(pron) for pron in prons]
                        for word, prons in cmu.items()
                    }
                    print(f"✓ Loaded CMU dictionary ({len(self.pronunciations)} words)")
                except LookupError:
                    print("Downloading CMU dictionary...")
                    nltk.download('cmudict', quiet=True)
                    from nltk.corpus import cmudict
                    cmu = cmudict.dict()
                    self.pronunciations = {
                        word: [self._normalize_phonemes(pron) for pron in prons]
                        for word, prons in cmu.items()
                    }
                    print(f"✓ Loaded CMU dictionary ({len(self.pronunciations)} words)")
            except ImportError:
                print("⚠ NLTK not available, using minimal dictionary")
                self.pronunciations = {}
    
    def _parse_dict_file(self, path: str):
        """Parse a CMU-format dictionary file"""
        with open(path, 'r', encoding='latin-1') as f:
            for line in f:
                if line.startswith(';;;') or not line.strip():
                    continue
                parts = line.strip().split('  ')
                if len(parts) >= 2:
                    word = parts[0].lower()
                    # Remove variant number (e.g., "WORD(2)")
                    word = re.sub(r'\(\d+\)$', '', word)
                    phonemes = self._normalize_phonemes(parts[1].split())
                    if word not in self.pronunciations:
                        self.pronunciations[word] = []
                    self.pronunciations[word].append(phonemes)
    
    def _normalize_phonemes(self, phonemes: List[str]) -> List[str]:
        """Normalize phoneme notation (remove stress markers for comparison)"""
        return [re.sub(r'\d+$', '', p.upper()) for p in phonemes]
    
    def get_pronunciation(self, word: str) -> Optional[List[str]]:
        """Get the primary pronunciation for a word"""
        word = word.lower().strip()
        word = re.sub(r'[^\w\'-]', '', word)
        if word in self.pronunciations:
            return self.pronunciations[word][0]
        return None
    
    def get_all_pronunciations(self, word: str) -> List[List[str]]:
        """Get all valid pronunciations for a word"""
        word = word.lower().strip()
        word = re.sub(r'[^\w\'-]', '', word)
        return self.pronunciations.get(word, [])


# =============================================================================
# MFA INTERFACE
# =============================================================================

class MFAAligner:
    """
    Interface to Montreal Forced Aligner for audio-text alignment.
    
    MFA is a forced alignment tool that:
    1. Takes audio + transcript as input
    2. Uses acoustic models to find where each word/phoneme occurs
    3. Outputs TextGrid files with precise timestamps
    
    This is fundamentally different from ASR which tries to GUESS what
    was said. MFA KNOWS what was said and finds WHERE it was said.
    """
    
    def __init__(self, acoustic_model: str = "english_us_arpa", 
                 dictionary: str = "english_us_arpa"):
        self.acoustic_model = acoustic_model
        self.dictionary = dictionary
        self.mfa_available = self._check_mfa()
        
    def _check_mfa(self) -> bool:
        """Check if MFA is installed and available"""
        try:
            result = subprocess.run(['mfa', 'version'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                print(f"✓ MFA available: {result.stdout.strip()}")
                return True
        except (subprocess.SubprocessError, FileNotFoundError):
            pass
        print("⚠ MFA not found. Install with: conda install -c conda-forge montreal-forced-aligner")
        return False
    
    def download_models(self):
        """Download required MFA models"""
        if not self.mfa_available:
            return False
        try:
            print("Downloading MFA acoustic model...")
            subprocess.run(['mfa', 'model', 'download', 'acoustic', 'english_mfa'],
                         capture_output=True, timeout=300)
            print("Downloading MFA dictionary...")
            subprocess.run(['mfa', 'model', 'download', 'dictionary', 'english_mfa'],
                         capture_output=True, timeout=300)
            return True
        except subprocess.SubprocessError as e:
            print(f"⚠ Error downloading models: {e}")
            return False
    
    def _validate_inputs(self, audio_path: Path, transcript_path: Path) -> Tuple[bool, str]:
        """Validate audio and transcript files before MFA processing"""
        # Check if files exist
        if not audio_path.exists():
            return False, f"Audio file not found: {audio_path}"
        if not transcript_path.exists():
            return False, f"Transcript file not found: {transcript_path}"
        
        # Check transcript is not empty
        transcript_size = transcript_path.stat().st_size
        if transcript_size == 0:
            return False, "Transcript file is empty"
        
        with open(transcript_path, 'r', encoding='utf-8') as f:
            text = f.read().strip()
        if len(text) < 5:
            return False, "Transcript text too short (< 5 characters)"
        
        # Check audio duration
        try:
            import wave
            with wave.open(str(audio_path), 'rb') as wav:
                frames = wav.getnframes()
                rate = wav.getframerate()
                duration = frames / float(rate)
                if duration < 0.5:
                    return False, f"Audio too short ({duration:.2f}s, need >= 0.5s)"
                if duration > 3600:
                    return False, f"Audio too long ({duration:.2f}s, need <= 3600s)"
        except Exception as e:
            # Try with pydub as fallback
            try:
                from pydub import AudioSegment
                audio = AudioSegment.from_file(str(audio_path))
                duration = len(audio) / 1000.0
                if duration < 0.5:
                    return False, f"Audio too short ({duration:.2f}s, need >= 0.5s)"
            except:
                print(f"⚠ Warning: Could not validate audio duration: {e}")
        
        return True, "OK"
    
    def _trim_silence(self, audio_path: Path, output_path: Path, 
                      silence_thresh: int = -40, min_silence_len: int = 500,
                      keep_silence: int = 200) -> Tuple[Optional[Path], List[Tuple[float, float]]]:
        """
        Trim long silences from audio to help MFA with sparse recordings.
        
        Args:
            audio_path: Input audio file
            output_path: Output trimmed audio file
            silence_thresh: Silence threshold in dBFS (default: -40)
            min_silence_len: Minimum silence length to trim in ms (default: 500ms)
            keep_silence: Amount of silence to keep at boundaries in ms (default: 200ms)
            
        Returns:
            Tuple of (trimmed_audio_path, segment_times) where segment_times maps
            trimmed audio times to original audio times
        """
        try:
            from pydub import AudioSegment
            from pydub.silence import detect_nonsilent
            
            # Load audio
            audio = AudioSegment.from_file(str(audio_path))
            
            # Detect non-silent chunks
            nonsilent_ranges = detect_nonsilent(
                audio,
                min_silence_len=min_silence_len,
                silence_thresh=silence_thresh,
                seek_step=100
            )
            
            if not nonsilent_ranges:
                return None, []
            
            # Build trimmed audio and mapping
            trimmed_audio = AudioSegment.empty()
            segment_times = []  # List of (trimmed_start, original_start, duration)
            current_pos = 0.0
            
            for start_ms, end_ms in nonsilent_ranges:
                # Add some silence padding
                start_ms = max(0, start_ms - keep_silence)
                end_ms = min(len(audio), end_ms + keep_silence)
                
                # Extract segment
                segment = audio[start_ms:end_ms]
                segment_duration = (end_ms - start_ms) / 1000.0  # in seconds
                
                # Store mapping
                segment_times.append({
                    'trimmed_start': current_pos,
                    'trimmed_end': current_pos + segment_duration,
                    'original_start': start_ms / 1000.0,
                    'original_end': end_ms / 1000.0
                })
                
                # Add to trimmed audio
                trimmed_audio += segment
                current_pos += segment_duration
            
            # Export trimmed audio
            trimmed_audio.export(str(output_path), format="wav")
            
            original_duration = len(audio) / 1000.0
            trimmed_duration = len(trimmed_audio) / 1000.0
            compression_ratio = (1 - trimmed_duration / original_duration) * 100
            
            print(f"   ✓ Trimmed silence: {original_duration:.1f}s → {trimmed_duration:.1f}s "
                  f"({compression_ratio:.0f}% reduction)")
            
            return output_path, segment_times
            
        except ImportError:
            print("   ⚠ pydub not available, cannot trim silence")
            return None, []
        except Exception as e:
            print(f"   ⚠ Error trimming silence: {e}")
            return None, []
    
    def _map_timestamps(self, alignments: List[WordAlignment], 
                        segment_times: List[Dict]) -> List[WordAlignment]:
        """
        Map timestamps from trimmed audio back to original audio timeline.
        
        Args:
            alignments: Word alignments from MFA (using trimmed audio times)
            segment_times: Mapping from trimmed to original times
            
        Returns:
            Updated alignments with original audio timestamps
        """
        if not segment_times:
            return alignments
        
        mapped_alignments = []
        
        for word_align in alignments:
            trimmed_start = word_align.start_time
            trimmed_end = word_align.end_time
            
            # Find which segment this word belongs to
            for seg in segment_times:
                if seg['trimmed_start'] <= trimmed_start <= seg['trimmed_end']:
                    # Calculate offset within this segment
                    offset = trimmed_start - seg['trimmed_start']
                    original_start = seg['original_start'] + offset
                    
                    # Calculate end time
                    duration = trimmed_end - trimmed_start
                    original_end = original_start + duration
                    
                    # Create updated alignment
                    mapped_align = WordAlignment(
                        word=word_align.word,
                        start_time=original_start,
                        end_time=original_end,
                        phonemes=[
                            PhonemeAlignment(
                                phoneme=p.phoneme,
                                start_time=original_start + (p.start_time - trimmed_start),
                                end_time=original_start + (p.end_time - trimmed_start)
                            )
                            for p in word_align.phonemes
                        ]
                    )
                    mapped_alignments.append(mapped_align)
                    break
        
        return mapped_alignments
    
    def align(self, audio_path: str, transcript_path: str, 
              output_dir: str) -> Optional[str]:
        """
        Run MFA alignment on a single audio-transcript pair.
        
        Automatically trims excessive silence from sparse audio to improve
        MFA alignment success rate, then maps timestamps back to original audio.
        
        Returns path to output TextGrid file, or None if alignment failed.
        """
        if not self.mfa_available:
            return None
            
        audio_path = Path(audio_path)
        transcript_path = Path(transcript_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Validate inputs
        valid, message = self._validate_inputs(audio_path, transcript_path)
        if not valid:
            print(f"⚠ Validation failed: {message}")
            return None
        
        # Check if audio is sparse (high silence ratio) and needs trimming
        segment_times = []
        audio_to_use = audio_path
        
        try:
            import wave
            import struct
            import math
            
            with wave.open(str(audio_path), 'rb') as wav:
                frames = wav.readframes(min(wav.getnframes(), 48000 * 60))  # Sample first minute
                samples = struct.unpack('<%dh' % (len(frames) // 2), frames)
                
                # Calculate speech ratio
                chunk_size = 48000  # 1 second
                speech_chunks = 0
                total_chunks = 0
                
                for i in range(0, len(samples), chunk_size):
                    chunk = samples[i:i+chunk_size]
                    if len(chunk) > 0:
                        rms = math.sqrt(sum(s**2 for s in chunk) / len(chunk))
                        total_chunks += 1
                        if rms > 500:  # Speech threshold
                            speech_chunks += 1
                
                if total_chunks > 0:
                    speech_ratio = speech_chunks / total_chunks
                    
                    # If audio is very sparse (< 30% speech), trim silence
                    if speech_ratio < 0.3:
                        print(f"   ⚠ Sparse audio detected ({speech_ratio*100:.1f}% speech)")
                        print(f"   Trimming silence to improve MFA alignment...")
                        
                        # Create temporary trimmed audio file
                        temp_trimmed = output_dir / f"_trimmed_{audio_path.name}"
                        trimmed_path, segment_times = self._trim_silence(
                            audio_path, 
                            temp_trimmed,
                            silence_thresh=-40,
                            min_silence_len=500,
                            keep_silence=200
                        )
                        
                        if trimmed_path and trimmed_path.exists():
                            audio_to_use = trimmed_path
        
        except Exception as e:
            print(f"   ⚠ Could not analyze audio sparsity: {e}")
        
        # MFA expects specific input structure
        # Create temporary directory with proper structure
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            corpus_dir = temp_path / "corpus"
            corpus_dir.mkdir()
            
            # Copy audio file (original or trimmed)
            audio_dest = corpus_dir / audio_path.name  # Keep original name for output matching
            shutil.copy(audio_to_use, audio_dest)
            
            # Create .lab file (MFA format for transcripts)
            lab_file = corpus_dir / (audio_path.stem + ".lab")
            with open(transcript_path, 'r', encoding='utf-8') as f:
                text = f.read().strip()
            # Clean text for MFA
            text = re.sub(r'[^\w\s\'-]', '', text)
            with open(lab_file, 'w', encoding='utf-8') as f:
                f.write(text)
            
            # Run MFA alignment
            output_temp = temp_path / "output"
            try:
                # Add --single_speaker for single-file processing
                result = subprocess.run([
                    'mfa', 'align',
                    str(corpus_dir),
                    self.dictionary,
                    self.acoustic_model,
                    str(output_temp),
                    '--clean',
                    '--overwrite',
                    '--single_speaker',
                    '--beam', '100',
                    '--retry_beam', '400'
                ], capture_output=True, text=True, timeout=180)
                
                if result.returncode != 0:
                    print(f"⚠ MFA alignment failed")
                    if result.stderr:
                        # Parse error message for useful info
                        if "FeatureGenerationError" in result.stderr:
                            print("   Error: Could not generate audio features")
                            print("   This usually means audio is too short, corrupted, or wrong format")
                        elif "No utterances" in result.stderr:
                            print("   Error: No utterances found in audio")
                        else:
                            print(f"   Details: {result.stderr[:200]}")
                    return None
                
                # Copy TextGrid to output directory
                textgrid_file = output_temp / (audio_path.stem + ".TextGrid")
                if textgrid_file.exists():
                    # If we used trimmed audio, we need to map timestamps back
                    if segment_times:
                        print(f"   Mapping timestamps to original audio...")
                        try:
                            # Parse TextGrid, map timestamps, and save
                            word_alignments, phoneme_alignments = TextGridParser.parse(str(textgrid_file))
                            mapped_alignments = self._map_timestamps(word_alignments, segment_times)
                            
                            # Save mapped TextGrid
                            output_file = output_dir / (audio_path.stem + ".TextGrid")
                            self._save_textgrid(output_file, mapped_alignments)
                            
                            # Clean up trimmed audio
                            if audio_to_use != audio_path and audio_to_use.exists():
                                audio_to_use.unlink()
                            
                            return str(output_file)
                        except Exception as e:
                            print(f"   ⚠ Error mapping timestamps: {e}")
                            # Fall back to using trimmed timestamps
                    
                    output_file = output_dir / (audio_path.stem + ".TextGrid")
                    shutil.copy(textgrid_file, output_file)
                    
                    # Clean up trimmed audio
                    if audio_to_use != audio_path and audio_to_use.exists():
                        audio_to_use.unlink()
                    
                    return str(output_file)
                    
            except subprocess.TimeoutExpired:
                print("⚠ MFA alignment timed out (180s limit exceeded)")
                print("   Audio file may be too long or system is overloaded")
                return None
            except subprocess.SubprocessError as e:
                print(f"⚠ MFA subprocess error: {e}")
                return None
            except Exception as e:
                print(f"⚠ Unexpected error during MFA alignment: {e}")
                return None
            finally:
                # Clean up trimmed audio if it exists
                if audio_to_use != audio_path and audio_to_use.exists():
                    try:
                        audio_to_use.unlink()
                    except:
                        pass
        
        return None
    
    def _save_textgrid(self, output_path: Path, word_alignments: List[WordAlignment]):
        """Save word alignments as a TextGrid file"""
        try:
            import textgrid
            
            # Create TextGrid
            tg = textgrid.TextGrid()
            tg.maxTime = max(w.end_time for w in word_alignments) if word_alignments else 0
            
            # Create word tier with fixed intervals
            word_tier = textgrid.IntervalTier(name='words', maxTime=tg.maxTime)
            prev_end = 0.0
            for word_align in word_alignments:
                # Fix any gaps or overlaps from float precision errors
                start = max(word_align.start_time, prev_end)
                end = max(word_align.end_time, start + 0.001)  # Ensure minimum duration
                
                word_tier.add(start, end, word_align.word)
                prev_end = end
            
            # Create phone tier with fixed intervals
            phone_tier = textgrid.IntervalTier(name='phones', maxTime=tg.maxTime)
            prev_end = 0.0
            for word_align in word_alignments:
                for phoneme in word_align.phonemes:
                    # Fix any gaps or overlaps from float precision errors
                    start = max(phoneme.start_time, prev_end)
                    end = max(phoneme.end_time, start + 0.001)  # Ensure minimum duration
                    
                    phone_tier.add(start, end, phoneme.phoneme)
                    prev_end = end
            
            tg.append(word_tier)
            tg.append(phone_tier)
            
            # Write to file
            tg.write(str(output_path))
            
        except ImportError:
            print("   ⚠ textgrid library not available, cannot save mapped TextGrid")
        except Exception as e:
            print(f"   ⚠ Error saving TextGrid: {e}")


# =============================================================================
# TEXTGRID PARSER
# =============================================================================

class TextGridParser:
    """
    Parser for Praat TextGrid files output by MFA.
    
    TextGrid format contains:
    - Word tier: word boundaries and labels
    - Phone tier: phoneme boundaries and labels
    
    This gives us the actual phoneme realizations with timestamps.
    """
    
    @staticmethod
    def parse(textgrid_path: str) -> Tuple[List[WordAlignment], List[PhonemeAlignment]]:
        """Parse a TextGrid file and extract alignments"""
        words = []
        phonemes = []
        
        try:
            # Try using textgrid library if available
            import textgrid
            tg = textgrid.TextGrid.fromFile(textgrid_path)
            
            for tier in tg.tiers:
                if tier.name.lower() in ['words', 'word']:
                    for interval in tier:
                        if interval.mark and interval.mark.strip():
                            words.append(WordAlignment(
                                word=interval.mark.strip(),
                                start_time=float(interval.minTime),
                                end_time=float(interval.maxTime),
                                phonemes=[]
                            ))
                elif tier.name.lower() in ['phones', 'phone']:
                    for interval in tier:
                        if interval.mark and interval.mark.strip():
                            phonemes.append(PhonemeAlignment(
                                phoneme=interval.mark.strip().upper(),
                                start_time=float(interval.minTime),
                                end_time=float(interval.maxTime)
                            ))
        except ImportError:
            # Manual parsing if textgrid library not available
            words, phonemes = TextGridParser._manual_parse(textgrid_path)
        except Exception as e:
            print(f"⚠ Error parsing TextGrid: {e}")
            return [], []
        
        # Associate phonemes with words based on time overlap
        for word in words:
            word.phonemes = [
                p for p in phonemes
                if p.start_time >= word.start_time - 0.01 and 
                   p.end_time <= word.end_time + 0.01
            ]
        
        return words, phonemes
    
    @staticmethod
    def _manual_parse(path: str) -> Tuple[List[WordAlignment], List[PhonemeAlignment]]:
        """Manual TextGrid parsing without external library"""
        words = []
        phonemes = []
        
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find all intervals
        interval_pattern = r'intervals \[\d+\]:\s*xmin = ([\d.]+)\s*xmax = ([\d.]+)\s*text = "([^"]*)"'
        
        # Split by tiers
        tier_pattern = r'item \[\d+\]:\s*class = "IntervalTier"\s*name = "(\w+)"'
        tiers = re.split(tier_pattern, content)
        
        current_tier = None
        for i, section in enumerate(tiers):
            if section.lower() in ['words', 'word']:
                current_tier = 'words'
            elif section.lower() in ['phones', 'phone']:
                current_tier = 'phones'
            elif current_tier:
                for match in re.finditer(interval_pattern, section):
                    xmin, xmax, text = match.groups()
                    if text.strip():
                        if current_tier == 'words':
                            words.append(WordAlignment(
                                word=text.strip(),
                                start_time=float(xmin),
                                end_time=float(xmax),
                                phonemes=[]
                            ))
                        else:
                            phonemes.append(PhonemeAlignment(
                                phoneme=text.strip().upper(),
                                start_time=float(xmin),
                                end_time=float(xmax)
                            ))
        
        return words, phonemes


# =============================================================================
# PRONUNCIATION ERROR DETECTOR
# =============================================================================

class PronunciationErrorDetector:
    """
    Core error detection logic using phoneme comparison.
    
    This compares observed phonemes (from MFA alignment) against
    expected phonemes (from CMU dictionary) to detect:
    - Substitutions: Different phoneme than expected
    - Deletions: Missing phoneme
    - Insertions: Extra phoneme
    
    Severity is determined by phonetic distance and error impact.
    """
    
    # Phoneme categories for severity assessment
    VOWELS = {'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 
              'IH', 'IY', 'OW', 'OY', 'UH', 'UW'}
    CONSONANTS = {'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L',
                  'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V',
                  'W', 'Y', 'Z', 'ZH'}
    
    # Similar phoneme groups (substitutions within groups are less severe)
    SIMILAR_GROUPS = [
        {'S', 'Z'},           # Alveolar fricatives
        {'F', 'V'},           # Labiodental fricatives
        {'T', 'D'},           # Alveolar stops
        {'P', 'B'},           # Bilabial stops
        {'K', 'G'},           # Velar stops
        {'TH', 'DH'},         # Dental fricatives
        {'SH', 'ZH'},         # Postalveolar fricatives
        {'CH', 'JH'},         # Affricates
        {'IH', 'IY'},         # Front high vowels
        {'UH', 'UW'},         # Back high vowels
        {'AH', 'AE'},         # Low vowels
        {'AA', 'AO'},         # Back low vowels
    ]
    
    def __init__(self, cmu_dict: CMUDictionary):
        self.cmu_dict = cmu_dict
    
    def detect_errors(self, word_alignments: List[WordAlignment], 
                      user_id: str, transcript_text: str = "") -> List[PronunciationError]:
        """
        Detect pronunciation errors for all aligned words.
        
        Args:
            word_alignments: List of word alignments from MFA
            user_id: Speaker/participant identifier
            transcript_text: Full transcript for context extraction
            
        Returns:
            List of detected pronunciation errors
        """
        errors = []
        words_list = transcript_text.split() if transcript_text else []
        
        for i, word_align in enumerate(word_alignments):
            word = word_align.word.lower()
            
            # Skip common function words
            if word in SKIP_WORDS:
                continue
            
            observed = [p.phoneme for p in word_align.phonemes]
            expected = self.cmu_dict.get_pronunciation(word)
            
            if not expected:
                # Word not in dictionary, skip
                continue
            
            if not observed:
                # No phonemes detected, possible deletion
                errors.append(PronunciationError(
                    user_id=user_id,
                    word=word_align.word,
                    expected_phonemes=expected,
                    observed_phonemes=[],
                    error_type=ErrorType.DELETION.value,
                    severity=Severity.HIGH.value,
                    start_time=word_align.start_time,
                    end_time=word_align.end_time,
                    context=self._get_context(words_list, i),
                    details="Word phonemes not detected"
                ))
                continue
            
            # Compare expected vs observed phonemes
            word_errors = self._compare_phonemes(expected, observed)
            
            if word_errors:
                error_type, severity, details = self._classify_errors(word_errors, expected, observed)
                
                errors.append(PronunciationError(
                    user_id=user_id,
                    word=word_align.word,
                    expected_phonemes=expected,
                    observed_phonemes=observed,
                    error_type=error_type,
                    severity=severity,
                    start_time=word_align.start_time,
                    end_time=word_align.end_time,
                    context=self._get_context(words_list, i),
                    details=details
                ))
        
        return errors
    
    def _compare_phonemes(self, expected: List[str], observed: List[str]) -> List[dict]:
        """
        Compare expected and observed phoneme sequences using alignment.
        
        Uses a simple dynamic programming approach similar to edit distance
        to align the two sequences and identify differences.
        """
        errors = []
        
        # Normalize phonemes (remove stress markers)
        expected = [re.sub(r'\d+$', '', p) for p in expected]
        observed = [re.sub(r'\d+$', '', p) for p in observed]
        
        # Simple comparison - for research grade, could use DTW
        m, n = len(expected), len(observed)
        
        # Build alignment matrix (edit distance)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        
        for i in range(m + 1):
            dp[i][0] = i
        for j in range(n + 1):
            dp[0][j] = j
            
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if expected[i-1] == observed[j-1]:
                    dp[i][j] = dp[i-1][j-1]
                else:
                    dp[i][j] = 1 + min(
                        dp[i-1][j],      # deletion
                        dp[i][j-1],      # insertion
                        dp[i-1][j-1]     # substitution
                    )
        
        # Backtrack to find errors
        i, j = m, n
        while i > 0 or j > 0:
            if i > 0 and j > 0 and expected[i-1] == observed[j-1]:
                i -= 1
                j -= 1
            elif i > 0 and j > 0 and dp[i][j] == dp[i-1][j-1] + 1:
                # Substitution
                errors.append({
                    'type': 'substitution',
                    'expected': expected[i-1],
                    'observed': observed[j-1],
                    'position': i-1
                })
                i -= 1
                j -= 1
            elif j > 0 and dp[i][j] == dp[i][j-1] + 1:
                # Insertion
                errors.append({
                    'type': 'insertion',
                    'expected': None,
                    'observed': observed[j-1],
                    'position': j-1
                })
                j -= 1
            elif i > 0:
                # Deletion
                errors.append({
                    'type': 'deletion',
                    'expected': expected[i-1],
                    'observed': None,
                    'position': i-1
                })
                i -= 1
        
        return errors
    
    def _classify_errors(self, errors: List[dict], 
                         expected: List[str], 
                         observed: List[str]) -> Tuple[str, str, str]:
        """
        Classify the overall error type and severity for a word.
        
        Returns:
            Tuple of (error_type, severity, details)
        """
        if not errors:
            return ErrorType.CORRECT.value, Severity.LOW.value, ""
        
        # Determine primary error type
        error_types = [e['type'] for e in errors]
        if len(set(error_types)) > 1:
            primary_type = "multiple"
        else:
            primary_type = error_types[0]
        
        # Calculate severity
        severity_score = 0
        details_list = []
        
        for error in errors:
            if error['type'] == 'deletion':
                # Deletion severity based on phoneme type
                if error['expected'] in self.CONSONANTS:
                    severity_score += 3
                    details_list.append(f"Missing consonant: {error['expected']}")
                else:
                    severity_score += 1
                    details_list.append(f"Missing vowel: {error['expected']}")
                    
            elif error['type'] == 'insertion':
                severity_score += 2
                details_list.append(f"Extra phoneme: {error['observed']}")
                
            elif error['type'] == 'substitution':
                exp, obs = error['expected'], error['observed']
                if self._are_similar(exp, obs):
                    severity_score += 1
                    details_list.append(f"Similar substitution: {exp} → {obs}")
                elif (exp in self.VOWELS) == (obs in self.VOWELS):
                    severity_score += 2
                    details_list.append(f"Same-class substitution: {exp} → {obs}")
                else:
                    severity_score += 3
                    details_list.append(f"Cross-class substitution: {exp} → {obs}")
        
        # Normalize severity by word length
        normalized_score = severity_score / max(len(expected), 1)
        
        if normalized_score < 0.5:
            severity = Severity.LOW.value
        elif normalized_score < 1.0:
            severity = Severity.MEDIUM.value
        else:
            severity = Severity.HIGH.value
        
        return primary_type, severity, "; ".join(details_list)
    
    def _are_similar(self, p1: str, p2: str) -> bool:
        """Check if two phonemes are in the same similarity group"""
        for group in self.SIMILAR_GROUPS:
            if p1 in group and p2 in group:
                return True
        return False
    
    def _get_context(self, words: List[str], position: int, window: int = 2) -> str:
        """Get surrounding words for context"""
        start = max(0, position - window)
        end = min(len(words), position + window + 1)
        context_words = words[start:end]
        return " ".join(context_words)


# =============================================================================
# FALLBACK DETECTOR (WITHOUT MFA)
# =============================================================================

class FallbackPronunciationDetector:
    """
    Fallback detector when MFA is not available.
    
    Uses audio analysis with Whisper for transcription alignment
    and phoneme estimation. Uses sequence alignment instead of 
    simple index matching for better accuracy.
    """
    
    def __init__(self):
        self.cmu_dict = CMUDictionary()
        
    def detect_errors(self, audio_path: str, transcript_path: str, 
                      user_id: str) -> List[PronunciationError]:
        """Detect errors using audio transcription comparison with proper alignment"""
        errors = []
        
        # Load transcript
        with open(transcript_path, 'r', encoding='utf-8') as f:
            expected_text = f.read().strip()
        
        expected_words = re.findall(r'\b\w+\b', expected_text.lower())
        
        # Use Whisper for actual transcription with word timestamps
        try:
            import whisper
            
            print("   Loading Whisper model for fallback detection...")
            model = whisper.load_model("base")
            result = model.transcribe(audio_path, word_timestamps=True)
            
            observed_words = []
            for segment in result.get('segments', []):
                for word_info in segment.get('words', []):
                    observed_words.append({
                        'word': word_info['word'].strip().lower(),
                        'start': word_info['start'],
                        'end': word_info['end']
                    })
            
            # Use sequence alignment instead of index matching
            obs_word_list = [re.sub(r'[^\w]', '', w['word']) for w in observed_words]
            
            # Simple sequence matching using difflib
            from difflib import SequenceMatcher
            matcher = SequenceMatcher(None, expected_words, obs_word_list)
            
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                if tag == 'replace':
                    # Words were substituted - potential pronunciation errors
                    for k in range(min(i2 - i1, j2 - j1)):
                        exp_idx = i1 + k
                        obs_idx = j1 + k
                        
                        exp_word = expected_words[exp_idx]
                        obs_word = obs_word_list[obs_idx]
                        
                        # Skip common function words
                        if exp_word in SKIP_WORDS:
                            continue
                        
                        exp_phonemes = self.cmu_dict.get_pronunciation(exp_word)
                        obs_phonemes = self.cmu_dict.get_pronunciation(obs_word)
                        
                        if exp_phonemes:
                            errors.append(PronunciationError(
                                user_id=user_id,
                                word=exp_word,
                                expected_phonemes=exp_phonemes,
                                observed_phonemes=obs_phonemes or ['?'],
                                error_type="substitution",
                                severity="medium",
                                start_time=observed_words[obs_idx]['start'] if obs_idx < len(observed_words) else 0.0,
                                end_time=observed_words[obs_idx]['end'] if obs_idx < len(observed_words) else 0.0,
                                context=f"Expected '{exp_word}', heard '{obs_word}'",
                                details=f"Word substitution detected via alignment"
                            ))
                
                elif tag == 'delete':
                    # Words in expected but not in observed - omissions
                    for k in range(i1, i2):
                        exp_word = expected_words[k]
                        
                        # Skip common function words
                        if exp_word in SKIP_WORDS:
                            continue
                        
                        exp_phonemes = self.cmu_dict.get_pronunciation(exp_word)
                        if exp_phonemes:
                            errors.append(PronunciationError(
                                user_id=user_id,
                                word=exp_word,
                                expected_phonemes=exp_phonemes,
                                observed_phonemes=[],
                                error_type="deletion",
                                severity="high",
                                start_time=0.0,
                                end_time=0.0,
                                context=f"Word '{exp_word}' was not detected",
                                details="Word omitted or unintelligible"
                            ))
            
            print(f"   Fallback detection found {len(errors)} potential errors")
        
        except ImportError:
            print("⚠ Whisper not available for fallback detection")
        except Exception as e:
            print(f"⚠ Fallback detection error: {e}")
            import traceback
            traceback.print_exc()
        
        return errors


# =============================================================================
# MAIN PIPELINE
# =============================================================================

class MFAPronunciationPipeline:
    """
    Complete pipeline for MFA-based pronunciation error detection.
    
    This orchestrates the entire process:
    1. Data preparation
    2. MFA alignment
    3. Error detection
    4. Result output
    """
    
    def __init__(self, use_fallback: bool = True):
        self.cmu_dict = CMUDictionary()
        self.mfa = MFAAligner()
        self.detector = PronunciationErrorDetector(self.cmu_dict)
        self.use_fallback = use_fallback
        self.fallback = FallbackPronunciationDetector() if use_fallback else None
    
    def process_participant(self, audio_path: str, transcript_path: str,
                           user_id: str, output_dir: str) -> Dict:
        """
        Process a single participant's audio and transcript.
        
        Args:
            audio_path: Path to participant's audio file (.wav)
            transcript_path: Path to participant's transcript (.txt)
            user_id: Participant identifier
            output_dir: Directory for output files
            
        Returns:
            Dictionary with detection results
        """
        print(f"\n{'='*60}")
        print(f"Processing: {user_id}")
        print(f"{'='*60}")
        print(f"Audio: {audio_path}")
        print(f"Transcript: {transcript_path}")
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Load transcript text for context
        with open(transcript_path, 'r', encoding='utf-8') as f:
            transcript_text = f.read().strip()
        
        errors = []
        alignment_source = "none"
        
        # Validate inputs first
        if not Path(audio_path).exists():
            print(f"⚠ Audio file not found: {audio_path}")
            return {"error": "Audio file not found", "user_id": user_id}
        
        if not Path(transcript_path).exists():
            print(f"⚠ Transcript file not found: {transcript_path}")
            return {"error": "Transcript file not found", "user_id": user_id}
        
        if len(transcript_text.strip()) < 5:
            print(f"⚠ Transcript too short or empty (length: {len(transcript_text)})")
            print("   Skipping MFA processing for this participant")
            return {
                "user_id": user_id,
                "audio_file": str(audio_path),
                "transcript_file": str(transcript_path),
                "alignment_source": "skipped",
                "total_words": 0,
                "errors_detected": 0,
                "accuracy": 0.0,
                "errors": [],
                "note": "Transcript too short or empty"
            }
        
        # Try MFA alignment first
        if self.mfa.mfa_available:
            print("\n[1/3] Running MFA forced alignment...")
            textgrid_path = self.mfa.align(
                audio_path, transcript_path, 
                str(output_path / "alignments")
            )
            
            if textgrid_path:
                print(f"✓ Alignment complete: {textgrid_path}")
                alignment_source = "mfa"
                
                # Parse TextGrid
                print("\n[2/3] Parsing alignment results...")
                word_alignments, phoneme_alignments = TextGridParser.parse(textgrid_path)
                print(f"✓ Found {len(word_alignments)} words, {len(phoneme_alignments)} phonemes")
                
                # Detect errors
                print("\n[3/3] Detecting pronunciation errors...")
                errors = self.detector.detect_errors(word_alignments, user_id, transcript_text)
            else:
                print("✗ MFA alignment failed - cannot continue without MFA")
                print("   Please ensure:")
                print("   1. Audio quality is sufficient")
                print("   2. pydub is installed: pip install pydub")
                print("   3. MFA models are downloaded")
                return {
                    "user_id": user_id,
                    "audio_file": str(audio_path),
                    "transcript_file": str(transcript_path),
                    "alignment_source": "failed",
                    "total_words": 0,
                    "errors_detected": 0,
                    "accuracy": 0.0,
                    "errors": [],
                    "note": "MFA alignment failed - check dependencies and audio quality"
                }
        else:
            print("✗ MFA not available - cannot continue")
            print("   Please install Montreal Forced Aligner")
            return {
                "user_id": user_id,
                "audio_file": str(audio_path),
                "transcript_file": str(transcript_path),
                "alignment_source": "failed",
                "total_words": 0,
                "errors_detected": 0,
                "accuracy": 0.0,
                "errors": [],
                "note": "MFA not available"
            }
        
        # =====================================================================
        # PHONETIC CONFUSABLES DETECTION
        # This catches mispronunciations where ASR "corrected" to a similar word
        # e.g., "check-in" mispronounced as "cheeking" → ASR hears "checking"
        # =====================================================================
        print("\n[BONUS] Detecting phonetic confusables...")
        confusable_errors = self._detect_phonetic_confusables(transcript_text, user_id)
        if confusable_errors:
            print(f"✓ Found {len(confusable_errors)} phonetic confusables")
            errors.extend(confusable_errors)
        
        # Prepare results
        result = {
            "user_id": user_id,
            "audio_file": str(audio_path),
            "transcript_file": str(transcript_path),
            "alignment_source": alignment_source,
            "total_words": len(transcript_text.split()),
            "errors_detected": len(errors),
            "accuracy": 1.0 - (len(errors) / max(len(transcript_text.split()), 1)),
            "errors": [asdict(e) for e in errors]
        }
        
        # Save results
        output_file = output_path / f"{user_id}_mfa_pronunciation.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        
        print(f"\n✓ Results saved: {output_file}")
        print(f"  Errors found: {len(errors)}")
        print(f"  Accuracy: {result['accuracy']:.1%}")
        
        return result
    
    def _analyze_transcript_only(self, text: str, user_id: str) -> List[PronunciationError]:
        """Analyze transcript for potential problem words (no audio analysis)"""
        errors = []
        words = text.split()
        
        for i, word in enumerate(words):
            clean_word = re.sub(r'[^\w\'-]', '', word).lower()
            if clean_word and not self.cmu_dict.get_pronunciation(clean_word):
                # Word not in dictionary - could be name, technical term, or mispronounced
                errors.append(PronunciationError(
                    user_id=user_id,
                    word=word,
                    expected_phonemes=['?'],
                    observed_phonemes=['?'],
                    error_type="unknown",
                    severity="low",
                    start_time=0.0,
                    end_time=0.0,
                    context=self._get_context_window(words, i),
                    details="Word not in dictionary"
                ))
        
        return errors
    
    def _get_context_window(self, words: List[str], pos: int, window: int = 2) -> str:
        """Get context window around a word"""
        start = max(0, pos - window)
        end = min(len(words), pos + window + 1)
        return " ".join(words[start:end])
    
    def _detect_phonetic_confusables(self, text: str, user_id: str) -> List[PronunciationError]:
        """
        Detect phonetic confusables - words that sound like other words.
        This catches mispronunciations where ASR "corrected" to a similar word.
        
        NOTE: This function now works dynamically without hardcoded word patterns.
        Detection is based on phonetic similarity analysis only when context
        words are provided externally.
        """
        errors = []
        
        try:
            from phonetic_confusables import PhoneticConfusableDetector
            
            # No hardcoded context - detection now relies on MFA phoneme analysis
            # Context can be provided externally if needed
            context_words = []
            
            detector = PhoneticConfusableDetector()
            confusables = detector.detect_mispronunciations(text, context_words)
            
            # Convert to PronunciationError format
            for conf in confusables:
                # Get phonemes if available
                intended_phonemes = self.cmu_dict.get_pronunciation(conf.intended_word) or ['?']
                transcribed_phonemes = self.cmu_dict.get_pronunciation(conf.transcribed_word) or ['?']
                
                errors.append(PronunciationError(
                    user_id=user_id,
                    word=conf.intended_word,  # What they meant to say
                    expected_phonemes=intended_phonemes,
                    observed_phonemes=transcribed_phonemes,
                    error_type=f"confusable:{conf.error_type}",
                    severity=conf.severity,
                    start_time=0.0,
                    end_time=0.0,
                    context=conf.context,
                    details=f"Transcribed as '{conf.transcribed_word}'. {conf.details}"
                ))
            
        except ImportError:
            print("   ⚠ phonetic_confusables module not available")
        except Exception as e:
            print(f"   ⚠ Error in phonetic confusables detection: {e}")
        
        return errors
    
    def process_meeting(self, meeting_folder: str) -> Dict:
        """
        Process all participants in a meeting folder.
        
        Expected structure:
        meeting_folder/
            participant_transcripts/
                User1.txt
                User2.txt
                ...
            User1_audio.wav (or similar naming)
            ...
        """
        meeting_path = Path(meeting_folder)
        print(f"\n{'#'*60}")
        print(f"PROCESSING MEETING: {meeting_path.name}")
        print(f"{'#'*60}")
        
        # Find participant transcripts
        transcript_folder = meeting_path / "participant_transcripts"
        if not transcript_folder.exists():
            print(f"⚠ No participant_transcripts folder found in {meeting_folder}")
            return {"error": "No transcripts found"}
        
        results = {
            "meeting": meeting_path.name,
            "participants": {},
            "summary": {}
        }
        
        # Process each participant
        for transcript_file in transcript_folder.glob("*.txt"):
            user_id = transcript_file.stem
            
            # Find corresponding audio
            audio_file = self._find_audio_file(meeting_path, user_id)
            if not audio_file:
                print(f"\n⚠ No audio found for {user_id}")
                continue
            
            # Process participant
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
        
        # Save meeting summary
        summary_file = transcript_folder / "mfa_pronunciation_summary.json"
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n{'='*60}")
        print("MEETING SUMMARY")
        print(f"{'='*60}")
        print(f"Participants: {results['summary']['total_participants']}")
        print(f"Total words: {results['summary']['total_words']}")
        print(f"Total errors: {results['summary']['total_errors']}")
        print(f"Overall accuracy: {results['summary']['overall_accuracy']:.1%}")
        print(f"\n✓ Summary saved: {summary_file}")
        
        return results
    
    def _find_audio_file(self, meeting_path: Path, user_id: str) -> Optional[Path]:
        """Find audio file for a user (handles various naming conventions)"""
        # Try direct match
        for ext in ['.wav', '.mp3', '.flac']:
            direct = meeting_path / f"{user_id}{ext}"
            if direct.exists():
                return direct
        
        # Try patterns with user ID in filename
        patterns = [
            f"*{user_id}*.wav",
            f"*{user_id.lower()}*.wav",
            f"*{user_id}*_converted.wav",
            f"*_{user_id}_*.wav",
        ]
        
        for pattern in patterns:
            matches = list(meeting_path.glob(pattern))
            if matches:
                return matches[0]
        
        return None


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def main():
    """Main entry point for the pronunciation detection pipeline"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="MFA-based Pronunciation Error Detection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python mfa_pronunciation_detector.py projectmeeting1
  python mfa_pronunciation_detector.py --audio file.wav --transcript file.txt --user John
        """
    )
    
    parser.add_argument('meeting', nargs='?', help='Meeting folder to process')
    parser.add_argument('--audio', help='Single audio file path')
    parser.add_argument('--transcript', help='Single transcript file path')
    parser.add_argument('--user', help='User ID for single file processing')
    parser.add_argument('--output', default='output', help='Output directory')
    parser.add_argument('--no-fallback', action='store_true', 
                       help='Disable fallback detection if MFA unavailable')
    
    args = parser.parse_args()
    
    # Initialize pipeline
    pipeline = MFAPronunciationPipeline(use_fallback=not args.no_fallback)
    
    if args.meeting:
        # Process entire meeting
        pipeline.process_meeting(args.meeting)
    elif args.audio and args.transcript:
        # Process single file
        user_id = args.user or Path(args.audio).stem
        pipeline.process_participant(args.audio, args.transcript, user_id, args.output)
    else:
        parser.print_help()
        print("\n⚠ Please specify a meeting folder or --audio/--transcript files")


if __name__ == "__main__":
    main()
