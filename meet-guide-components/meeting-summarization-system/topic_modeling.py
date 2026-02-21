# Topic Modeling and Clustering

import re
import os  # env overrides for thresholds
import numpy as np
from collections import Counter, defaultdict
from sklearn.metrics.pairwise import cosine_similarity
from config import STOPWORDS, TOPIC_WINDOW_K, TOPIC_LOCAL_THRESHOLD, TOPIC_GLOBAL_THRESHOLD
from models import get_sbert_model, get_nlp


def assign_topics(structured_results):
    """
    Streaming-friendly topic segmentation using a Window + Topic Memory strategy.

    Algorithm (near O(n)):
    - Compute SBERT embeddings for each utterance (preserves existing pipeline).
    - For each utterance i:
      1) Local continuity: compare embedding to a sliding window of the last k utterances;
         if similarity to any window item >= LOCAL_THRESHOLD, reuse that item's topic.
      2) Topic memory: if local check fails, compare to centroids of existing topics;
         if similarity >= GLOBAL_THRESHOLD, reuse that topic.
      3) Otherwise, create a new topic.
    - Maintain per-topic centroid incrementally to avoid full global clustering.

    This ensures recurring themes get the same topic ID even when they reappear
    non-consecutively, without invoking heavy clustering methods.
    """
    n_items = len(structured_results)
    if n_items == 0:
        return structured_results
    if n_items == 1:
        structured_results[0]["topic_id"] = 0
        return structured_results

    # Embeddings via SBERT (existing pipeline)
    sbert_model = get_sbert_model()
    texts = [item["sentence"] for item in structured_results]
    embeddings = sbert_model.encode(texts, show_progress_bar=False)

    # Hyperparameters with environment overrides (runtime-configurable)
    # Env vars: TOPIC_WINDOW_K (int), TOPIC_LOCAL_THRESHOLD (float), TOPIC_GLOBAL_THRESHOLD (float)
    # If env not set or invalid, fall back to config.py defaults.
    def _env_int(name, default):
        v = os.getenv(name)
        if v is None:
            return default
        try:
            return int(v)
        except ValueError:
            return default

    def _env_float(name, default):
        v = os.getenv(name)
        if v is None:
            return default
        try:
            return float(v)
        except ValueError:
            return default

    WINDOW_K = _env_int("TOPIC_WINDOW_K", TOPIC_WINDOW_K)  # using env override if present
    LOCAL_THRESHOLD = _env_float("TOPIC_LOCAL_THRESHOLD", TOPIC_LOCAL_THRESHOLD)  # env override
    GLOBAL_THRESHOLD = _env_float("TOPIC_GLOBAL_THRESHOLD", TOPIC_GLOBAL_THRESHOLD)  # env override

    # Initialize first topic
    next_topic_id = 0
    structured_results[0]["topic_id"] = next_topic_id

    # Topic memory: centroid and counts for incremental updates
    topic_centroid = {next_topic_id: embeddings[0].astype(np.float32)}
    topic_count = {next_topic_id: 1}

    # Keep track of assigned topic for each index for window lookup
    assigned_topics = [None] * n_items
    assigned_topics[0] = next_topic_id

    # Iterate streaming-style over utterances
    for i in range(1, n_items):
        emb_i = embeddings[i].reshape(1, -1)

        # 1) Local continuity: compare against sliding window of last k utterances
        start = max(0, i - WINDOW_K)
        window_embs = embeddings[start:i]
        local_assigned = None

        if len(window_embs) > 0:
            local_sims = cosine_similarity(emb_i, window_embs)[0]  # shape: (i-start,)
            best_local_idx = int(np.argmax(local_sims))
            best_local_sim = float(local_sims[best_local_idx])

            if best_local_sim >= LOCAL_THRESHOLD:
                # Reuse the topic of the most similar window utterance
                local_assigned = assigned_topics[start + best_local_idx]

        if local_assigned is not None:
            assigned_topic = local_assigned
        else:
            # 2) Topic memory: compare to centroids of existing topics
            centroid_ids = list(topic_centroid.keys())
            centroid_vecs = np.vstack([topic_centroid[t] for t in centroid_ids])
            global_sims = cosine_similarity(emb_i, centroid_vecs)[0]
            best_centroid_idx = int(np.argmax(global_sims))
            best_global_sim = float(global_sims[best_centroid_idx])

            if best_global_sim >= GLOBAL_THRESHOLD:
                assigned_topic = centroid_ids[best_centroid_idx]
            else:
                # 3) Create a new topic when neither local nor global passes
                next_topic_id += 1
                assigned_topic = next_topic_id

        # Assign and update memory
        structured_results[i]["topic_id"] = assigned_topic
        assigned_topics[i] = assigned_topic

        # Incremental centroid update: C_new = (n*C_old + x) / (n+1)
        if assigned_topic in topic_centroid:
            n = topic_count[assigned_topic]
            c = topic_centroid[assigned_topic]
            topic_centroid[assigned_topic] = (c * n + embeddings[i]) / (n + 1)
            topic_count[assigned_topic] = n + 1
        else:
            topic_centroid[assigned_topic] = embeddings[i].astype(np.float32)
            topic_count[assigned_topic] = 1

    return structured_results


