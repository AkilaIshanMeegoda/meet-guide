import os
from transcribe import transcribe_audio
from deepgram import DeepgramClient

api_key = os.environ.get('DEEPGRAM_API_KEY')
client = DeepgramClient(api_key)

audio_file = 'projectmeeting1/Rec_projectmeeting1_uxQvOuzP3jCWZyjCAAAL_akila_gmail_com_2025-12-24T15-48-58_converted.wav'
print(f'Transcribing {audio_file}...')
result = transcribe_audio(audio_file, client)
print(f'Transcript length: {len(result["transcript"])}')
print(f'Word count: {len(result["words"])}')
print(f'First 200 chars: {result["transcript"][:200]}')
