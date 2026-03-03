import json

# Show all detected errors for each participant
print("\n" + "="*70)
print("ALL DETECTED PRONUNCIATION ERRORS (No Hardcoded Words)")
print("="*70)

for participant in ['Chalana', 'Dinithi', 'Savishka', 'Akila']:
    filepath = f'projectmeeting1/participant_transcripts/{participant}_mispronunciation.json'
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
        
        print(f"\n{'='*60}")
        print(f"{participant}: {data['errors_detected']} errors detected")
        print(f"{'='*60}")
        
        for err in data['errors']:
            source = err.get('source', 'unknown')
            word = err.get('word', '')
            conf = err.get('confidence', 0)
            sev = err.get('severity', '')
            ctx = err.get('context', '')[:50]
            print(f"  [{source:10}] {word:15} conf={conf:.3f} sev={sev:6} | {ctx}")
    except Exception as e:
        print(f"{participant}: Error - {e}")

print("\n" + "="*70)
print("DETECTION METHOD: Dynamic confidence analysis + MFA alignment")
print("NO HARDCODED WORDS - All detection is based on audio analysis")
print("="*70)
