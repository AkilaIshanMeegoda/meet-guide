#!/usr/bin/env python3
"""
ASR Model Comparison Test
Compares Whisper, wav2vec2, and Conformer models on projectmeeting1 audio.

This script tests:
1. Whisper-small (base model, not fine-tuned)
2. wav2vec2-base-960h
3. Conformer (via NeMo or SpeechBrain)

Metrics calculated:
- Word Error Rate (WER)
- Processing Time
- Sample Outputs
"""

import os
import sys
import json
import time
import torch
import librosa
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

# ============================================================================
# WER CALCULATION
# ============================================================================

def calculate_wer(reference: str, hypothesis: str) -> Tuple[float, Dict]:
    """
    Calculate Word Error Rate using dynamic programming.
    
    WER = (S + I + D) / N
    Where:
        S = Substitutions
        I = Insertions  
        D = Deletions
        N = Total words in reference
    """
    # Normalize text
    ref_words = reference.lower().strip().split()
    hyp_words = hypothesis.lower().strip().split()
    
    # Remove punctuation for fair comparison
    import re
    ref_words = [re.sub(r'[^\w\s]', '', w) for w in ref_words if re.sub(r'[^\w\s]', '', w)]
    hyp_words = [re.sub(r'[^\w\s]', '', w) for w in hyp_words if re.sub(r'[^\w\s]', '', w)]
    
    m, n = len(ref_words), len(hyp_words)
    
    # DP matrix
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    
    # Initialize base cases
    for i in range(m + 1):
        dp[i][0] = i  # Deletions
    for j in range(n + 1):
        dp[0][j] = j  # Insertions
    
    # Fill DP table
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if ref_words[i-1] == hyp_words[j-1]:
                dp[i][j] = dp[i-1][j-1]
            else:
                dp[i][j] = 1 + min(
                    dp[i-1][j],    # Deletion
                    dp[i][j-1],    # Insertion
                    dp[i-1][j-1]   # Substitution
                )
    
    # Backtrack to count S, I, D
    i, j = m, n
    substitutions = insertions = deletions = 0
    
    while i > 0 or j > 0:
        if i > 0 and j > 0 and ref_words[i-1] == hyp_words[j-1]:
            i -= 1
            j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i-1][j-1] + 1:
            substitutions += 1
            i -= 1
            j -= 1
        elif j > 0 and dp[i][j] == dp[i][j-1] + 1:
            insertions += 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i-1][j] + 1:
            deletions += 1
            i -= 1
        else:
            break
    
    total_errors = substitutions + insertions + deletions
    wer = (total_errors / m * 100) if m > 0 else 0
    
    return wer, {
        'substitutions': substitutions,
        'insertions': insertions,
        'deletions': deletions,
        'total_errors': total_errors,
        'reference_words': m,
        'hypothesis_words': n,
        'wer_percent': round(wer, 2)
    }


# ============================================================================
# MODEL LOADERS
# ============================================================================

def load_audio(audio_path: str, target_sr: int = 16000) -> Tuple[np.ndarray, int]:
    """Load and resample audio to target sample rate."""
    print(f"  Loading audio: {audio_path}")
    audio, sr = librosa.load(audio_path, sr=target_sr)
    print(f"  Audio loaded: {len(audio)/sr:.2f} seconds at {sr}Hz")
    return audio, sr


def transcribe_whisper(audio_path: str) -> Tuple[str, float]:
    """Transcribe using Whisper-small (base model)."""
    print("\n" + "="*60)
    print("WHISPER-SMALL (Base Model)")
    print("="*60)
    
    try:
        from transformers import WhisperProcessor, WhisperForConditionalGeneration
        
        print("  Loading Whisper-small model...")
        start_load = time.time()
        
        processor = WhisperProcessor.from_pretrained("openai/whisper-small")
        model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-small")
        
        # Move to GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        print(f"  Model loaded on {device} in {time.time() - start_load:.2f}s")
        
        # Load audio
        audio, sr = load_audio(audio_path, target_sr=16000)
        
        # Process audio in chunks if too long
        print("  Transcribing...")
        start_time = time.time()
        
        # Whisper can handle up to 30s chunks
        chunk_duration = 30  # seconds
        chunk_samples = chunk_duration * sr
        
        transcriptions = []
        for i in range(0, len(audio), chunk_samples):
            chunk = audio[i:i + chunk_samples]
            
            input_features = processor(
                chunk, 
                sampling_rate=sr, 
                return_tensors="pt"
            ).input_features.to(device)
            
            generated_ids = model.generate(input_features, max_length=448)
            transcription = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            transcriptions.append(transcription.strip())
        
        full_transcript = " ".join(transcriptions)
        processing_time = time.time() - start_time
        
        print(f"  ✓ Transcription complete in {processing_time:.2f}s")
        print(f"  Output preview: {full_transcript[:200]}...")
        
        return full_transcript, processing_time
        
    except Exception as e:
        print(f"  ✗ Whisper error: {e}")
        return "", 0


