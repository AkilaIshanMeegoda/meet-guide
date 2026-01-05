import json

# Check full transcript for 'appreciate' context
with open('projectmeeting1/participant_transcripts/Chalana.json', 'r') as f:
    data = json.load(f)

print('Full transcript:')
print(data['transcript'])
print()

# Find words around appreciate/app
print('Low confidence words with context:')
for i, w in enumerate(data['words']):
    if w['confidence'] < 0.85 and len(w['word']) >= 3:
        context_start = max(0, i-2)
        context_end = min(len(data['words']), i+3)
        context = data['words'][context_start:context_end]
        context_text = ' '.join([x['word'] for x in context])
        print(f"  [{w['word']}] at {w['start']:.2f}s (conf: {w['confidence']:.3f})")
        print(f"    Context: {context_text}")
