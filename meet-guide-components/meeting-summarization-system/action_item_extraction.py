 # Action Item Extraction Logic
# Extracts: WHAT (task), WHO (assignee), WHEN (deadline)
# Prioritization: Sort by deadline (nearest first)

import re
import dateparser
from dateparser.search import search_dates
from datetime import datetime, timedelta
from config import DPARSE_SETTINGS, ACTION_LEMMAS
from models import get_nlp


def extract_what_refined(doc, verb):
    """
    Extract the task/object of the action verb.
    Looks for direct objects (dobj), attributes (attr), or prepositional objects (pobj).
    """
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
    """
    Extract WHO should do the task.
    Maps pronouns (I, we, you) to actual people based on speaker context.
    """
    def map_sub(token):
        t = token.text.lower()
        if t in ["i", "me", "my"]:
            return current_speaker
        if t in ["we", "us", "'s"]:
            return "Team / All"
        if t == "you":
            return f"{prev_speaker}" if prev_speaker else "Unassigned"
        return token.text

    # Check subject of the verb
    for child in verb.children:
        if child.dep_ == "nsubj":
            vocatives = [t.text for t in doc if t.dep_ == "npadvmod" and t.pos_ == "PROPN"]
            if child.text.lower() == "you" and vocatives:
                return vocatives[0]
            return map_sub(child)

    # Check if verb is a complementary verb (xcomp)
    if verb.dep_ == "xcomp":
        parent = verb.head
        for child in parent.children:
            if child.dep_ == "nsubj":
                return map_sub(child)

    return "Unassigned / Team"


def _parse_informal_deadline(text_lower):
    """
    Parse informal deadline terms and convert them to specific timeframes.
    Maps terms like "ASAP", "soon", "urgent" to appropriate dates.
    
    Returns:
        Formatted deadline string with parsed datetime, or None if no informal deadline found.
    """
    from datetime import datetime, timedelta
    
    now = datetime.now()
    
    # ASAP / Urgent / Immediately -> End of today
    if any(term in text_lower for term in ["asap", "a.s.a.p", "as soon as possible", "urgent", "urgently", "immediately", "right away", "right now"]):
        target_dt = now.replace(hour=17, minute=0, second=0, microsecond=0)
        return f"ASAP ({target_dt.strftime('%Y-%m-%d %H:%M')})"
    
    # Soon / Shortly -> Tomorrow EOD
    if any(term in text_lower for term in ["soon", "shortly", "as soon as you can", "when you can"]):
        target_dt = (now + timedelta(days=1)).replace(hour=17, minute=0, second=0, microsecond=0)
        return f"soon ({target_dt.strftime('%Y-%m-%d %H:%M')})"
    
    # This week -> End of this week (Friday 5pm)
    if "this week" in text_lower or "end of week" in text_lower or "by week's end" in text_lower:
        days_until_friday = (4 - now.weekday()) % 7  # 4 = Friday
        if days_until_friday == 0 and now.hour >= 17:  # If it's already Friday after 5pm
            days_until_friday = 7
        target_dt = (now + timedelta(days=days_until_friday)).replace(hour=17, minute=0, second=0, microsecond=0)
        return f"this week ({target_dt.strftime('%Y-%m-%d %H:%M')})"
    
    # Next week -> 7 days from now (same day next week)
    if "next week" in text_lower:
        target_dt = (now + timedelta(days=7)).replace(hour=9, minute=0, second=0, microsecond=0)
        return f"next week ({target_dt.strftime('%Y-%m-%d %H:%M')})"
    
    # Within X days/hours
    within_match = re.search(r'within\s+(\d+)\s+(day|hour|week)s?', text_lower)
    if within_match:
        num = int(within_match.group(1))
        unit = within_match.group(2)
        if unit == "hour":
            target_dt = now + timedelta(hours=num)
        elif unit == "day":
            target_dt = (now + timedelta(days=num)).replace(hour=17, minute=0, second=0, microsecond=0)
        else:  # week
            target_dt = (now + timedelta(weeks=num)).replace(hour=17, minute=0, second=0, microsecond=0)
        return f"within {num} {unit}{'s' if num > 1 else ''} ({target_dt.strftime('%Y-%m-%d %H:%M')})"
    
    # In X days/hours
    in_match = re.search(r'in\s+(\d+)\s+(day|hour|week)s?', text_lower)
    if in_match:
        num = int(in_match.group(1))
        unit = in_match.group(2)
        if unit == "hour":
            target_dt = now + timedelta(hours=num)
        elif unit == "day":
            target_dt = (now + timedelta(days=num)).replace(hour=17, minute=0, second=0, microsecond=0)
        else:  # week
            target_dt = (now + timedelta(weeks=num)).replace(hour=17, minute=0, second=0, microsecond=0)
        return f"in {num} {unit}{'s' if num > 1 else ''} ({target_dt.strftime('%Y-%m-%d %H:%M')})"
    
    return None


