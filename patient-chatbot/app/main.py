from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from .config import settings
from .models import ChatRequest, ChatResponse, SourceDoc
from .db import get_db
from .rag import answer_with_rag

app = FastAPI(title="Patient Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not req.patientId or not req.message.strip():
        raise HTTPException(status_code=400, detail="patientId and message are required")

    db = get_db()

    # Fetch recent chat history
    cursor = db[settings.CHAT_COLLECTION].find({"patientId": req.patientId}).sort("createdAt", -1).limit(5)
    history_docs = await cursor.to_list(length=5)
    history_docs.reverse()
    
    history = [{"message": d["message"], "answer": d["answer"]} for d in history_docs]
    
    answer, kb_docs = await answer_with_rag(req.patientId, req.message, req.language or "auto", history=history)

    # Build sources for UI
    sources = []
    for d in kb_docs:
        sources.append(SourceDoc(
            id=str(d.get("_id", "")),
            title=d.get("title", "Untitled"),
            snippet=(d.get("text", "")[:220] + "..." if len(d.get("text", "")) > 220 else d.get("text", "")),
            score=float(d.get("score", 0.0))
        ))

    safety_note = "This chatbot provides general information only and does not replace a clinician."

    # Log
    db = get_db()
    await db[settings.CHAT_COLLECTION].insert_one({
        "patientId": req.patientId,
        "message": req.message,
        "answer": answer,
        "sources": [s.model_dump() for s in sources],
        "createdAt": datetime.utcnow(),
    })

    return ChatResponse(answer=answer, sources=sources, safety_note=safety_note)