# ------------------------------
# MODEL & PIPELINE SETUP (VS Code / Windows)
# ------------------------------

import json
import os
import torch
import spacy
import spacy_transformers
import re
import string
import dateparser
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from datetime import datetime
from dateparser.search import search_dates


# ----- spaCy Transformer -----
print("⏳ Loading spaCy Transformer (trf)...")
try:
    # Attempt high-accuracy transformer model
    nlp = spacy.load("en_core_web_trf")
    print("✅ Loaded: en_core_web_trf (High Accuracy)")
except Exception as e:
    print(f"❌ Failed to load spaCy trf: {e}")
    print("⚠️ Falling back to en_core_web_sm (lower accuracy)")
    nlp = spacy.load("en_core_web_sm")

# ----- DistilBERT for Intent Detection -----
MODEL_PATH = "models/final_clean_model"  
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"💻 Using device: {device}")

try:
    # Load tokenizer & model
    tokenizer = DistilBertTokenizer.from_pretrained(MODEL_PATH)
    model = DistilBertForSequenceClassification.from_pretrained(MODEL_PATH).to(device)
    model.eval()
    print("✅ DistilBERT Loaded Successfully!")
except Exception as e:
    print(f"❌ Error loading DistilBERT model: {e}")
    print("Make sure your folder contains:")
    print("  - config.json")
    print("  - pytorch_model.bin")
    print("  - tokenizer.json or vocab.txt")

# ----- Safety Fix for Windows -----
# Prevent KMP duplicate library error (common with torch + spacy_transformers)
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE" 









def refine_intent(text, predicted_label, confidence):
    text_lower = text.lower().strip()

    # =========================================================
    # 1. NOISE & FILLER FILTER (The Smart Part)
    # =========================================================

    process_keywords = [
        "get started", "getting started", "start the meeting", "check one",
        "wrap up", "call it a day", "break for lunch", "take a break",
        "move on", "next slide", "next topic", "back to the agenda",
        "can you hear me", "can you see my screen", "thanks everyone",
        "bye", "have a good day", "any other business", "sounds good",
        "hear you", "on mute", "unmute"
    ]
    if any(p in text_lower for p in process_keywords):
        return None

    clean_text = text_lower.translate(str.maketrans('', '', string.punctuation))

    filler_words = [
        "okay", "ok", "yeah", "yes", "yep", "right", "sure",
        "cool", "mhmm", "uh huh", "great", "perfect", "hey",
    ]

    if clean_text in filler_words or clean_text in ["thank you", "thanks"]:
        return None

    if len(clean_text.split()) <= 2:
        return None

    # =========================================================
    # HOPE / WISH STATEMENTS → INFORM
    # =========================================================
    if "i hope" in text_lower or "i will hope" in text_lower or "i'm hoping" in text_lower:
        return "inform"

    # =========================================================
    # CONFIDENCE THRESHOLD
    # =========================================================
    if confidence < 0.50:
        predicted_label = "inform"

    # =========================================================
    # DECISION REFINEMENT
    # =========================================================
    decision_keywords = [
        "decide", "decided", "agreed", "settled", "resolved",
        "go with", "stick with", "adopt", "selected",
        "final decision", "we will use", "plan is to"
    ]

    if any(k in text_lower for k in decision_keywords):
        return "decision"

    # =========================================================
    # ACTION-ITEM BOOSTER
    # =========================================================
    if predicted_label == "question":
        if any(s in text_lower for s in ["can you", "could you", "would you", "will you"]):
            return "action-item"

    if predicted_label == "inform":
        if "letting you know" in text_lower:
            return "inform"

        action_keywords = [
            "i will", "i'll", "we will", "we'll",
            "let's", "lets", "need to", "have to", "must"
        ]
        if any(k in text_lower for k in action_keywords):
            return "action-item"

    # =========================================================
    # CONCERN BOOSTER
    # =========================================================
    concern_keywords = [
        "risk", "worried", "concern", "issue",
        "problem", "blocker", "delay", "afraid", "unsure"
    ]
    if predicted_label == "inform" and any(k in text_lower for k in concern_keywords):
        return "concern"

    # =========================================================
    # INFORM CONTEXT FILTER
    # =========================================================
    if predicted_label == "inform":
        important_context_keywords = [
            "sprint", "deadline", "launch", "logs", "data",
            "vendor", "delay", "environment", "staging", "production"
        ]

        if any(k in text_lower for k in important_context_keywords):
            return "inform"
        else:
            return None

    # =========================================================
    # STATUS REPORT FILTER
    # =========================================================
    past_tense_indicators = [
        "already", "done", "completed", "finished",
        "sent", "uploaded", "fixed", "resolved"
    ]

    if predicted_label == "action-item":
        if any(w in text_lower.split() for w in past_tense_indicators):
            if not any(f in text_lower for f in ["will", "ll", "going to"]):
                return "inform"

    return predicted_label






