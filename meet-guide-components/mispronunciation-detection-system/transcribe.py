import os
import sys
import io
import json
import re
import argparse
from pathlib import Path
from typing import Dict, Any, List, Tuple
from collections import defaultdict
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Fix encoding for Windows console (needed when launched from PM2/services)
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from deepgram import DeepgramClient


def add_punctuation_to_text(text: str) -> str:
    """
    Add punctuation to a transcript text that may be missing punctuation.
    Uses simple rules to add periods, commas, and question marks.
    
    Args:
        text: The raw transcript text
        
    Returns:
        Text with punctuation added
    """
    if not text:
        return text
    
    # Already has good punctuation - return as is
    punct_count = text.count('.') + text.count(',') + text.count('?') + text.count('!')
    if punct_count >= 2:
        return text
    
    # Sentence boundary markers - words that typically start new sentences
    sentence_starters = {
        'i', 'we', 'they', 'you', 'he', 'she', 'it', 'the', 'this', 'that', 
        'there', 'here', 'my', 'our', 'your', 'his', 'her', 'its', 'their',
        'what', 'where', 'when', 'why', 'how', 'who', 'which',
        'let', 'please', 'thanks', 'thank', 'sorry', 'yes', 'no', 'okay', 'ok',
        'also', 'plus', 'and', 'but', 'so', 'if', 'maybe', 'perhaps'
    }
    
    # Words that typically end sentences or clauses
    clause_enders = {
        'too', 'well', 'now', 'then', 'here', 'there', 'today', 'tomorrow',
        'anyway', 'though', 'right', 'okay', 'ok'
    }
    
    # Comma triggers - words that often have comma after them
    comma_after_words = {
        'yes', 'no', 'well', 'okay', 'ok', 'hey', 'hi', 'hello',
        'honestly', 'basically', 'actually', 'obviously', 'clearly',
        'look', 'see', 'anyway', 'however', 'therefore', 'meanwhile',
        'first', 'second', 'third', 'finally', 'also', 'plus'
    }
    
    # Comma before these conjunctions (when mid-sentence)
    comma_before_conj = {'but', 'yet', 'however', 'although', 'though', 'because', 'since', 'so'}
    
    words = text.split()
    if len(words) < 3:
        return text.strip() + '.'
    
    result = []
    
    for i, word in enumerate(words):
        clean = word.lower().strip()
        prev_word = words[i - 1].lower().strip() if i > 0 else ''
        next_word = words[i + 1].lower().strip() if i + 1 < len(words) else ''
        
        # Skip if already has punctuation
        if word and word[-1] in '.,!?;:':
            result.append(word)
            continue
        
        # Add comma after intro words at very beginning
        if i == 0 and clean in comma_after_words:
            result.append(word + ',')
            continue
        
        # Check for sentence boundary: previous word ends clause, current word starts new sentence
        is_boundary = False
        if i > 3 and clean in sentence_starters and prev_word in clause_enders:
            is_boundary = True
        
        # Natural break: after certain patterns, before personal pronouns or sentence starters
        if i > 5 and clean in {'i', 'we', 'they', 'you', 'he', 'she', 'it', 'that', 'this'}:
            # Check if previous few words could be end of sentence
            if prev_word not in {'and', 'or', 'but', 'that', 'which', 'who', 'to', 'a', 'an', 'the', 'of', 'in', 'on', 'for', 'with'}:
                is_boundary = True
        
        # Add comma before certain conjunctions
        if clean in comma_before_conj and i > 2:
            if result and result[-1][-1] not in '.,!?;:,':
                result[-1] = result[-1] + ','
        
        if is_boundary and result:
            # End previous sentence
            if result[-1][-1] not in '.,!?;:':
                result[-1] = result[-1] + '.'
        
        result.append(word)
    
    # Ensure text ends with punctuation
    if result and result[-1][-1] not in '.,!?;:':
        result[-1] = result[-1] + '.'
    
    return ' '.join(result)