def extract_when_trf(span):
    """
    Extract WHEN the task should be completed.
    Uses spaCy NER + dateparser for robust date/time extraction.
    Handles informal deadlines like "soon", "ASAP", "urgent", etc.
    """
    nlp = get_nlp()
    text = span.text
    text_lower = text.lower()

    # 0. Check for informal deadlines first
    informal_deadline = _parse_informal_deadline(text_lower)
    if informal_deadline:
        return informal_deadline

    # 1. Get date/time entities from spaCy
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

            # Allow small connectors between date/time chunks
            if gap_text in ["", "at", "on", ",", "by", "around", "before", "until"]:
                current_merge_end = curr.end_char
                last_ent = curr
            else:
                full_text = span.doc.text[current_merge_start:current_merge_end]
                merged_strings.append(full_text)
                current_merge_start = curr.start_char
                current_merge_end = curr.end_char
                last_ent = curr

        # Final cluster
        full_text = span.doc.text[current_merge_start:current_merge_end]
        merged_strings.append(full_text)

    # 3. Manual cues (EOD, tonight, etc.)
    if "eod" in text_lower:
        merged_strings.append("end of day")
    if "tonight" in text_lower:
        merged_strings.append("tonight")

    valid_dates = []

    # 4. First pass: parse merged strings
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
        best_text, best_dt = max(found, key=lambda x: len(x[0]))

        if "eod" in best_text.lower():
            best_dt = best_dt.replace(hour=17, minute=0)
        elif "night" in best_text.lower() and best_dt.hour == 0:
            best_dt = best_dt.replace(hour=20, minute=0)

        return f"{best_text} ({best_dt.strftime('%Y-%m-%d %H:%M')})"

    # 6. Nothing detected
    return None


# ------------------------------
# Deadline helpers
# ------------------------------
def _parse_deadline_dt(when_str: str):
    """Parse the stored when string (e.g., "Friday (2026-01-30 00:00)") to datetime."""
    if not when_str:
        return None
    match = re.search(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2})', when_str)
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1), "%Y-%m-%d %H:%M")
    except ValueError:
        return None


def compute_priority_by_deadline(when_str: str) -> str:
    """
    Compute priority based on proximity to deadline.
    - <= 7 days: high
    - <= 14 days: medium
    - otherwise: low
    - no / unparseable deadline: unscheduled
    """
    dt = _parse_deadline_dt(when_str)
    if not dt:
        return "unscheduled"

    now = datetime.now()
    delta_days = (dt - now).total_seconds() / 86400.0

    if delta_days <= 7:
        return "high"
    if delta_days <= 14:
        return "medium"
    return "low"

def prioritize_action_items_by_deadline(action_items: list) -> list:
    """
    Sort action items by deadline (nearest first).
    Items without deadlines are placed at the end.
    
    Args:
        action_items: List of action item dicts with 'details' containing 'when' field
    
    Returns:
        Sorted list of action items
    """
    def deadline_sort_key(action_item):
        """Extract deadline and return sortable key for ordering."""
        details = action_item.get("details")
        when_str = details.get("when") if details else None
        dt = _parse_deadline_dt(when_str)
        if dt:
            return (0, dt)
        return (1, datetime.max)  # No or unparseable deadline = end
    
    return sorted(action_items, key=deadline_sort_key)
def test_extraction():
    """Simple test to verify extraction functions work."""
    from models import get_nlp
    
    nlp = get_nlp()
    
    # Test sentence
    test_sent = "Can you prepare the quarterly report by Friday?"
    doc = nlp(test_sent)
    
    # Find main verb
    main_verb = None
    for token in doc:
        if token.pos_ == "VERB" and token.lemma_.lower() in ACTION_LEMMAS:
            main_verb = token
            break
    
    if main_verb:
        print(f"✅ Verb found: {main_verb.text}")
        
        # Test WHAT
        what = extract_what_refined(doc, main_verb)
        print(f"✅ Task (WHAT): {what}")
        
        # Test WHEN
        for sent_span in doc.sents:
            when = extract_when_trf(sent_span)
            if when:
                print(f"✅ Deadline (WHEN): {when}")
        
        # Test WHO
        who = extract_assignee_context(doc, main_verb, "You", "Speaker A")
        print(f"✅ Assignee (WHO): {who}")
    else:
        print("❌ No action verb found in test sentence")


if __name__ == "__main__":
    test_extraction()
