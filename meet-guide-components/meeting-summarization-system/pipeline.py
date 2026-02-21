# Main Processing Pipeline - Orchestrator

import sys
import torch
from bson import ObjectId
from models import get_nlp, get_tokenizer, get_model, get_device
from intent_refiner import refine_intent
from action_item_extraction import (
    extract_what_refined,
    extract_assignee_context,
    extract_when_trf,
    compute_priority_by_deadline,
)
from topic_modeling import assign_topics, attach_nearest_topic, group_by_topics
from config import ACTION_LEMMAS

# Fix Windows console encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass


def process_meeting_transcript(raw_transcript_list):
    """
    Main pipeline: Process a list of transcript turns and extract intents, actions, and topics.
    
    Input: List of dicts with 'speaker' and 'sentence' keys
    Output: List of structured results with intent, speaker, sentence, details
    """
    nlp = get_nlp()
    tokenizer = get_tokenizer()
    model = get_model()
    device = get_device()

    structured_results = []

    # --- Speaker Tracking Variables ---
    current_speaker_name = None
    last_different_speaker = None
    last_topic_noun = None

    print(f"\n🚀 Processing {len(raw_transcript_list)} utterances...")

    for i, turn in enumerate(raw_transcript_list):
        speaker = turn['speaker']

        # Track speaker changes
        if speaker != current_speaker_name:
            if current_speaker_name is not None:
                last_different_speaker = current_speaker_name
            current_speaker_name = speaker

        # Handle input key mismatch (sentence vs text)
        text = turn.get('sentence', turn.get('text', ''))
        clean_text = text.replace("'", "'").replace(""", '"').replace(""", '"')

        # Run spaCy
        doc_full = nlp(clean_text)
        sent_spans = [s for s in doc_full.sents if len(s.text.strip()) > 2]

        for sent_span in sent_spans:
            sent_text = sent_span.text.strip()

            # Predict Intent with DistilBERT
            inputs = tokenizer(sent_text, return_tensors="pt", truncation=True, max_length=128).to(device)
            with torch.no_grad():
                outputs = model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            score, idx = torch.max(probs, dim=-1)
            raw_label = model.config.id2label[idx.item()]

            # Refine Intent with rule-based logic
            final_intent = refine_intent(sent_text, raw_label, score.item())

            details = None
            if final_intent == "action-item":
                # Find action verb
                main_verb = None
                for t in sent_span:
                    if t.pos_ == "VERB" and t.lemma_.lower() in ACTION_LEMMAS:
                        main_verb = t
                        break
                if not main_verb:
                    main_verb = sent_span.root

                # Handle "Let's" cases - find the actual action verb
                if main_verb.lemma_.lower() == "let":
                    for child in main_verb.children:
                        if child.dep_ in ("ccomp", "xcomp") and child.pos_ == "VERB":
                            main_verb = child
                            break

                # Extract What, Who, When
                task = extract_what_refined(sent_span, main_verb)

                # Context memory for pronouns like "it/this/that"
                if task is None or task.lower().replace(main_verb.text.lower(), "").strip() in ["it", "this", "that", ""]:
                    if last_topic_noun:
                        task = f"{task if task else main_verb.text + ' it'} ({last_topic_noun})"

                details = {
                    "who": extract_assignee_context(sent_span, main_verb, speaker, last_different_speaker),
                    "what": task,
                    "when": extract_when_trf(sent_span)
                }

            # Update memory with context nouns for future pronouns
            chunks = list(sent_span.noun_chunks)
            for chunk in reversed(chunks):
                root = chunk.root
                if root.pos_ == "PRON":
                    continue
                if root.ent_type_ in ("PERSON", "DATE", "TIME"):
                    continue
                if any(w in root.text.lower() for w in ["night", "morning", "today", "tomorrow"]):
                    continue
                last_topic_noun = chunk.text
                break

            # Store result if valid
            if final_intent in ["action-item", "decision", "concern", "question", "inform"]:
                if sent_text and final_intent:
                    structured_results.append({
                        "_id": str(ObjectId()),  # Generate unique ID for each result
                        "speaker": speaker,
                        "sentence": sent_text,
                        "intent": final_intent,
                        "details": details,
                        # Default lifecycle for action items; other intents omit status
                        "status": "pending" if final_intent == "action-item" else None,
                        # Priority derived from deadline proximity
                        "priority": compute_priority_by_deadline(details.get("when")) if final_intent == "action-item" else None
                    })

    return structured_results


def run_full_pipeline(raw_transcript_list):
    """
    Run the complete pipeline: process transcript → assign topics → generate labels → group topics.
    
    Returns:
    - results: Structured results with intents
    - final_topics: Grouped topics with labels
    """
    # Step 1: Process transcript and extract intents
    results = process_meeting_transcript(raw_transcript_list)

    # Step 2: Assign topics based on semantic similarity
    results = assign_topics(results)

    # Step 3: Attach nearest topic (cleanup any outliers)
    results = attach_nearest_topic(results)

    # Step 4: Group by topics and generate labels
    final_topics = group_by_topics(results)

    return results, final_topics