# --- SETTINGS ---
DPARSE_SETTINGS = {
    "RELATIVE_BASE": datetime.now(),
    "PREFER_DATES_FROM": "future",
    "RETURN_AS_TIMEZONE_AWARE": False,
    "STRICT_PARSING": False,
}

ACTION_VERBS = {
    "send", "prepare", "launch", "schedule", "share", "follow", "update",
    "finalize", "upload", "coordinate", "review", "organize", "book",
    "confirm", "draft", "email", "deliver", "check", "fix", "investigate",
    "create", "assign", "deploy", "push", "run", "verify", "notify", "backup"
}
ACTION_LEMMAS = {v.lower() for v in ACTION_VERBS}

# ==============================================================================
# 3. EXTRACTION LOGIC
# ==============================================================================
def extract_what_refined(doc, verb):
    items = []
    for child in verb.children:
        if child.dep_ in ("dobj", "attr", "pobj"):
            subtree = list(child.subtree)
            clean_toks = []
            for t in subtree:
                if t.ent_type_ in ("DATE", "TIME"):
                    continue
                if t.dep_ == "prep" and t.head == verb:
                    continue
                clean_toks.append(t.text)
            phrase = " ".join(clean_toks).strip()
            phrase = re.sub(r'\s+([?.!,"])', r'\1', phrase)
            if phrase:
                items.append(f"{verb.text} {phrase}")
    return ", ".join(items) if items else None



def extract_assignee_context(doc, verb, current_speaker, prev_speaker):
    def map_sub(token):
        t = token.text.lower()
        if t in ["i", "me", "my"]: return current_speaker
        if t in ["we", "us","'s"]: return "Team / All"
        if t == "you": return f"{prev_speaker} (Implied)" if prev_speaker else "Unassigned"
        return token.text

    for child in verb.children:
        if child.dep_ == "nsubj":
            vocatives = [t.text for t in doc if t.dep_ == "npadvmod" and t.pos_ == "PROPN"]
            if child.text.lower() == "you" and vocatives: return vocatives[0]
            return map_sub(child)
    if verb.dep_ == "xcomp":
        parent = verb.head
        for child in parent.children:
            if child.dep_ == "nsubj": return map_sub(child)
    return "Unassigned / Team"

def extract_when_trf(span):
    text = span.text
    text_lower = text.lower()

    # 1. Get entities from the span (spaCy)
    time_ents = sorted(
        [ent for ent in span.ents if ent.label_ in ("DATE", "TIME")],
        key=lambda e: e.start
    )

    # 2. Merge adjacent entities
    merged_strings = []
    if time_ents:
        current_merge_start = time_ents[0].start_char
        current_merge_end = time_ents[0].end_char
        last_ent = time_ents[0]

        for i in range(1, len(time_ents)):
            curr = time_ents[i]
            gap_text = span.doc.text[last_ent.end_char:curr.start_char].lower().strip()

            # allow small connectors between date/time chunks
            if gap_text in ["", "at", "on", ",", "by", "around", "before", "until"]:
                current_merge_end = curr.end_char
                last_ent = curr
            else:
                full_text = span.doc.text[current_merge_start:current_merge_end]
                merged_strings.append(full_text)
                current_merge_start = curr.start_char
                current_merge_end = curr.end_char
                last_ent = curr

        # final cluster
        full_text = span.doc.text[current_merge_start:current_merge_end]
        merged_strings.append(full_text)

    # 3. Manual cues (EOD / tonight, etc.)
    if "eod" in text_lower:
        merged_strings.append("end of day")
    if "tonight" in text_lower:
        merged_strings.append("tonight")

    valid_dates = []

    # 4. First pass: parse the merged strings
    for t in merged_strings:
        if t.lower() in ["now", "then", "once"]:
            continue

        dt = dateparser.parse(t, settings=DPARSE_SETTINGS, languages=['en'])
        if dt:
            if "eod" in t.lower():
                dt = dt.replace(hour=17, minute=0)
            elif "night" in t.lower() and dt.hour == 0:
                dt = dt.replace(hour=20, minute=0)
            valid_dates.append((t, dt))

    # If spaCy + merged entities gave us something, use the longest match
    if valid_dates:
        best_text, best_dt = max(valid_dates, key=lambda x: len(x[0]))
        return f"{best_text} ({best_dt.strftime('%Y-%m-%d %H:%M')})"

    # 5. Fallback: use dateparser.search_dates on the whole sentence
    found = search_dates(text, settings=DPARSE_SETTINGS, languages=['en'])
    if found:
        # found = [(matched_text, datetime), ...]
        best_text, best_dt = max(found, key=lambda x: len(x[0]))

        if "eod" in best_text.lower():
            best_dt = best_dt.replace(hour=17, minute=0)
        elif "night" in best_text.lower() and best_dt.hour == 0:
            best_dt = best_dt.replace(hour=20, minute=0)

        return f"{best_text} ({best_dt.strftime('%Y-%m-%d %H:%M')})"

    # 6. Nothing detected
    return None