def transcribe_wav2vec2(audio_path: str) -> Tuple[str, float]:
    """Transcribe using wav2vec2-base-960h."""
    print("\n" + "="*60)
    print("WAV2VEC2-BASE-960H")
    print("="*60)
    
    try:
        from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
        
        print("  Loading wav2vec2 model...")
        start_load = time.time()
        
        processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
        model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h")
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        print(f"  Model loaded on {device} in {time.time() - start_load:.2f}s")
        
        # Load audio
        audio, sr = load_audio(audio_path, target_sr=16000)
        
        print("  Transcribing...")
        start_time = time.time()
        
        # Process in chunks (wav2vec2 needs shorter chunks)
        chunk_duration = 20  # seconds
        chunk_samples = chunk_duration * sr
        
        transcriptions = []
        for i in range(0, len(audio), chunk_samples):
            chunk = audio[i:i + chunk_samples]
            
            inputs = processor(
                chunk, 
                sampling_rate=sr, 
                return_tensors="pt",
                padding=True
            ).input_values.to(device)
            
            with torch.no_grad():
                logits = model(inputs).logits
            
            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = processor.batch_decode(predicted_ids)[0]
            transcriptions.append(transcription.strip())
        
        full_transcript = " ".join(transcriptions)
        processing_time = time.time() - start_time
        
        print(f"  ✓ Transcription complete in {processing_time:.2f}s")
        print(f"  Output preview: {full_transcript[:200]}...")
        
        return full_transcript, processing_time
        
    except Exception as e:
        print(f"  ✗ wav2vec2 error: {e}")
        import traceback
        traceback.print_exc()
        return "", 0


def transcribe_conformer(audio_path: str) -> Tuple[str, float]:
    """Transcribe using Conformer model (via SpeechBrain or NeMo)."""
    print("\n" + "="*60)
    print("CONFORMER (SpeechBrain)")
    print("="*60)
    
    try:
        # Try SpeechBrain's Conformer
        from speechbrain.inference.ASR import EncoderDecoderASR
        
        print("  Loading Conformer model from SpeechBrain...")
        start_load = time.time()
        
        asr_model = EncoderDecoderASR.from_hparams(
            source="speechbrain/asr-conformer-transformerlm-librispeech",
            savedir="pretrained_models/asr-conformer"
        )
        print(f"  Model loaded in {time.time() - start_load:.2f}s")
        
        print("  Transcribing...")
        start_time = time.time()
        
        transcription = asr_model.transcribe_file(audio_path)
        
        processing_time = time.time() - start_time
        
        print(f"  ✓ Transcription complete in {processing_time:.2f}s")
        print(f"  Output preview: {transcription[:200]}...")
        
        return transcription, processing_time
        
    except ImportError:
        print("  SpeechBrain not installed, trying NeMo...")
        
        try:
            import nemo.collections.asr as nemo_asr
            
            print("  Loading Conformer model from NeMo...")
            start_load = time.time()
            
            asr_model = nemo_asr.models.EncDecCTCModelBPE.from_pretrained(
                "nvidia/stt_en_conformer_ctc_small"
            )
            print(f"  Model loaded in {time.time() - start_load:.2f}s")
            
            print("  Transcribing...")
            start_time = time.time()
            
            transcription = asr_model.transcribe([audio_path])[0]
            
            processing_time = time.time() - start_time
            
            print(f"  ✓ Transcription complete in {processing_time:.2f}s")
            print(f"  Output preview: {transcription[:200]}...")
            
            return transcription, processing_time
            
        except ImportError:
            print("  ✗ Neither SpeechBrain nor NeMo installed")
            print("  To install: pip install speechbrain or pip install nemo_toolkit")
            return "", 0
        except Exception as e:
            print(f"  ✗ NeMo Conformer error: {e}")
            return "", 0
            
    except Exception as e:
        print(f"  ✗ Conformer error: {e}")
        return "", 0


# ============================================================================
# MAIN COMPARISON
# ============================================================================

def run_comparison(audio_path: str, reference_transcript: str) -> Dict:
    """Run comparison of all models."""
    
    print("\n" + "#"*70)
    print("ASR MODEL COMPARISON TEST")
    print("#"*70)
    print(f"\nAudio file: {audio_path}")
    print(f"Reference length: {len(reference_transcript.split())} words")
    
    results = {}
    
    # Test Whisper
    whisper_transcript, whisper_time = transcribe_whisper(audio_path)
    if whisper_transcript:
        wer, details = calculate_wer(reference_transcript, whisper_transcript)
        results['whisper'] = {
            'model': 'Whisper-small (base)',
            'transcript': whisper_transcript,
            'processing_time': whisper_time,
            'wer': wer,
            'wer_details': details
        }
    
    # Test wav2vec2
    wav2vec_transcript, wav2vec_time = transcribe_wav2vec2(audio_path)
    if wav2vec_transcript:
        wer, details = calculate_wer(reference_transcript, wav2vec_transcript)
        results['wav2vec2'] = {
            'model': 'wav2vec2-base-960h',
            'transcript': wav2vec_transcript,
            'processing_time': wav2vec_time,
            'wer': wer,
            'wer_details': details
        }
    
    # Test Conformer
    conformer_transcript, conformer_time = transcribe_conformer(audio_path)
    if conformer_transcript:
        wer, details = calculate_wer(reference_transcript, conformer_transcript)
        results['conformer'] = {
            'model': 'Conformer',
            'transcript': conformer_transcript,
            'processing_time': conformer_time,
            'wer': wer,
            'wer_details': details
        }
    
    return results


