# Model Loading and Initialization

import os
import torch
import spacy
import spacy_transformers
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from sentence_transformers import SentenceTransformer
from bertopic import BERTopic

# ----- Prevent KMP duplicate library error -----
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

# ----- Global Model Instances -----
nlp = None
tokenizer = None
model = None
device = None
sbert_model = None
topic_model = None


def load_models():
    """Load all required models. Call this once at startup."""
    global nlp, tokenizer, model, device, sbert_model, topic_model

    # ----- spaCy Transformer -----
    print("Loading spaCy Transformer (trf)...")
    try:
        nlp = spacy.load("en_core_web_trf")
        print("Loaded: en_core_web_trf (High Accuracy)")
    except Exception as e:
        print(f"Failed to load spaCy trf: {e}")
        print("Falling back to en_core_web_sm (lower accuracy)")
        nlp = spacy.load("en_core_web_sm")

    # ----- DistilBERT for Intent Detection -----
    print("Loading DistilBERT for intent detection...")
    MODEL_PATH = "models/final_clean_model"
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    try:
        tokenizer = DistilBertTokenizer.from_pretrained(MODEL_PATH)
        # Try loading with trust_remote_code and local_files_only
        model = DistilBertForSequenceClassification.from_pretrained(
            MODEL_PATH,
            local_files_only=True
        ).to(device)
        model.eval()
        print("DistilBERT Loaded Successfully!")
    except Exception as e:
        print(f"Error loading DistilBERT model: {e}")
        print(f"Model path checked: {MODEL_PATH}")
        import os
        if os.path.exists(MODEL_PATH):
            print(f"Files in {MODEL_PATH}:")
            for file in os.listdir(MODEL_PATH):
                print(f"  - {file}")
        else:
            print(f"Path does not exist: {MODEL_PATH}")
        raise  # Re-raise to stop execution

    # ----- SBERT + BERTopic -----
    print("Loading SBERT for topic modeling...")
    sbert_model = SentenceTransformer("all-MiniLM-L6-v2")
    topic_model = BERTopic(
        embedding_model=sbert_model,
        language="english",
        verbose=False
    )
    print("BERTopic Loaded Successfully!")


def get_nlp():
    """Get spaCy NLP instance."""
    if nlp is None:
        load_models()
    return nlp


def get_tokenizer():
    """Get DistilBERT tokenizer."""
    if tokenizer is None:
        load_models()
    return tokenizer


def get_model():
    """Get DistilBERT model."""
    if model is None:
        load_models()
    return model


def get_device():
    """Get torch device."""
    if device is None:
        load_models()
    return device


def get_sbert_model():
    """Get SBERT model for embeddings."""
    if sbert_model is None:
        load_models()
    return sbert_model


def get_topic_model():
    """Get BERTopic model."""
    if topic_model is None:
        load_models()
    return topic_model