# =========================================================
# MAIN LOOP
# =========================================================

def process_meeting_transcript(raw_transcript_list):
    structured_results = []

    # --- Better Speaker Tracking Variables ---
    current_speaker_name = None
    last_different_speaker = None

    last_topic_noun = None

    print(f"\n🚀 Processing {len(raw_transcript_list)} utterances...")

    for i, turn in enumerate(raw_transcript_list):
        speaker = turn['speaker']

        # If the speaker is new, update our records.
        # If the speaker is the same as before (monologue), keep 'last_different_speaker' unchanged.
        if speaker != current_speaker_name:
            if current_speaker_name is not None:
                last_different_speaker = current_speaker_name
            current_speaker_name = speaker

        # Handle input key mismatch
        text = turn.get('sentence', turn.get('text', ''))
        clean_text = text.replace("’", "'").replace("“", '"').replace("”", '"')

        # Run spaCy
        doc_full = nlp(clean_text)
        sent_spans = [s for s in doc_full.sents if len(s.text.strip()) > 2]

        for sent_span in sent_spans:
            sent_text = sent_span.text.strip()

            # Predict Intent
            inputs = tokenizer(sent_text, return_tensors="pt", truncation=True, max_length=128).to(device)
            with torch.no_grad():
                outputs = model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            score, idx = torch.max(probs, dim=-1)
            raw_label = model.config.id2label[idx.item()]

            # Refine Intent
            final_intent = refine_intent(sent_text, raw_label, score.item())

            details = None
            if final_intent == "action-item":
                # Find Verb
                main_verb = None
                for t in sent_span:
                    if t.pos_ == "VERB" and t.lemma_.lower() in ACTION_LEMMAS:
                        main_verb = t
                        break
                if not main_verb:
                    main_verb = sent_span.root

                # Handle "Let's" cases
                # If the verb is "let", the real action is usually the child (e.g., "Let's [delay]")
                if main_verb.lemma_.lower() == "let":
                    for child in main_verb.children:
                        # 'ccomp' or 'xcomp' usually holds the second verb
                        if child.dep_ in ("ccomp", "xcomp") and child.pos_ == "VERB":
                            main_verb = child
                            break

                # Extract Task (Now uses the updated function with verb inclusion)
                task = extract_what_refined(sent_span, main_verb)

                # Context Memory for "it/this/that"
                if task is None or task.lower().replace(main_verb.text.lower(), "").strip() in ["it", "this", "that", ""]:
                    if last_topic_noun:
                        # Append the memory in parenthesis
                        task = f"{task if task else main_verb.text + ' it'} ({last_topic_noun})"

                details = {
                    # Pass 'last_different_speaker' to handle questions like "Can you update...?"
                    "who": extract_assignee_context(sent_span, main_verb, speaker, last_different_speaker),
                    "what": task,
                    "when": extract_when_trf(sent_span)
                }

            # Memory Update (Extract Noun Chunks)
            chunks = list(sent_span.noun_chunks)
            for chunk in reversed(chunks):
                root = chunk.root
                if root.pos_ == "PRON": continue
                if root.ent_type_ in ("PERSON", "DATE", "TIME"): continue
                if any(w in root.text.lower() for w in ["night", "morning", "today", "tomorrow"]): continue
                last_topic_noun = chunk.text
                break

            if final_intent in ["action-item", "decision", "concern", "question", "inform"]:
                if sent_text and final_intent:  # extra safety check
                    structured_results.append({
                        "speaker": speaker,
                        "sentence": sent_text,
                        "intent": final_intent,
                        "details": details
                    })
    return structured_results



if __name__ == "__main__":
    with open("sample_transcript.json", "r", encoding="utf-8") as f:
        sample_meeting = json.load(f)

    results = process_meeting_transcript(sample_meeting)

    print("\n📝 Extracted Structured Results:")
    print(json.dumps(results, indent=2, ensure_ascii=False))



