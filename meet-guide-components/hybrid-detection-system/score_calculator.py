"""
=============================================================================
 WMFSA - Weighted Multi-Factor Scoring Algorithm
 Professional Communication Score Calculator
 
 A novel domain-specific composite scoring algorithm that calculates
 a professionalism score (0-100) per participant based on their
 Gen-Z slang usage detected by the hybrid detection system.
 
 Algorithm Components (Building Blocks):
   D1 - Slang Frequency Ratio    (Weight: 35%) - Based on TF (Salton, 1988)
   D2 - Slang Severity Score     (Weight: 25%) - Based on IEEE 1061 WDD
   D3 - Repetition Penalty       (Weight: 15%) - Based on TTR (Templin, 1957)
   D4 - Confidence Penalty       (Weight: 15%) - Based on Platt (1999)
   B1 - Engagement Bonus         (Weight: 10%) - Rewards active participation
 
 Formula:
   ProfessionalScore = 100 - D1 - D2 - D3 - D4 + B1
   Clamped to [0, 100]
=============================================================================
"""


# -------------------------------------------------
# Severity weights for different slang categories
# -------------------------------------------------
SEVERITY_WEIGHTS = {
    "unambiguous": 1.0,          # Clearly slang (e.g., "rizz", "skibidi")
    "ambiguous_high": 0.7,       # Ambiguous but AI is very sure (confidence >= 0.95)
    "ambiguous_moderate": 0.4,   # Ambiguous, AI is moderately sure (0.90 - 0.95)
}

# -------------------------------------------------
# Score label thresholds
# -------------------------------------------------
SCORE_LABELS = [
    (90, 100, "Excellent Professionalism"),
    (75, 89, "Good Professionalism"),
    (60, 74, "Moderate Professionalism"),
    (40, 59, "Needs Improvement"),
    (0, 39, "Poor Professionalism"),
]

# -------------------------------------------------
# Dimension weights (must sum to 1.0)
# -------------------------------------------------
WEIGHTS = {
    "frequency": 35,      # D1 max penalty
    "severity": 25,       # D2 max penalty
    "repetition": 15,     # D3 max penalty
    "confidence": 15,     # D4 max penalty
    "engagement": 10,     # B1 max bonus
}


def get_score_label(score):
    """
    Maps a numeric score (0-100) to a human-readable label.
    
    Example:
        get_score_label(85) → "Good Professionalism"
        get_score_label(98) → "Excellent Professionalism"
    """
    for low, high, label in SCORE_LABELS:
        if low <= score <= high:
            return label
    return "Unknown"


def classify_slang_type(detection_result):
    """
    Determines the slang category from a single detection result.
    
    Takes the output from hybrid_detector.analyze() and classifies it into:
      - "unambiguous"        → Rule-based detection (confidence = 1.0)
      - "ambiguous_high"     → AI detected with confidence >= 0.95
      - "ambiguous_moderate" → AI detected with confidence 0.90 - 0.95
      - None                 → Not slang
    
    Args:
        detection_result: dict with keys {text, term, is_slang, confidence, method}
    
    Returns:
        str or None: The slang category, or None if not slang
    """
    if not detection_result.get("is_slang", False):
        return None

    method = detection_result.get("method", "")
    confidence = detection_result.get("confidence", 0)

    # Rule-based detections are always unambiguous (confidence = 1.0)
    if "Rule-Based" in method:
        return "unambiguous"

    # AI-based detections: classify by confidence level
    if confidence >= 0.95:
        return "ambiguous_high"
    else:
        return "ambiguous_moderate"