def add_smart_punctuation(text: str) -> str:
    """
    Add smart punctuation to transcript using linguistic rules.
    Provides natural sentence breaks based on speech patterns.
    
    Args:
        text: Raw transcript text
        
    Returns:
        Text with intelligent punctuation
    """
    if not text:
        return text
    
    # Already has good punctuation - return as is
    punct_count = text.count('.') + text.count(',') + text.count('?') + text.count('!')
    if punct_count >= 3:
        return text
    
    words = text.split()
    if len(words) < 4:
        text = text.strip()
        if text and text[-1] not in '.,!?':
            text += '.'
        return text
    
    # Question indicators
    question_starters = {'what', 'where', 'when', 'why', 'how', 'who', 'which', 'whose', 'whom',
                         'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 
                         'would', 'should', 'will', 'shall', 'have', 'has', 'had', 'may', 'might'}
    
    # Comma after these words (when at start)
    comma_intro = {'yes', 'no', 'well', 'okay', 'ok', 'hey', 'hi', 'hello', 'look', 'see',
                   'honestly', 'basically', 'actually', 'obviously', 'anyway', 'alright'}
    
    # Add comma before these (mid-sentence)
    comma_before = {'but', 'yet', 'however', 'although', 'though', 'because', 'since', 'so', 'and'}
    
    result = []
    is_question = words[0].lower() in question_starters
    
    for i, word in enumerate(words):
        clean = word.lower().strip()
        
        # Already has punctuation
        if word and word[-1] in '.,!?;:':
            result.append(word)
            # Reset question detection for next sentence
            if i + 1 < len(words):
                is_question = words[i + 1].lower() in question_starters
            continue
        
        # Comma after intro word at start
        if i == 0 and clean in comma_intro:
            result.append(word + ',')
            continue
        
        # After a sentence end (detected by capital letter following), add comma for intros
        if result and result[-1].endswith('.') and clean in comma_intro:
            result.append(word + ',')
            continue
        
        # Add comma before certain conjunctions (if not at start)
        if i > 2 and clean in comma_before:
            if result and result[-1][-1] not in '.,!?;:,':
                result[-1] = result[-1] + ','
        
        result.append(word)
    
    # Final punctuation
    if result and result[-1][-1] not in '.,!?;:':
        punct = '?' if is_question else '.'
        result[-1] = result[-1] + punct
    
    return ' '.join(result)


def transcribe_audio(audio_file_path: str, deepgram_client: DeepgramClient) -> Dict[str, Any]:
    """
    Transcribe an audio file using Deepgram's nova-2 model.
    
    Args:
        audio_file_path: Path to the audio file to transcribe
        deepgram_client: Initialized Deepgram client
        
    Returns:
        Dictionary containing the full response data
    """
    # Verify the audio file exists
    if not os.path.exists(audio_file_path):
        raise FileNotFoundError(f"Audio file not found at {audio_file_path}")
    
    try:
        # Read the audio file
        print(f"  📄 Reading: {os.path.basename(audio_file_path)}")
        with open(audio_file_path, "rb") as audio_file:
            audio_data = audio_file.read()
        
        # Send the audio to Deepgram for transcription
        print(f"  🎙️  Transcribing...")
        
        response = deepgram_client.listen.v1.media.transcribe_file(
            request=audio_data,          # Audio data as bytes
            model="nova-2",              # Use the nova-2 model for high accuracy
            punctuate=True,              # Enable punctuation
            diarize=True,                # Enable speaker diarization
            paragraphs=True,             # Enable paragraph formatting
            filler_words=False,          # Disable filler words (um, uh, etc.)
            smart_format=True,           # Smart formatting for better readability
        )
        
        # Extract transcript
        transcript = response.results.channels[0].alternatives[0].transcript
        
        if not transcript:
            print("  ⚠️  Warning: No transcript generated")
            transcript = ""
        
        # Build result dictionary
        result = {
            "transcript": transcript,
            "metadata": {
                "duration": response.metadata.duration if hasattr(response.metadata, 'duration') else None,
                "channels": response.metadata.channels if hasattr(response.metadata, 'channels') else None,
                "model": "nova-2"
            },
            "words": [],
            "paragraphs": []
        }
        
        # Extract word-level details
        words = response.results.channels[0].alternatives[0].words
        if words:
            result["words"] = [
                {
                    "word": word.word,
                    "start": word.start,
                    "end": word.end,
                    "confidence": word.confidence,
                    "speaker": word.speaker if hasattr(word, 'speaker') else None
                }
                for word in words
            ]
        
        # Extract paragraph information
        if hasattr(response.results.channels[0].alternatives[0], 'paragraphs'):
            paragraphs_obj = response.results.channels[0].alternatives[0].paragraphs
            if paragraphs_obj and paragraphs_obj.paragraphs:
                result["paragraphs"] = [
                    {
                        "sentences": [
                            {
                                "text": sentence.text,
                                "start": sentence.start,
                                "end": sentence.end
                            }
                            for sentence in paragraph.sentences
                        ],
                        "start": paragraph.start,
                        "end": paragraph.end,
                        "num_words": paragraph.num_words
                    }
                    for paragraph in paragraphs_obj.paragraphs
                ]
        
        print(f"  ✅ Completed")
        return result
        
    except Exception as e:
        print(f"  ❌ Error: {type(e).__name__}: {str(e)}")
        raise