def print_results(results: Dict, reference: str):
    """Print formatted comparison results."""
    
    print("\n" + "="*70)
    print("COMPARISON RESULTS")
    print("="*70)
    
    # Summary table
    print("\n┌" + "─"*68 + "┐")
    print(f"│ {'Model':<30} │ {'WER (%)':<12} │ {'Time (s)':<12} │ {'Words':<8} │")
    print("├" + "─"*68 + "┤")
    
    for name, data in results.items():
        model = data['model'][:28]
        wer = f"{data['wer']:.2f}%"
        time_s = f"{data['processing_time']:.2f}s"
        words = str(data['wer_details']['hypothesis_words'])
        print(f"│ {model:<30} │ {wer:<12} │ {time_s:<12} │ {words:<8} │")
    
    print("└" + "─"*68 + "┘")
    
    # Detailed breakdown
    print("\n" + "="*70)
    print("DETAILED ERROR ANALYSIS")
    print("="*70)
    
    for name, data in results.items():
        print(f"\n{data['model']}:")
        details = data['wer_details']
        print(f"  • Substitutions: {details['substitutions']}")
        print(f"  • Insertions: {details['insertions']}")
        print(f"  • Deletions: {details['deletions']}")
        print(f"  • Total Errors: {details['total_errors']} / {details['reference_words']} words")
        print(f"  • WER: {details['wer_percent']}%")
        print(f"  • Accuracy: {100 - details['wer_percent']:.2f}%")
    
    # Sample comparison
    print("\n" + "="*70)
    print("TRANSCRIPT COMPARISON (First 200 chars)")
    print("="*70)
    
    print(f"\nREFERENCE:\n  {reference[:200]}...")
    
    for name, data in results.items():
        print(f"\n{data['model'].upper()}:\n  {data['transcript'][:200]}...")
    
    # Winner
    print("\n" + "="*70)
    print("WINNER")
    print("="*70)
    
    if results:
        winner = min(results.items(), key=lambda x: x[1]['wer'])
        print(f"\n🏆 Best Model: {winner[1]['model']}")
        print(f"   WER: {winner[1]['wer']:.2f}%")
        print(f"   Accuracy: {100 - winner[1]['wer']:.2f}%")


def main():
    """Main function to run the comparison test."""
    
    # Find audio file in projectmeeting1
    base_dir = Path(__file__).parent
    meeting_dir = base_dir / "projectmeeting1"
    
    # Look for converted audio
    audio_files = list(meeting_dir.glob("*Chalana*_converted.wav"))
    if not audio_files:
        audio_files = list(meeting_dir.glob("*.wav"))
    
    if not audio_files:
        print("Error: No audio files found in projectmeeting1")
        print("Looking in:", meeting_dir)
        return
    
    audio_path = str(audio_files[0])
    print(f"Using audio: {audio_path}")
    
    # Load reference transcript from Deepgram output
    transcript_dir = meeting_dir / "participant_transcripts"
    chalana_json = transcript_dir / "Chalana.json"
    
    if chalana_json.exists():
        with open(chalana_json, 'r', encoding='utf-8') as f:
            data = json.load(f)
            reference_transcript = data.get('transcript', '')
    else:
        # Fallback reference
        reference_transcript = """Thanks for hopping on this meeting, everyone. I want to do a quick checking and make sure we are all logged in on where the project is headed. That's fair, and I appreciate you both keeping it real. It sounds like the review process is where things are getting a bit messy. I hear you. I don't want anyone burning out just to meet a deadline because that is not the move. Alright. Then here's the plan. I will clean up the review schedule, set clear checkpoints, and make sure expectations are crystal clear. Yeah. And if something start feeling off or too much, I need you to say something early so we can fix it before it turns into bigger issue. Cool. Let's stay locked in. Keep the energy good and touch base again next week. Perfect. Appreciate you both."""
    
    print(f"Reference transcript loaded: {len(reference_transcript.split())} words")
    
    # Run comparison
    results = run_comparison(audio_path, reference_transcript)
    
    # Print results
    print_results(results, reference_transcript)
    
    # Save results to JSON
    output_file = base_dir / "model_comparison_results.json"
    
    # Make results JSON serializable
    serializable_results = {}
    for name, data in results.items():
        serializable_results[name] = {
            'model': data['model'],
            'wer': data['wer'],
            'wer_details': data['wer_details'],
            'processing_time': data['processing_time'],
            'transcript_preview': data['transcript'][:500]
        }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(serializable_results, f, indent=2)
    
    print(f"\n✓ Results saved to: {output_file}")


if __name__ == "__main__":
    main()