def calculate_professional_score(detection_results, participant_info=None, meeting_info=None, avg_utterances_per_participant=None):
    """
    =================================================================
    MAIN FUNCTION - Calculates the Professional Score using WMFSA
    =================================================================
    
    Args:
        detection_results: list of dicts from hybrid_detector.analyze()
            Each dict has: {text, term, is_slang, confidence, method}
        
        participant_info: dict with {id, name} (optional, for report metadata)
        
        meeting_info: dict with {id, name, date, duration} (optional, for report)
        
        avg_utterances_per_participant: float (optional, for engagement bonus)
            If not provided, engagement bonus is skipped.
    
    Returns:
        dict: Complete professional score report with breakdown
    
    Example:
        results = [
            {"text": "Let's discuss Q1", "term": None, "is_slang": False, "confidence": 0.0, "method": "Clean"},
            {"text": "That's fire", "term": "fire", "is_slang": True, "confidence": 0.96, "method": "AI Model (High Confidence)"},
        ]
        report = calculate_professional_score(results)
    """

    # ============================================
    # STEP 1: Count everything we need
    # ============================================
    total_utterances = len(detection_results)
    
    if total_utterances == 0:
        return _build_empty_report(participant_info, meeting_info)

    # Separate slang vs clean sentences
    slang_instances = []
    for result in detection_results:
        slang_type = classify_slang_type(result)
        if slang_type is not None:
            slang_instances.append({
                "text": result["text"],
                "term": result["term"],
                "confidence": result["confidence"],
                "method": result["method"],
                "slang_type": slang_type,
                "severity_weight": SEVERITY_WEIGHTS[slang_type],
            })

    total_slang = len(slang_instances)

    # ============================================
    # STEP 2: Calculate D1 - Slang Frequency Ratio
    # "What % of your sentences had slang?"
    # ============================================
    slang_frequency_ratio = total_slang / total_utterances
    d1_penalty = slang_frequency_ratio * WEIGHTS["frequency"]

    # ============================================
    # STEP 3: Calculate D2 - Slang Severity Score
    # "How bad was the slang you used?"
    # ============================================
    if total_slang > 0:
        severity_sum = sum(inst["severity_weight"] for inst in slang_instances)
        max_possible_severity = total_utterances * 1.0  # Worst case: every sentence has worst slang
        d2_penalty = (severity_sum / max_possible_severity) * WEIGHTS["severity"]
    else:
        severity_sum = 0
        d2_penalty = 0

    # ============================================
    # STEP 4: Calculate D3 - Repetition Penalty
    # "Did you keep using the same slang word?"
    # ============================================
    if total_slang > 0:
        unique_terms = set(inst["term"].lower() for inst in slang_instances if inst["term"])
        unique_count = len(unique_terms)
        
        if total_slang > 1:
            repetition_ratio = 1 - (unique_count / total_slang)
        else:
            repetition_ratio = 0  # Only 1 instance, can't be repetitive
        
        d3_penalty = repetition_ratio * WEIGHTS["repetition"]
    else:
        unique_terms = set()
        unique_count = 0
        repetition_ratio = 0
        d3_penalty = 0

    # ============================================
    # STEP 5: Calculate D4 - Confidence Penalty
    # "How certain was the AI that you used slang?"
    # ============================================
    if total_slang > 0:
        avg_confidence = sum(inst["confidence"] for inst in slang_instances) / total_slang
        d4_penalty = avg_confidence * slang_frequency_ratio * WEIGHTS["confidence"]
    else:
        avg_confidence = 0
        d4_penalty = 0

    # ============================================
    # STEP 6: Calculate B1 - Engagement Bonus
    # "Did you talk more than average? Small reward."
    # ============================================
    if avg_utterances_per_participant and avg_utterances_per_participant > 0:
        engagement_ratio = total_utterances / avg_utterances_per_participant
        if engagement_ratio >= 1.0:
            b1_bonus = min(engagement_ratio - 1.0, 1.0) * WEIGHTS["engagement"]
        else:
            b1_bonus = 0
    else:
        engagement_ratio = None
        b1_bonus = 0

    # ============================================
    # STEP 7: Final score calculation
    # ============================================
    raw_score = 100 - d1_penalty - d2_penalty - d3_penalty - d4_penalty + b1_bonus
    final_score = round(max(0, min(100, raw_score)))  # Clamp to [0, 100]
    score_label = get_score_label(final_score)

    # ============================================
    # STEP 8: Count slang by type for the report
    # ============================================
    ambiguous_count = sum(1 for inst in slang_instances if inst["slang_type"] in ("ambiguous_high", "ambiguous_moderate"))
    unambiguous_count = sum(1 for inst in slang_instances if inst["slang_type"] == "unambiguous")

    # ============================================
    # STEP 9: Build flagged instances for the report
    # ============================================
    flagged_instances = []
    for i, inst in enumerate(slang_instances, 1):
        # Map slang_type to display label
        if inst["slang_type"] == "unambiguous":
            display_type = "Unambiguous"
        else:
            display_type = "Ambiguous"

        # Map method to simpler display
        if "Rule-Based" in inst["method"]:
            display_method = "Rule-Based"
        else:
            display_method = "AI-Based"

        flagged_instances.append({
            "id": i,
            "sentence": inst["text"],
            "slangTerm": inst["term"],
            "type": display_type,
            "severityWeight": inst["severity_weight"],
            "confidence": inst["confidence"],
            "detectionMethod": display_method,
        })

    # ============================================
    # STEP 10: Build the complete report
    # ============================================
    report = {
        "participant": participant_info or {"id": "N/A", "name": "Unknown"},
        "meeting": meeting_info or {"id": "N/A", "name": "N/A", "date": "N/A", "duration": "N/A"},
        "professionalism": {
            "score": final_score,
            "label": score_label,
            "description": f"This score reflects language usage during the meeting session. Based on {total_utterances} total utterances analyzed.",
            "breakdown": {
                "baseScore": 100,
                "slangFrequencyPenalty": round(-d1_penalty, 2),
                "slangSeverityPenalty": round(-d2_penalty, 2),
                "repetitionPenalty": round(-d3_penalty, 2),
                "confidencePenalty": round(-d4_penalty, 2),
                "engagementBonus": round(b1_bonus, 2),
            }
        },
        "slangUsage": {
            "total": total_slang,
            "ambiguous": ambiguous_count,
            "unambiguous": unambiguous_count,
            "slangFrequencyPercent": round(slang_frequency_ratio * 100, 1),
        },
        "flaggedInstances": flagged_instances,
        "engagement": {
            "totalUtterances": total_utterances,
            "slangUtterances": total_slang,
            "slangFrequencyPercent": round(slang_frequency_ratio * 100, 1),
            "avgUtterancesPerParticipant": avg_utterances_per_participant,
            "engagementRatio": round(engagement_ratio, 2) if engagement_ratio else None,
        },
    }

    return report


