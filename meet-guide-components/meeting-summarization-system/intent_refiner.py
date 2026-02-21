# Intent Refinement Logic

import re
import string
from config import ACTION_LEMMAS


def refine_intent(text, predicted_label, confidence):
    """
    Refine the raw intent prediction from the model.
    Applies rule-based heuristics to improve classification.
    """
    text_lower = text.lower().strip()

    # =========================================================
    # 1. NOISE & FILLER FILTER
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
    # 2. HOPE / WISH STATEMENTS → INFORM
    # =========================================================
    if "i hope" in text_lower or "i will hope" in text_lower or "i'm hoping" in text_lower:
        return "inform"

    # =========================================================
    # 3. CONFIDENCE THRESHOLD
    # =========================================================
    if confidence < 0.50:
        predicted_label = "inform"

    # =========================================================
    # 4. DECISION REFINEMENT
    # =========================================================
    decision_keywords = [
        "decide", "decided", "agreed", "settled", "resolved",
        "go with", "stick with", "adopt", "selected",
        "final decision", "we will use", "plan is to"
    ]

    if any(k in text_lower for k in decision_keywords):
        return "decision"

    # =========================================================
    # 5. ACTION-ITEM BOOSTER
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
    # 6. CONCERN BOOSTER
    # =========================================================
    concern_keywords = [
        "risk", "worried", "concern", "issue",
        "problem", "blocker", "delay", "afraid", "unsure"
    ]
    if predicted_label == "inform" and any(k in text_lower for k in concern_keywords):
        return "concern"

    # =========================================================
    # 7. INFORM CONTEXT FILTER
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
    # 8. STATUS REPORT FILTER
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
