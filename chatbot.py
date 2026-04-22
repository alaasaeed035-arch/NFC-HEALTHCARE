"""
Patient Medical QA Chatbot Service — Port 8001
RAG pipeline: MongoDB medical records → Groq LLM
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from groq import Groq
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from bson import ObjectId
import os
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Config ──────────────────────────────────────────────────────────────────
MONGO_URI             = os.getenv("MONGO_URI", "mongodb://localhost:27017/nfc-healthcare")
CHATBOT_GROQ_API_KEY  = os.getenv("CHATBOT_GROQ_API_KEY")
CHATBOT_GROQ_MODEL    = os.getenv("CHATBOT_GROQ_MODEL", "llama-3.3-70b-versatile")
CHAT_COLLECTION       = os.getenv("CHAT_COLLECTION", "patient_chat_logs")

if not CHATBOT_GROQ_API_KEY:
    logger.warning("⚠️  CHATBOT_GROQ_API_KEY not set — chatbot will not function")

groq_client = Groq(api_key=CHATBOT_GROQ_API_KEY) if CHATBOT_GROQ_API_KEY else None

# ── MongoDB ──────────────────────────────────────────────────────────────────
mongo_client = None
db = None

async def init_mongodb():
    global mongo_client, db
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        db = mongo_client.get_database()
        await mongo_client.admin.command("ping")
        await db[CHAT_COLLECTION].create_index([("patient_id", ASCENDING)])
        await db[CHAT_COLLECTION].create_index([("created_at", DESCENDING)])
        logger.info("✅ Chatbot MongoDB connected — db: %s", db.name)
    except Exception as e:
        logger.warning("⚠️  MongoDB connection failed: %s — chat logs disabled", e)
        mongo_client = None
        db = None

async def close_mongodb():
    global mongo_client
    if mongo_client:
        mongo_client.close()

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="NFC Healthcare — Patient Chatbot", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Only allow Node.js backend
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Schemas ──────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    patient_id: str
    message: str
    conversation_history: Optional[List[dict]] = []

class ChatResponse(BaseModel):
    reply: str
    patient_context_used: bool
    session_id: Optional[str] = None

# ── RAG: fetch patient medical context ───────────────────────────────────────
async def fetch_patient_context(patient_id: str) -> str:
    if db is None:
        return ""
    try:
        records = await db.medicalrecords.find(
            {"patientId": ObjectId(patient_id)}
        ).sort("visitDate", -1).limit(10).to_list(length=10)

        if not records:
            # Also try string comparison for flexibility
            records = await db.medicalrecords.find(
                {"patientId": patient_id}
            ).sort("visitDate", -1).limit(10).to_list(length=10)

        if not records:
            return ""

        lines = ["=== PATIENT MEDICAL HISTORY ==="]
        for r in records:
            visit = r.get("visitDate", "Unknown date")
            if hasattr(visit, "strftime"):
                visit = visit.strftime("%Y-%m-%d")
            lines.append(f"\nVisit: {visit}")
            lines.append(f"Diagnosis: {r.get('diagnosis', 'N/A')}")
            if r.get("treatment"):
                lines.append(f"Treatment: {r['treatment']}")
            meds = r.get("medications", [])
            if meds:
                med_str = ", ".join(
                    f"{m.get('name','?')} {m.get('dosage','')} ({m.get('duration','')})"
                    for m in meds
                )
                lines.append(f"Medications: {med_str}")
            ai = r.get("aiAnalysis", {})
            if ai and ai.get("hasConflict"):
                lines.append(
                    f"AI Flag: {ai.get('severity','?').upper()} conflict — {ai.get('analysis','')[:200]}"
                )

        return "\n".join(lines)
    except Exception as e:
        logger.error("Error fetching patient context: %s", e)
        return ""

# ── LLM call ─────────────────────────────────────────────────────────────────
def build_messages(patient_context: str, history: List[dict], user_message: str) -> List[dict]:
    system_content = (
        "You are a compassionate medical assistant for the NFC Healthcare system. "
        "Answer patient questions about their medical history, medications, diagnoses, "
        "and general health guidance. Be clear, empathetic, and accurate. "
        "Always remind patients to consult their doctor for medical decisions. "
        "Do not diagnose or prescribe."
    )
    if patient_context:
        system_content += f"\n\n{patient_context}"

    messages = [{"role": "system", "content": system_content}]

    for turn in (history or [])[-6:]:  # Last 3 exchanges for context window efficiency
        role = turn.get("role")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})
    return messages

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not groq_client:
        raise HTTPException(status_code=503, detail="CHATBOT_GROQ_API_KEY not configured")

    patient_context = await fetch_patient_context(request.patient_id)

    messages = build_messages(patient_context, request.conversation_history, request.message)

    try:
        completion = groq_client.chat.completions.create(
            model=CHATBOT_GROQ_MODEL,
            messages=messages,
            temperature=0.4,
            max_tokens=1024,
        )
        reply = completion.choices[0].message.content
    except Exception as e:
        logger.error("Groq API error: %s", e)
        raise HTTPException(status_code=502, detail=f"LLM error: {str(e)}")

    # Persist chat log (non-blocking)
    if db is not None:
        try:
            await db[CHAT_COLLECTION].insert_one({
                "patient_id": request.patient_id,
                "user_message": request.message,
                "assistant_reply": reply,
                "patient_context_used": bool(patient_context),
                "model": CHATBOT_GROQ_MODEL,
                "created_at": datetime.utcnow(),
            })
        except Exception as e:
            logger.error("Chat log write failed: %s", e)

    return ChatResponse(
        reply=reply,
        patient_context_used=bool(patient_context),
    )

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "patient-chatbot",
        "port": 8001,
        "llm_ready": groq_client is not None,
        "db_ready": db is not None,
    }

# ── Lifecycle ─────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await init_mongodb()
    logger.info("🤖 Patient Chatbot service started on port 8001")

@app.on_event("shutdown")
async def shutdown():
    await close_mongodb()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