def format_transcript_text(transcript: str) -> str:
    """
    Format transcript text with proper capitalization and line breaks per sentence.
    
    Args:
        transcript: Raw transcript text
        
    Returns:
        Formatted transcript with sentences on separate lines
    """
    if not transcript:
        return ""
    
    # Split into sentences (approximate - based on punctuation)
    import re
    
    # Capitalize first letter
    text = transcript.strip()
    if text:
        text = text[0].upper() + text[1:]
    
    # Split by sentence-ending punctuation followed by space
    sentences = re.split(r'([.!?]\s+)', text)
    
    # Recombine sentences with their punctuation
    formatted_sentences = []
    for i in range(0, len(sentences), 2):
        if i < len(sentences):
            sentence = sentences[i]
            if i + 1 < len(sentences):
                sentence += sentences[i + 1].rstrip()
            
            sentence = sentence.strip()
            if sentence:
                # Capitalize first letter of sentence
                sentence = sentence[0].upper() + sentence[1:] if len(sentence) > 1 else sentence.upper()
                formatted_sentences.append(sentence)
    
    # If no sentence breaks found, return original with capitalization
    if not formatted_sentences:
        return text
    
    return "\n".join(formatted_sentences)


def save_transcript(result: Dict[str, Any], output_path: Path, base_name: str) -> None:
    """
    Save transcript as both TXT and JSON files.
    
    Args:
        result: Transcription result dictionary
        output_path: Directory to save files
        base_name: Base name for output files (without extension)
    """
    # Format the transcript text
    formatted_text = format_transcript_text(result["transcript"])
    
    # Save TXT file with formatted text
    txt_file = output_path / f"{base_name}.txt"
    with open(txt_file, "w", encoding="utf-8") as f:
        f.write(formatted_text)
    print(f"  💾 Saved: {txt_file}")
    
    # Save JSON file
    json_file = output_path / f"{base_name}.json"
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"  💾 Saved: {json_file}")


def find_participant_audio_files(folder_path: Path) -> List[Path]:
    """
    Find all participant audio files in the folder.
    These are typically .wav files with 'converted' in the name.
    
    Args:
        folder_path: Path to the folder to search
        
    Returns:
        List of audio file paths
    """
    audio_files = []
    
    # Look for converted .wav files (participant tracks)
    for file in folder_path.glob("*_converted.wav"):
        audio_files.append(file)
    
    # If no converted files, look for any .wav files that aren't the merged audio
    if not audio_files:
        for file in folder_path.glob("*.wav"):
            if "merged_audio" not in file.name:
                audio_files.append(file)
    
    return sorted(audio_files)


def extract_participant_name(filename: str) -> str:
    """
    Extract participant name from filename.
    Handles email format like 'chalana_gmail_com' -> 'chalana@gmail.com'
    
    Args:
        filename: Audio filename
        
    Returns:
        Participant name (email address if found)
    """
    # Remove extension
    name = Path(filename).stem
    
    # Remove '_converted' suffix if present
    name = name.replace("_converted", "")
    
    # Split by underscores
    parts = name.split("_")
    
    # Find the index where year appears (2025, 2024, etc.)
    year_index = -1
    for i, part in enumerate(parts):
        if part.startswith("20") and len(part) >= 4 and part[:4].isdigit():
            year_index = i
            break
    
    # If we found a year, check for email pattern (name_domain_extension before the year)
    if year_index >= 3:
        # Check if the 3 parts before year form an email (e.g., chalana_gmail_com)
        potential_extension = parts[year_index - 1]  # e.g., "com"
        potential_domain = parts[year_index - 2]     # e.g., "gmail"
        potential_name = parts[year_index - 3]       # e.g., "chalana"
        
        # Common email extensions
        common_extensions = ["com", "org", "net", "edu", "gov", "io", "co", "uk", "in"]
        # Common domains
        common_domains = ["gmail", "yahoo", "outlook", "hotmail", "protonmail", "icloud"]
        
        # Check if this looks like an email pattern
        if potential_extension in common_extensions and (
            potential_domain in common_domains or 
            len(potential_domain) > 2
        ):
            # Reconstruct as email: name@domain.extension
            email = f"{potential_name}@{potential_domain}.{potential_extension}"
            return email
    
    # Fallback: Look for capitalized words or reasonable name patterns
    name_candidates = []
    for part in parts:
        # Look for name-like segments
        if part and len(part) > 2:
            # Skip common non-name patterns
            if part not in ["Remote", "Rec", "AAAR", "AAAN", "AAAL", "AAAP"] and not part.startswith("koMX") and not part.startswith("uxQv"):
                # If it's capitalized or looks like a name
                if part[0].isupper() and not part.isupper():
                    name_candidates.append(part.capitalize())
    
    # Return the last name candidate (usually the actual person name)
    if name_candidates:
        return name_candidates[-1]
    
    # Fallback: use the whole cleaned name
    return name