def attach_nearest_topic(structured_results):
    """
    Ensure all items have valid topic assignments.
    With sequential similarity-based clustering, all items already have valid topics.
    """
    return structured_results


def generate_topic_label(items):
    """Generate clean, concise, semantically coherent topic label (3-4 words)."""
    nlp = get_nlp()

    noun_candidates = []

    for item in items:
        doc = nlp(item["sentence"])

        for chunk in doc.noun_chunks:
            # Normalize
            clean_chunk = chunk.text.lower().strip()
            clean_chunk = re.sub(r'^(the |a |an )', '', clean_chunk)

            # Skip if entire chunk is a stopword
            if clean_chunk in STOPWORDS:
                continue

            # Skip empty or numeric-only
            if not clean_chunk or all(c.isdigit() for c in clean_chunk.replace(" ", "")):
                continue

            # Skip if ANY token is a stopword (stronger filtering)
            tokens = clean_chunk.split()
            if any(t in STOPWORDS for t in tokens):
                continue

            # Skip very short or very long chunks
            word_count = len(tokens)
            if word_count > 3 or (word_count == 1 and len(clean_chunk) < 4):
                continue

            # Only keep chunks with at least one NOUN
            has_noun = any(t.pos_ == "NOUN" for t in chunk)
            if not has_noun:
                continue

            # Lemmatize
            lemma_tokens = []
            for t in chunk:
                if t.pos_ == "NOUN":
                    lemma_tokens.append(t.lemma_.lower())
                elif t.pos_ not in ["DET", "PRON", "NUM", "CCONJ", "ADP"]:
                    lemma_tokens.append(t.text.lower())

            if lemma_tokens:
                noun_phrase = " ".join(lemma_tokens)
                noun_candidates.append(noun_phrase)

    if not noun_candidates:
        return "Discussion"

    # Count frequency
    noun_freq = Counter(noun_candidates)

    # Score by frequency only - simpler, more transparent
    scored_candidates = []
    for noun, freq in noun_freq.most_common(15):
        word_count = len(noun.split())
        # Prefer 2-word compounds, then 1-word, then 3-word
        compound_bonus = 1.5 if word_count == 2 else 1.0 if word_count == 1 else 0.7
        score = freq * compound_bonus
        scored_candidates.append((noun, score, word_count))

    # Sort by score
    scored_candidates.sort(key=lambda x: (-x[1], -x[2]))

    # Select 3-4 words, avoid redundant/overlapping terms
    selected = []
    total_words = 0
    seen_nouns = set()

    for noun, score, word_count in scored_candidates:
        if noun in seen_nouns:
            continue

        # Skip if overlaps with already selected
        skip = False
        for sel in selected:
            if noun in sel or sel in noun:
                skip = True
                break
        if skip:
            continue

        if total_words + word_count <= 4:
            selected.append(noun)
            seen_nouns.add(noun)
            total_words += word_count
        elif total_words < 3 and total_words + word_count <= 5:
            selected.append(noun)
            seen_nouns.add(noun)
            total_words += word_count

    if not selected and noun_freq:
        selected.append(noun_freq.most_common(1)[0][0])

    # Final label
    label = " ".join(n.title() for n in selected)
    return label if label and len(label) > 2 else "Discussion"


def group_by_topics(structured_results):
    """
    Group items by topic_id, then merge consecutive topics that resolve to the
    same label to avoid redundant topic blocks.
    """
    topics = defaultdict(list)

    for item in structured_results:
        topics[item["topic_id"]].append(item)

    merged = []

    for topic_id, items in sorted(topics.items()):
        label = generate_topic_label(items)
        if merged and merged[-1]["topic_label"] == label:
            # Merge with previous to avoid duplicate blocks
            merged[-1]["items"].extend(items)
        else:
            merged.append({
                "topic_id": topic_id,
                "topic_label": label,
                "items": items
            })

    return merged
