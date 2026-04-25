"""
Patient Medical QA Chatbot — Port 8001
Flow: patients + medicalrecords → prompt → Groq LLM → response
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
from datetime import datetime, date
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MONGO_URI          = os.getenv("MONGO_URI", "mongodb://localhost:27017/nfc-healthcare")
GEMINI_API_KEY     = os.getenv("GEMINI_API_KEY")
CHATBOT_GROQ_MODEL = os.getenv("CHATBOT_GROQ_MODEL", "gemini-2.5-flash")
CHAT_COLLECTION    = os.getenv("CHAT_COLLECTION", "patient_chat_logs")

if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY not set — chatbot will not function")

groq_client = OpenAI(
    api_key=GEMINI_API_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
) if GEMINI_API_KEY else None

mongo_client = None
db = None

async def init_mongodb():
    global mongo_client, db
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        db = mongo_client.get_database()
        await mongo_client.admin.command("ping")
        logger.info("Chatbot MongoDB connected — db: %s", db.name)
    except Exception as e:
        logger.warning("MongoDB connection failed: %s — chat logs disabled", e)
        mongo_client = None
        db = None

async def close_mongodb():
    global mongo_client
    if mongo_client:
        mongo_client.close()

# ── FastAPI ───────────────────────────────────────────────────────────────────
app = FastAPI(title="NFC Healthcare — Patient Chatbot", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Schemas ───────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    patient_id: str
    message: str
    conversation_history: Optional[List[dict]] = []

class ChatResponse(BaseModel):
    reply: str
    patient_context_used: bool

# ── Safety ────────────────────────────────────────────────────────────────────
_UNSAFE = [
    "i recommend stopping", "stop taking", "discontinue your",
    "i diagnose", "you have cancer", "take more than", "overdose on",
]

def _is_unsafe(text: str) -> bool:
    t = text.lower()
    return any(p in t for p in _UNSAFE)

# ── Helpers ───────────────────────────────────────────────────────────────────
def _try_oid(value: str) -> Optional[ObjectId]:
    try:
        return ObjectId(value)
    except Exception:
        return None

def _calc_age(dob) -> Optional[int]:
    if not dob:
        return None
    try:
        born = dob.date() if isinstance(dob, datetime) else dob
        today = date.today()
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    except Exception:
        return None

# ── Patient data fetch ────────────────────────────────────────────────────────
async def fetch_patient_data(patient_id: str) -> dict:
    if db is None:
        return {}

    oid = _try_oid(patient_id)
    patient = None

    if oid:
        patient = await db.patients.find_one({"_id": oid})
    if not patient:
        patient = await db.patients.find_one({
            "$or": [{"nationalId": patient_id}, {"cardId": patient_id}]
        })

    records = []
    if patient:
        pid = patient["_id"]
        records = await db.medicalrecords.find(
            {"patientId": pid}
        ).sort("visitDate", -1).limit(5).to_list(length=5)
        if not records:
            records = await db.medicalrecords.find(
                {"patientId": str(pid)}
            ).sort("visitDate", -1).limit(5).to_list(length=5)

    if not patient and not records:
        return {}

    data = {}

    if patient:
        first = patient.get("firstName", "")
        last  = patient.get("lastName", "")
        data["name"]       = f"{first} {last}".strip() or "Unknown"
        data["age"]        = _calc_age(patient.get("dateOfBirth"))
        data["blood_type"] = patient.get("bloodType", "Unknown")
        data["diseases"]   = patient.get("ChronicDiseases", [])
        data["surgeries"]  = patient.get("surgerys", [])

    if records:
        meds, history = [], []
        for r in records:
            visit = r.get("visitDate")
            vs = visit.strftime("%Y-%m-%d") if hasattr(visit, "strftime") else str(visit or "Unknown")
            entry = f"[{vs}] Diagnosis: {r.get('diagnosis', '')}"
            if r.get("treatment"):
                entry += f", Treatment: {r['treatment']}"
            history.append(entry)
            for m in r.get("medications", []):
                if isinstance(m, dict) and m.get("name"):
                    med = m["name"]
                    if m.get("dosage"):
                        med += f" {m['dosage']}"
                    if m.get("duration"):
                        med += f" for {m['duration']}"
                    meds.append(med)

        data["medications"]     = list(dict.fromkeys(meds))  # deduplicate
        data["medical_history"] = history

    return data

# ── Prompt builder ────────────────────────────────────────────────────────────
def build_messages(patient_data: dict, history: List[dict], question: str) -> List[dict]:
    system = ( 
        "You are a medical assistant chatbot helping a patient using their personal medical data.\n"
        "- Use only the provided patient data\n"
        "- Do not hallucinate or invent medical facts\n"
        "- If unsure, say: 'Please consult your doctor'\n"
        "- Keep answers clear, simple and safe\n"
        "- Avoid medical jargon unless necessary\n"
        "- Be direct and structured in your answers\n"
        "- Do not diagnose or prescribe medications\n"
        "- If information is incomplete:\n"
              "  - Give safe general guidance\n"
              "  - Then recommend consulting a doctor\n"
        "- Avoid saying \"I don't know\" without context\n"
        "- When asked about medications:\n"
             "- Clearly explain possible interactions\n"
             "- Mention the level of risk (low / moderate / high)\n"
             "- Explain WHY the interaction happens (briefly)\n"
             "- Connect the answer directly to the patient's medications\n"
             "- If risk exists → advise consulting a doctor immediately\n"
        "- Always consider:\n"
             "- Diseases\n"
             "- Medications\n"
             "- Surgeries\n"
             "- Medical history\n"
             "- Tailor every response to the specific patient\n"
             "- Do NOT give generic answers if patient data is available\n" 
        "- Use conversation history when relevant\n"
        "- Maintain consistency with previous answers" 
    )

    diseases        = ", ".join(patient_data.get("ChronicDiseases", []))   or "None recorded"
    medications     = ", ".join(patient_data.get("medications", [])) or "None recorded"
    surgeries       = ", ".join(patient_data.get("surgerys", []))  or "None recorded"
    medical_history = "\n".join(
        f"  - {h}" for h in patient_data.get("medical_history", [])
    ) or "  None recorded"

    chat_lines = []
    for turn in (history or [])[-5:]:
        role    = turn.get("role", "")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            chat_lines.append(f"{role.capitalize()}: {content}")
    chat_history = "\n".join(chat_lines) or "No previous messages"

    user_content = (
        f"Patient Data:\n"
        f"Name: {patient_data.get('name', 'Unknown')}\n"
        f"Age: {patient_data.get('age', 'Unknown')}\n"
        f"Blood Type: {patient_data.get('blood_type', 'Unknown')}\n"
        f"Diseases: {diseases}\n"
        f"Medications: {medications}\n"
        f"Surgeries: {surgeries}\n"
        f"History:\n{medical_history}\n\n"
        f"Chat History:\n{chat_history}\n\n"
        f"Question:\n{question}\n\n"
        f"Answer:"
    )

    return [
        {"role": "system", "content": system},
        {"role": "user",   "content": user_content},
    ]

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not groq_client:
        raise HTTPException(status_code=503, detail="CHATBOT_GROQ_API_KEY not configured")
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    patient_data = await fetch_patient_data(request.patient_id)
    messages     = build_messages(patient_data, request.conversation_history, request.message)

    try:
        completion = groq_client.chat.completions.create(
            model=CHATBOT_GROQ_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=1024,
        )
        reply = completion.choices[0].message.content
    except Exception as e:
        logger.error("Groq API error: %s", e)
        raise HTTPException(status_code=502, detail=f"LLM error: {str(e)}")

    if _is_unsafe(reply):
        reply = "Please consult your doctor for this kind of recommendation."

    if db is not None:
        try:
            await db[CHAT_COLLECTION].insert_one({
                "patient_id":         request.patient_id,
                "user_message":       request.message,
                "assistant_reply":    reply,
                "patient_context_used": bool(patient_data),
                "model":              CHATBOT_GROQ_MODEL,
                "created_at":         datetime.utcnow(),
            })
        except Exception as e:
            logger.error("Chat log write failed: %s", e)

    return ChatResponse(
        reply=reply,
        patient_context_used=bool(patient_data),
    )

@app.get("/health")
async def health():
    return {
        "status":    "ok",
        "service":   "patient-chatbot",
        "port":      8001,
        "llm_ready": groq_client is not None,
        "db_ready":  db is not None,
    }

# ── Lifecycle ─────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await init_mongodb()
    logger.info("Patient Chatbot started on port 8001")

@app.on_event("shutdown")
async def shutdown():
    await close_mongodb()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