def match_speakers_to_participants(
    global_transcript: Dict[str, Any],
    participant_transcripts: Dict[str, Dict[str, Any]]
) -> Dict[int, str]:
    """
    Match speaker IDs from global transcript to participant names.
    Uses word overlap to determine which speaker corresponds to which participant.
    
    Args:
        global_transcript: Global transcript with speaker information
        participant_transcripts: Dict of participant name -> their transcript
        
    Returns:
        Dict mapping speaker ID to participant name
    """
    # Extract words by speaker from global transcript
    speaker_words = defaultdict(list)
    for word_info in global_transcript.get("words", []):
        speaker_id = word_info.get("speaker")
        if speaker_id is not None:
            speaker_words[speaker_id].append(word_info["word"].lower())
    
    # Create word sets for each speaker
    speaker_word_sets = {
        speaker: set(words) for speaker, words in speaker_words.items()
    }
    
    # Create word sets for each participant (case-insensitive)
    participant_word_sets = {}
    participant_name_mapping = {}  # lowercase -> original name
    
    for name, transcript_data in participant_transcripts.items():
        words = [w["word"].lower() for w in transcript_data.get("words", [])]
        participant_word_sets[name.lower()] = set(words)
        participant_name_mapping[name.lower()] = name
    
    # Match speakers to participants based on word overlap
    speaker_to_participant = {}
    used_participants = set()
    
    for speaker_id, speaker_word_set in speaker_word_sets.items():
        best_match = None
        best_overlap = 0
        
        for participant_name_lower, participant_word_set in participant_word_sets.items():
            if participant_name_lower in used_participants:
                continue
            
            # Calculate overlap
            overlap = len(speaker_word_set & participant_word_set)
            
            if overlap > best_overlap:
                best_overlap = overlap
                best_match = participant_name_lower
        
        if best_match and best_overlap > 5:  # Minimum threshold
            # Use the properly capitalized name
            speaker_to_participant[speaker_id] = participant_name_mapping[best_match]
            used_participants.add(best_match)
    
    return speaker_to_participant


def fix_capitalization(text: str) -> str:
    """
    Fix capitalization in transcript text.
    - Capitalize first letter of sentences
    - Capitalize 'I' when standalone
    - Capitalize proper nouns and common names
    
    Args:
        text: Text to fix
        
    Returns:
        Text with proper capitalization
    """
    if not text:
        return text
    
    # Fix standalone "i" to "I"
    text = re.sub(r'\bi\b', 'I', text)
    
    # Fix "i'm", "i'll", "i've", "i'd" etc.
    text = re.sub(r"\bi'm\b", "I'm", text, flags=re.IGNORECASE)
    text = re.sub(r"\bi'll\b", "I'll", text, flags=re.IGNORECASE)
    text = re.sub(r"\bi've\b", "I've", text, flags=re.IGNORECASE)
    text = re.sub(r"\bi'd\b", "I'd", text, flags=re.IGNORECASE)
    
    # Capitalize after sentence-ending punctuation
    text = re.sub(r'([.!?])\s+([a-z])', lambda m: m.group(1) + ' ' + m.group(2).upper(), text)
    
    # Capitalize first letter
    if text and text[0].islower():
        text = text[0].upper() + text[1:]
    
    return text


