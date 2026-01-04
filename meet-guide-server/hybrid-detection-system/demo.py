from hybrid_detector import hybrid_detector

sentences = [
    "The cap of the marker was missing during the workshop.",
    "That presentation was straight up fire.",
    "Our revenue model hits different this quarter.",
    "He walked in with insane rizz today.",
    "Please place the slide into the projector properly.",
    "This new UI design slaps, no cap.",
    "We need to finalize the budget revision by Friday.",
    "He was so salty after his proposal got rejected.",
    "The motherboard on the device needs replacement.",
    "This idea? Honestly bussin.",
    "Let’s schedule a call to review the new features.",
    "Her outfit during the launch event was giving CEO vibes.",
    "He went full delulu thinking the project was flawless.",
    "We need to fire up the backup server before migration.",
    "Her confidence absolutely slayed the presentation.",
    "He canceled the meeting for logistical reasons.",
    "The quarterly report will be shared tomorrow.",
    "That new template is so clean but also kinda mid.",
    "The vibes in today’s meeting were strange.",
    "Please put the cap back on the water bottle.",
    "This party-themed slide deck is too extra for a business meeting.",
    "That concept hits different when applied to customer retention.",
    "The CEO appreciated the detailed documentation.",
    "The team was pressed about missing the sprint deadline.",
    "He literally yeet the stress ball across the office.",
    "We need more data before making that decision.",
    "Her rizz on stage was unmatched.",
    "The fire alarm test will begin at 2 PM.",
    "He was serving confident leadership energy today.",
    "She said the metrics were wrong, no cap.",
    "We need to schedule onboarding for next Monday.",
    "He looked shook after hearing the new requirements.",
    "This new logo is lowkey growing on me.",
    "Welcome to the annual general meeting.",
    "The system glitched, causing the UI to look extra weird.",
    "He drank his tea during the break.",
    "Our main character energy is lacking this quarter.",
    "The data visualization absolutely slaps.",
    "Please fire the process again to confirm the behavior.",
    "Her budget proposal was straight up cap.",
    "Nothing unusual was found in the audit report.",
    "He has been ghosting the team chat all week.",
    "This workflow is smooth but the documentation is trash.",
    "Her work on the pitch deck was fire, fr.",
    "Resource allocation will be discussed tomorrow.",
    "He acted a bit extra during the review session.",
    "This calculation gave me a big yikes moment.",
    "Can you update the KPI dashboard before lunch?",
    "The training session was actually pretty lit.",
    "She understood the assignment perfectly.",
    "The conversion numbers are mid compared to last quarter.",
    "We need two more slides for the investor deck.",
    "His version of the report was cooked, no cap.",
    "I put the cap on the bottle, as requested.",
    "The client appreciated your detailed explanation.",
    "They were salty that their design got rejected.",
    "Our servers crashed again—big yikes.",
    "The new intern is actually kinda slaying every task.",
    "Project deadlines will be extended due to maintenance.",
    "Her idea hit different once we saw the prototype."
]

print("\n--- HYBRID SYSTEM RESULTS ---\n")

for s in sentences:
    result = hybrid_detector.analyze(s)
    print(f"Text       : {s}")
    print(f"Method     : {result['method']}")
    print(f"Slang      : {result['is_slang']}")
    print(f"Confidence : {result['confidence']}")
    print(f"Term       : {result['term']}")
    print("-" * 60)
