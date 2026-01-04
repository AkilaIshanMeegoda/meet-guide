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
# 2. Load AI model (same as Colab)
# -------------------------------------------------
device_index = 0 if torch.cuda.is_available() else -1

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH, local_files_only=True)

clf = pipeline(
    "text-classification",
    model=model,
    tokenizer=tokenizer,
    device=device_index
)

print("✅ Model loaded locally")

# -------------------------------------------------
# 3. Slang rules (IDENTICAL to Colab)
# -------------------------------------------------
SLANG_RULES = {
    "ambiguous": [
        "ate", "basic", "bet", "cap", "extra", "fire", "flex", "ghosting",
        "glow up", "green flag", "red flag", "mid", "slaps", "tea",
        "trash", "salty", "shook", "stan", "drip", "woke", "bop", "cancel",
        "mother", "slide", "mood", "hits different", "vibe", "for real",
        "hits", "solid", "sick"
    ],
    "unambiguous": [
        "skibidi", "rizz", "yeet", "sus", "cheugy", "simp", "finna", "gyatt",
        "no cap", "big yikes", "ick", "delulu",
        "main character energy", "poggers", "lit", "w", "l", "lowkey", "W", "L"
    ]
}

# -------------------------------------------------
# 4. Hybrid detector (SAME LOGIC AS COLAB)
# -------------------------------------------------
class RuleBase1_WithUncertainty:
    def __init__(self, ai_model, threshold=0.70):
        self.ai_model = ai_model
        self.threshold = threshold

        self.nlp = spacy.load("en_core_web_sm")
        self.matcher = PhraseMatcher(self.nlp.vocab, attr="LOWER")

        self._load_rules()

    def _load_rules(self):
        amb_docs = [self.nlp.make_doc(t) for t in SLANG_RULES["ambiguous"]]
        unamb_docs = [self.nlp.make_doc(t) for t in SLANG_RULES["unambiguous"]]

        self.matcher.add("UNAMBIGUOUS", unamb_docs)
        self.matcher.add("AMBIGUOUS", amb_docs)

    def analyze(self, sentence):
        doc = self.nlp(sentence)
        matches = self.matcher(doc)

        ambiguous_terms = []

        # ---------- PHASE 1: RULE-BASED ----------
        for match_id, start, end in matches:
            label = self.nlp.vocab.strings[match_id]
            term = doc[start:end].text

            if label == "UNAMBIGUOUS":
                return {
                    "text": sentence,
                    "term": term,
                    "is_slang": True,
                    "confidence": 1.0,
                    "method": "Rule-Based (Unambiguous)"
                }

            elif label == "AMBIGUOUS":
                ambiguous_terms.append(term)

        # ---------- PHASE 2: AI WITH SAFETY ----------
        if ambiguous_terms:
            result = self.ai_model(sentence)[0]
            label = result["label"]
            score = result["score"]

            if (label == "LABEL_1" or label == "1") and score >= self.threshold:
                return {
                    "text": sentence,
                    "term": ambiguous_terms[0],
                    "is_slang": True,
                    "confidence": round(score, 4),
                    "method": "AI Model (Confident)"
                }
            else:
                return {
                    "text": sentence,
                    "term": ambiguous_terms[0],
                    "is_slang": False,
                    "confidence": round(score, 4),
                    "method": "AI Model (Uncertain → Safe)"
                }

        # ---------- PHASE 3: CLEAN ----------
        return {
            "text": sentence,
            "term": None,
            "is_slang": False,
            "confidence": 0.0,
            "method": "Clean"
        }


# -------------------------------------------------
# 5. Create detector (same as Colab)
# -------------------------------------------------
hybrid_detector = RuleBase1_WithUncertainty(
    ai_model=clf,
    threshold=0.70
)

print("✅ Hybrid slang detector ready")
