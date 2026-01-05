import json
from pathlib import Path
from typing import List, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from main import process_meeting_transcript  # reuse pipeline

BASE_DIR = Path(__file__).parent
SAMPLE_PATH = BASE_DIR / "sample_transcript.json"

app = FastAPI(title="Intent Demo", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TranscriptRequest(BaseModel):
    transcript: str


def _parse_transcript(raw: str) -> List[Dict[str, str]]:
    """Expect lines in the form "Speaker: sentence"; fallback speaker if missing."""
    turns = []
    for idx, line in enumerate(raw.splitlines()):
        clean = line.strip()
        if not clean:
            continue
        if ":" in clean:
            speaker, text = clean.split(":", 1)
        else:
            speaker, text = f"Speaker {idx+1}", clean
        turns.append({"speaker": speaker.strip(), "sentence": text.strip()})
    if not turns:
        raise ValueError("No transcript content found")
    return turns


def _sample_text() -> str:
    if not SAMPLE_PATH.exists():
        return "Host: Welcome to the meeting\nAlex: Let's finalize the launch plan\nSam: Can you prepare the metrics dashboard by Friday?"
    data = json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))
    return "\n".join(
        f"{item.get('speaker', 'Speaker')}: {item.get('sentence', item.get('text', ''))}" for item in data
    )


@app.get("/api/sample")
async def sample():
    return {"transcript": _sample_text()}


@app.post("/api/analyze")
async def analyze(body: TranscriptRequest):
    try:
        turns = _parse_transcript(body.transcript)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    results = process_meeting_transcript(turns)
    action_items = [r for r in results if r.get("intent") == "action-item"]
    counts: Dict[str, int] = {}
    for r in results:
        intent = r.get("intent")
        counts[intent] = counts.get(intent, 0) + 1

    return JSONResponse({
        "results": results,
        "actionItems": action_items,
        "intentCounts": counts,
    })


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("web_server:app", host="127.0.0.1", port=8000, reload=True)