def _build_empty_report(participant_info=None, meeting_info=None):
    """
    Returns a perfect score report when there are no utterances to analyze.
    """
    return {
        "participant": participant_info or {"id": "N/A", "name": "Unknown"},
        "meeting": meeting_info or {"id": "N/A", "name": "N/A", "date": "N/A", "duration": "N/A"},
        "professionalism": {
            "score": 100,
            "label": "Excellent Professionalism",
            "description": "No utterances to analyze.",
            "breakdown": {
                "baseScore": 100,
                "slangFrequencyPenalty": 0,
                "slangSeverityPenalty": 0,
                "repetitionPenalty": 0,
                "confidencePenalty": 0,
                "engagementBonus": 0,
            }
        },
        "slangUsage": {"total": 0, "ambiguous": 0, "unambiguous": 0, "slangFrequencyPercent": 0},
        "flaggedInstances": [],
        "engagement": {
            "totalUtterances": 0,
            "slangUtterances": 0,
            "slangFrequencyPercent": 0,
            "avgUtterancesPerParticipant": None,
            "engagementRatio": None,
        },
    }

# -------------------------------------------------
# Quick test when running this file directly
# -------------------------------------------------
if __name__ == "__main__":
    # Simulate detection results for one participant
    sample_results = [
        {"text": "Let's review the Q1 strategy plan.", "term": None, "is_slang": False, "confidence": 0.0, "method": "Clean"},
        {"text": "I think we need to focus on customer retention.", "term": None, "is_slang": False, "confidence": 0.0, "method": "Clean"},
        {"text": "The new dashboard design is fire.", "term": "fire", "is_slang": True, "confidence": 0.96, "method": "AI Model (High Confidence)"},
        {"text": "We should prioritize the mobile experience.", "term": None, "is_slang": False, "confidence": 0.0, "method": "Clean"},
        {"text": "No cap, the numbers look great this quarter.", "term": "no cap", "is_slang": True, "confidence": 1.0, "method": "Rule-Based (Unambiguous Phrase)"},
        {"text": "I'll prepare the presentation for Friday.", "term": None, "is_slang": False, "confidence": 0.0, "method": "Clean"},
        {"text": "That marketing approach is lowkey genius.", "term": "lowkey", "is_slang": True, "confidence": 1.0, "method": "Rule-Based (Unambiguous Lemma)"},
        {"text": "We need to align our KPIs with the roadmap.", "term": None, "is_slang": False, "confidence": 0.0, "method": "Clean"},
        {"text": "The competitor analysis looks solid.", "term": "solid", "is_slang": False, "confidence": 0.45, "method": "AI Model (Below Threshold → Safe)"},
        {"text": "Let's circle back on the budget discussion.", "term": None, "is_slang": False, "confidence": 0.0, "method": "Clean"},
    ]

    participant = {"id": "P-2847", "name": "Alex Morrison"}
    meeting = {
        "id": "MTG-2026-02-06-0001",
        "name": "Q1 Strategy Planning Session",
        "date": "February 6, 2026",
        "duration": "45 minutes"
    }

    report = calculate_professional_score(
        detection_results=sample_results,
        participant_info=participant,
        meeting_info=meeting,
        avg_utterances_per_participant=8  # Avg person said 8 sentences
    )

    # Pretty print the result
    import json
    print("\n" + "=" * 60)
    print("  PROFESSIONAL SCORE REPORT")
    print("=" * 60)
    print(f"  Participant: {report['participant']['name']}")
    print(f"  Meeting:     {report['meeting']['name']}")
    print(f"  Score:       {report['professionalism']['score']}/100 ({report['professionalism']['label']})")
    print("-" * 60)
    print("  BREAKDOWN:")
    breakdown = report['professionalism']['breakdown']
    print(f"    Base Score:              {breakdown['baseScore']}")
    print(f"    Slang Frequency Penalty: {breakdown['slangFrequencyPenalty']}")
    print(f"    Slang Severity Penalty:  {breakdown['slangSeverityPenalty']}")
    print(f"    Repetition Penalty:      {breakdown['repetitionPenalty']}")
    print(f"    Confidence Penalty:      {breakdown['confidencePenalty']}")
    print(f"    Engagement Bonus:        +{breakdown['engagementBonus']}")
    print("-" * 60)
    print(f"  Slang Usage: {report['slangUsage']['total']} instances ({report['slangUsage']['slangFrequencyPercent']}%)")
    print(f"    Ambiguous:   {report['slangUsage']['ambiguous']}")
    print(f"    Unambiguous: {report['slangUsage']['unambiguous']}")
    print("-" * 60)
    print("  FLAGGED SENTENCES:")
    for inst in report['flaggedInstances']:
        print(f"    #{inst['id']} \"{inst['sentence']}\"")
        print(f"       Term: {inst['slangTerm']} | Type: {inst['type']} | Severity: {inst['severityWeight']} | Method: {inst['detectionMethod']}")
    print("=" * 60)
    print("\n  Full JSON:")
    print(json.dumps(report, indent=2))

