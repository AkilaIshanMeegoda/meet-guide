# Configuration and Settings

from datetime import datetime

# ----- Date Parsing Settings -----
DPARSE_SETTINGS = {
    "RELATIVE_BASE": datetime.now(),
    "PREFER_DATES_FROM": "future",
    "RETURN_AS_TIMEZONE_AWARE": False,
    "STRICT_PARSING": False,
}

# ----- Action Verbs -----
ACTION_VERBS = {
    "send", "prepare", "launch", "schedule", "share", "follow", "update",
    "finalize", "upload", "coordinate", "review", "organize", "book",
    "confirm", "draft", "email", "deliver", "check", "fix", "investigate",
    "create", "assign", "deploy", "push", "run", "verify", "notify", "backup"
}
ACTION_LEMMAS = {v.lower() for v in ACTION_VERBS}

# ----- Stopwords for Topic Labeling -----
STOPWORDS = {
    "the", "a", "an", "that", "this", "these", "those", "case", "thing", "way",
    "time", "it", "yet", "is", "are", "be", "have", "has", "do", "does", "you", "i",
    "we", "he", "she", "they", "my", "our", "their", "next", "today", "tomorrow",
    "day", "morning", "evening", "night", "now", "then", "good", "great", "okay", "fine",
    "call", "one", "two", "three", "four", "five", "week", "month", "year", "ticket",
    "jira", "update", "delay", "push", "setup"
}

# ----- Topic Segmentation Tunables -----
# Sliding window size for local continuity check in streaming segmentation.
TOPIC_WINDOW_K = 5

# Similarity threshold to reuse a topic based on local window comparison.
TOPIC_LOCAL_THRESHOLD = 0.30

# Similarity threshold to reuse a topic based on centroid memory comparison.
TOPIC_GLOBAL_THRESHOLD = 0.35