def generate_speaker_attributed_transcript(
    global_transcript: Dict[str, Any],
    speaker_mapping: Dict[int, str]
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Generate a transcript with speaker names attributed to each utterance.
    
    Args:
        global_transcript: Global transcript with speaker information
        speaker_mapping: Dict mapping speaker ID to participant name
        
    Returns:
        Tuple of (formatted text transcript, structured data)
    """
    words = global_transcript.get("words", [])
    
    if not words:
        return "", []
    
    # Group consecutive words by speaker
    utterances = []
    current_speaker = None
    current_words = []
    current_start = None
    
    for word_info in words:
        speaker_id = word_info.get("speaker")
        speaker_name = speaker_mapping.get(speaker_id, f"Speaker {speaker_id}")
        
        if speaker_id != current_speaker:
            # Save previous utterance
            if current_words:
                utterances.append({
                    "speaker": speaker_mapping.get(current_speaker, f"Speaker {current_speaker}"),
                    "text": " ".join(current_words),
                    "start": current_start,
                    "end": words[len(utterances) * len(current_words) - 1].get("end") if utterances else word_info.get("start")
                })
            
            # Start new utterance
            current_speaker = speaker_id
            current_words = [word_info["word"]]
            current_start = word_info.get("start")
        else:
            current_words.append(word_info["word"])
    
    # Add last utterance
    if current_words:
        utterances.append({
            "speaker": speaker_mapping.get(current_speaker, f"Speaker {current_speaker}"),
            "text": " ".join(current_words),
            "start": current_start,
            "end": words[-1].get("end")
        })
    
    # Format as text with proper capitalization, punctuation, and line breaks
    formatted_lines = []
    for utterance in utterances:
        # Capitalize speaker name and first letter of text
        speaker = utterance['speaker']
        text = utterance['text'].strip()
        
        # Add smart punctuation to the text
        text = add_smart_punctuation(text)
        
        # Fix capitalization (I, sentence starts, etc.)
        text = fix_capitalization(text)
        
        # Update utterance with punctuated text
        utterance['text'] = text
        
        formatted_lines.append(f"{speaker}: {text}")
    
    # Join with newlines for better readability
    formatted_text = "\n\n".join(formatted_lines)
    
    return formatted_text, utterances


def create_speaker_attributed_transcript(folder_path: Path, folder_name: str) -> None:
    """
    Create a speaker-attributed transcript by matching speakers to participants.
    
    Args:
        folder_path: Path to the folder
        folder_name: Name of the folder
    """
    print("\n" + "=" * 80)
    print("👥 GENERATING SPEAKER-ATTRIBUTED TRANSCRIPT")
    print("=" * 80 + "\n")
    
    # Load global transcript
    global_transcript_file = folder_path / "global_transcript" / f"{folder_name}_global_transcript.json"
    if not global_transcript_file.exists():
        print("❌ Error: Global transcript JSON not found")
        return
    
    print(f"📖 Loading global transcript...")
    with open(global_transcript_file, "r", encoding="utf-8") as f:
        global_transcript = json.load(f)
    
    # Load all participant transcripts
    participant_transcript_dir = folder_path / "participant_transcripts"
    if not participant_transcript_dir.exists():
        print("❌ Error: Participant transcripts directory not found")
        return
    
    participant_transcripts = {}
    print(f"📖 Loading participant transcripts...")
    
    for json_file in participant_transcript_dir.glob("*.json"):
        participant_name = json_file.stem
        with open(json_file, "r", encoding="utf-8") as f:
            participant_transcripts[participant_name] = json.load(f)
        print(f"   • Loaded: {participant_name}")
    
    if not participant_transcripts:
        print("❌ Error: No participant transcripts found")
        return
    
    # Match speakers to participants
    print(f"\n🔍 Matching speakers to participants...")
    speaker_mapping = match_speakers_to_participants(global_transcript, participant_transcripts)
    
    if not speaker_mapping:
        print("⚠️  Warning: Could not match speakers to participants")
        print("   Using speaker IDs instead of names")
        # Create default mapping
        words = global_transcript.get("words", [])
        unique_speakers = set(w.get("speaker") for w in words if w.get("speaker") is not None)
        speaker_mapping = {s: f"Speaker {s}" for s in unique_speakers}
    else:
        print(f"✅ Successfully matched {len(speaker_mapping)} speaker(s):")
        for speaker_id, name in speaker_mapping.items():
            print(f"   • Speaker {speaker_id} → {name}")
    
    # Generate speaker-attributed transcript
    print(f"\n📝 Generating speaker-attributed transcript...")
    formatted_text, utterances = generate_speaker_attributed_transcript(
        global_transcript, speaker_mapping
    )
    
    # Save results
    output_dir = folder_path / "global_transcript"
    
    # Save TXT
    txt_file = output_dir / f"{folder_name}_speaker_attributed.txt"
    with open(txt_file, "w", encoding="utf-8") as f:
        f.write(formatted_text)
    print(f"💾 Saved: {txt_file}")
    
    # Save JSON
    json_data = {
        "speaker_mapping": speaker_mapping,
        "utterances": utterances,
        "formatted_transcript": formatted_text
    }
    json_file = output_dir / f"{folder_name}_speaker_attributed.json"
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)
    print(f"💾 Saved: {json_file}")
    
    print(f"\n✅ Speaker-attributed transcript completed!")
    print(f"   Total utterances: {len(utterances)}")


def process_folder(folder_name: str) -> None:
    """
    Process all audio files in the given folder.
    
    Args:
        folder_name: Name of the folder containing audio files
    """
    print(f"\n{'='*80}")
    print(f"🎯 Processing folder: {folder_name}")
    print(f"{'='*80}\n")
    
    # Verify API key
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        print("❌ Error: DEEPGRAM_API_KEY environment variable not set")
        sys.exit(1)
    
    # Initialize Deepgram client
    print("🔧 Initializing Deepgram client...")
    deepgram = DeepgramClient()
    
    # Setup paths
    folder_path = Path(folder_name)
    if not folder_path.exists():
        print(f"❌ Error: Folder '{folder_name}' does not exist")
        sys.exit(1)
    
    # Find merged audio file
    merged_audio = folder_path / f"{folder_name}_merged_audio.wav"
    if not merged_audio.exists():
        print(f"❌ Error: Merged audio file not found: {merged_audio}")
        sys.exit(1)
    
    # Create output directories
    global_transcript_dir = folder_path / "global_transcript"
    participant_transcript_dir = folder_path / "participant_transcripts"
    
    global_transcript_dir.mkdir(exist_ok=True)
    participant_transcript_dir.mkdir(exist_ok=True)
    
    print(f"📁 Output directories created")
    print(f"   • {global_transcript_dir}")
    print(f"   • {participant_transcript_dir}\n")
    
    # Process merged audio (global transcript)
    print("=" * 80)
    print("🌍 PROCESSING GLOBAL TRANSCRIPT")
    print("=" * 80)
    
    try:
        result = transcribe_audio(str(merged_audio), deepgram)
        save_transcript(result, global_transcript_dir, f"{folder_name}_global_transcript")
        print(f"✅ Global transcript completed\n")
    except Exception as e:
        print(f"❌ Failed to process global transcript: {e}\n")
    
    # Find and process participant audio files
    participant_files = find_participant_audio_files(folder_path)
    
    if not participant_files:
        print("⚠️  No participant audio files found")
        return
    
    print("=" * 80)
    print(f"👥 PROCESSING PARTICIPANT TRANSCRIPTS ({len(participant_files)} files)")
    print("=" * 80 + "\n")
    
    for i, audio_file in enumerate(participant_files, 1):
        participant_name = extract_participant_name(audio_file.name)
        print(f"[{i}/{len(participant_files)}] Processing: {participant_name}")
        
        try:
            result = transcribe_audio(str(audio_file), deepgram)
            save_transcript(result, participant_transcript_dir, participant_name)
            print()
        except Exception as e:
            print(f"  ❌ Failed: {e}\n")
            continue
    
    print("=" * 80)
    print("🎉 ALL TRANSCRIPTIONS COMPLETED!")
    print("=" * 80)
    
    # Generate speaker-attributed transcript
    create_speaker_attributed_transcript(folder_path, folder_name)


def main():
    """Main entry point for the transcription script."""
    parser = argparse.ArgumentParser(
        description="Transcribe audio files using Deepgram API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python transcribe.py projectmeeting1
  python transcribe.py --folder projectmeeting1
  python transcribe.py meet3
        """
    )
    
    parser.add_argument(
        "folder",
        nargs="?",
        help="Folder name containing audio files (e.g., projectmeeting1)"
    )
    
    parser.add_argument(
        "--folder",
        dest="folder_alt",
        help="Alternative way to specify folder name"
    )
    
    args = parser.parse_args()
    
    # Get folder name from either argument
    folder_name = args.folder or args.folder_alt
    
    if not folder_name:
        parser.print_help()
        print("\n❌ Error: Please provide a folder name")
        print("Example: python transcribe.py projectmeeting1")
        sys.exit(1)
    
    # Remove leading dashes if present
    folder_name = folder_name.lstrip("-")
    
    process_folder(folder_name)


if __name__ == "__main__":
    main()
