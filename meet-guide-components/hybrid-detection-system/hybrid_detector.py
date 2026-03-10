import os
import torch
import spacy
from spacy.matcher import PhraseMatcher
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

# -------------------------------------------------
# 1. Resolve model path (LOCAL)
# -------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "genz_slang_detector_distilbert-base-uncased_v2"
)

if not os.path.isdir(MODEL_PATH):
    raise FileNotFoundError(f"Model folder not found at {MODEL_PATH}")

# -------------------------------------------------
# 2. Load AI model
# -------------------------------------------------
device_index = 0 if torch.cuda.is_available() else -1

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_PATH,
    local_files_only=True
)
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_PATH,
    local_files_only=True
)

clf = pipeline(
    "text-classification",
    model=model,
    tokenizer=tokenizer,
    device=device_index
)

print("[OK] Model loaded locally")

# -------------------------------------------------
# 3. Slang rules with context filters
# -------------------------------------------------
SLANG_RULES = {
    "ambiguous": [
        "vibe", "cap", "fire", "mid", "sick", "solid", "hits", "bet", "slaps", "wild",
        "crazy", "trash", "mood", "basic", "salty"
        # "ate", "basic", "bet", "cap", "extra", "fire", "flex", "ghosting",
        # "glow up", "green flag", "red flag", "mid", "slaps", "tea",
        # "trash", "salty", "shook", "stan", "drip", "woke", "bop", "cancel",
        # "mother", "slide", "mood", "hits different", "vibe", "for real",
        # "hits", "solid", "sick"
    ],
    "unambiguous": [
        "skibidi", "rizz", "yeet", "sus", "cheugy", "simp", "finna", "gyatt",
        "no cap", "big yikes", "ick", "delulu",
        "main character energy", "poggers", "lit", "w", "l", "lowkey", "W", "L"
    ]
}

# -------------------------------------------------
# 4. UPDATED Hybrid Detector (Lemma + Phrase)
# -------------------------------------------------
class RuleBase1_WithUncertainty:
    def __init__(self, ai_model, threshold=0.85, ambiguous_threshold=0.60):
        self.ai_model = ai_model
        self.threshold = threshold  # For general classification
        self.ambiguous_threshold = ambiguous_threshold  # Higher threshold for ambiguous terms

        self.nlp = spacy.load("en_core_web_sm")
        self.matcher = PhraseMatcher(self.nlp.vocab, attr="LOWER")

        # Lemma-based slang sets
        self.ambiguous_lemmas = set()
        self.unambiguous_lemmas = set()

        self._load_rules()

    def _load_rules(self):
        # --- Multi-word unambiguous slang (PhraseMatcher) ---
        multi_word_unamb = [
            w for w in SLANG_RULES["unambiguous"] if " " in w
        ]
        patterns = [self.nlp.make_doc(w) for w in multi_word_unamb]
        self.matcher.add("UNAMBIGUOUS_PHRASE", patterns)

        # --- Lemmatize single-word slang ---
        for word in SLANG_RULES["ambiguous"]:
            lemma = self.nlp(word)[0].lemma_.lower()
            self.ambiguous_lemmas.add(lemma)

        for word in SLANG_RULES["unambiguous"]:
            if " " not in word:
                lemma = self.nlp(word)[0].lemma_.lower()
                self.unambiguous_lemmas.add(lemma)

    def analyze(self, sentence):
        doc = self.nlp(sentence)

        # ---------- PHASE 1: UNAMBIGUOUS PHRASES ----------
        matches = self.matcher(doc)
        for match_id, start, end in matches:
            return {
                "text": sentence,
                "term": doc[start:end].text,
                "is_slang": True,
                "confidence": 1.0,
                "method": "Rule-Based (Unambiguous Phrase)"
            }

        ambiguous_terms = []

        # ---------- PHASE 2: LEMMA-BASED TOKEN CHECK ----------
        for token in doc:
            lemma = token.lemma_.lower()

            if lemma in self.unambiguous_lemmas:
                return {
                    "text": sentence,
                    "term": token.text,
                    "is_slang": True,
                    "confidence": 1.0,
                    "method": "Rule-Based (Unambiguous Lemma)"
                }

            elif lemma in self.ambiguous_lemmas:
                ambiguous_terms.append(token.text)

        # ---------- PHASE 3: AI MODEL ----------
        if ambiguous_terms:
            # Use AI model with higher threshold for ambiguous terms
            result = self.ai_model(sentence)[0]
            label = result["label"]
            score = result["score"]

            # Use higher threshold for ambiguous terms to reduce false positives
            if label == "LABEL_1" and score >= self.ambiguous_threshold:
                return {
                    "text": sentence,
                    "term": ambiguous_terms[0],
                    "is_slang": True,
                    "confidence": round(score, 4),
                    "method": "AI Model (High Confidence)"
                }
            else:
                return {
                    "text": sentence,
                    "term": ambiguous_terms[0],
                    "is_slang": False,
                    "confidence": round(score, 4),
                    "method": "AI Model (Below Threshold → Safe)"
                }
        

        # ---------- PHASE 4: CLEAN ----------
        return {
            "text": sentence,
            "term": None,
            "is_slang": False,
            "confidence": 0.0,
            "method": "Clean"
        }

# -------------------------------------------------
# 5. Create detector
# -------------------------------------------------
hybrid_detector = RuleBase1_WithUncertainty(
    ai_model=clf,
    threshold=0.85,  # General threshold
    ambiguous_threshold=0.60  # Threshold for ambiguous terms (lowered to detect more Gen-Z slang)
)

print("[OK] Hybrid slang detector with lemmatization ready")
