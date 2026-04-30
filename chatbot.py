"""
Patient Medical QA Chatbot — Port 8001
Flow: patients + medicalrecords → prompt → Groq LLM → response
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
from groq import Groq as GroqClient
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import asyncio
import os
import re
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
DDI_SERVICE_URL    = os.getenv("DDI_SERVICE_URL", "http://localhost:8000")
GROQ_STT_API_KEY   = (
    os.getenv("GROQ_STT_API_KEY")
    or os.getenv("DDI_GROQ_API_KEY")
    or os.getenv("CHATBOT_GROQ_API_KEY")
)

if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY not set — chatbot will not function")

groq_client = OpenAI(
    api_key=GEMINI_API_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
) if GEMINI_API_KEY else None

mongo_client = None
db = None

stt_client = GroqClient(api_key=GROQ_STT_API_KEY) if GROQ_STT_API_KEY else None
if not GROQ_STT_API_KEY:
    logger.warning("No Groq STT API key found — POST /speech-to-text will return 503")

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

# ── DDI integration ───────────────────────────────────────────────────────────
# Patterns that flag a message as a drug-interaction question.
# Covers Egyptian Arabic phrasings and common English phrasings.
_DDI_PATTERNS = re.compile(
    # Arabic patterns
    r"تداخل.{0,20}دوائي"
    r"|(ممكن|يمكن|يجوز|ينفع|يصح|أقدر|تقدر|اقدر).{0,30}(آخد|اخد|أستخدم|استخدم|اشرب)"
    r"|(يتعارض|يتفاعل|يؤثر|خطر|ضار|آمن|ينفع).{0,30}مع"
    r"|مع.{0,20}(أدويتي|دوائي|الدواء|الأدوية|الحبوب|علاجي)"
    r"|تفاعل.{0,10}(دوائي|الدواء|الأدوية)"
    r"|هل.{0,30}(آمن|خطر|ضار|مناسب|يناسب)"
    # English patterns
    r"|drug.{0,15}interact"
    r"|interact(ion|s)?.{0,15}(with|between|of)"
    r"|can.{0,10}(i|we).{0,10}take"
    r"|(interact|combine|mix|take).{0,20}with"
    r"|safe.{0,15}(with|to\s+take|alongside)"
    r"|(conflict|clash).{0,15}(with|between)",
    re.IGNORECASE | re.DOTALL,
)


def _parse_med_string(med_str: str) -> dict:
    """'Metformin 500mg for 30 days' → {name, dosage, frequency, notes}."""
    parts = med_str.split(" for ")
    tokens = parts[0].strip().split()
    name = tokens[0] if tokens else med_str
    dosage = " ".join(tokens[1:]) if len(tokens) > 1 else "unknown"
    return {"name": name, "dosage": dosage or "unknown", "frequency": "unknown", "notes": ""}


async def _extract_drug_name(message: str) -> Optional[str]:
    """Ask the LLM to extract and translate the new drug name to English."""
    if not groq_client:
        return None
    try:
        loop = asyncio.get_running_loop()
        resp = await loop.run_in_executor(
            None,
            lambda: groq_client.chat.completions.create(
                model=CHATBOT_GROQ_MODEL,
                messages=[
                    {"role": "system", "content": (
                        "Extract the drug or medication name the patient is asking about. "
                        "Return ONLY the English generic/brand name. "
                        "Common Arabic→English: بنادول→paracetamol, بروفين→ibuprofen, "
                        "أسبرين→aspirin, أموكسيل→amoxicillin, زيثروماكس→azithromycin, "
                        "كونكور→bisoprolol, ديابيكون→metformin, لانتوس→insulin glargine. "
                        "If no specific drug is identifiable, return exactly: UNKNOWN"
                    )},
                    {"role": "user", "content": message},
                ],
                temperature=0,
                max_tokens=15,
            ),
        )
        name = resp.choices[0].message.content.strip().strip("\"'")
        return None if not name or name.upper() == "UNKNOWN" else name
    except Exception as exc:
        logger.warning("Drug extraction failed: %s", exc)
        return None


async def _call_ddi_service(patient_data: dict, new_drug: str) -> Optional[dict]:
    """
    POST to the DDI service (main.py, port 8000) and return the raw result.
    Uses run_in_executor so the async event loop is never blocked.
    Falls back to None if the service is unreachable — caller will fall through
    to the normal chatbot flow.
    """
    import requests as _req

    current_treatments = [
        _parse_med_string(m) for m in patient_data.get("medications", []) if m
    ]

    payload = {
        "patient": {
            "id": None,
            "name": patient_data.get("name", "Patient"),
            "age": patient_data.get("age") or 30,
            "current_treatments": current_treatments,
        },
        "new_treatment": {
            "name": new_drug,
            "dosage": "as directed",
            "frequency": "as directed",
            "notes": "Patient is asking whether this is safe with current medications.",
        },
    }

    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(
            None,
            lambda: _req.post(
                f"{DDI_SERVICE_URL}/check-conflict",
                json=payload,
                timeout=25,
            ),
        )
        if result.status_code == 200:
            return result.json()
        logger.warning("DDI service returned HTTP %d", result.status_code)
    except Exception as exc:
        logger.warning("DDI service unreachable (%s) — falling back to chatbot", exc)
    return None


_SEVERITY_LABEL = {
    "none":     "✅ No known drug interaction",
    "low":      "🟡 Minor interaction",
    "moderate": "🟠 Moderate interaction — requires attention",
    "high":     "🔴 High-risk interaction — consult your doctor immediately",
    "critical": "🚨 Critical interaction — do NOT take without doctor approval",
}


def _format_ddi_fallback(ddi: dict, new_drug: str) -> str:
    """Plain-text summary when the LLM simplifier is unavailable."""
    sev = _SEVERITY_LABEL.get(ddi.get("severity", "none"), "Unknown severity")
    lines = [f"**Drug Interaction Check — {new_drug}**", "", sev, ""]
    for r in ddi.get("recommendations", [])[:4]:
        lines.append(f"• {r}")
    lines += ["", "🏥 Always consult your doctor before taking any new medication."]
    return "\n".join(lines)


async def _simplify_ddi(ddi: dict, patient_data: dict, new_drug: str, user_message: str = "") -> str:
    """
    Re-phrase the technical DDI analysis in plain Arabic for the patient.
    Uses the same LLM as the chatbot so no extra API key is needed.
    """
    if not groq_client:
        return _format_ddi_fallback(ddi, new_drug)

    tech_summary = (
        f"Drug being asked about: {new_drug}\n"
        f"Conflict detected: {ddi.get('has_conflict')}\n"
        f"Severity: {ddi.get('severity', 'none')}\n"
        f"Analysis: {ddi.get('analysis', '')}\n"
        f"Recommendations: {'; '.join(ddi.get('recommendations', []))}\n"
        f"Known interactions: {'; '.join(ddi.get('interactions', []))}"
    )

    patient_name = patient_data.get("name", "the patient")
    current_meds  = ", ".join(patient_data.get("medications", [])) or "No medications recorded"

    try:
        loop = asyncio.get_running_loop()
        resp = await loop.run_in_executor(
            None,
            lambda: groq_client.chat.completions.create(
                model=CHATBOT_GROQ_MODEL,
                messages=[
                    {"role": "system", "content": (
                        f"You are a medical assistant explaining a drug interaction check result to patient {patient_name}.\n"
                        f"Their current medications: {current_meds}.\n\n"
                        "Strict rules:\n"
                        "- If there is an interaction: clearly and simply explain the risk (why it happens, what the harm is)\n"
                        "- If there is no interaction: reassure the patient — no need to add a doctor warning\n"
                        "- Use clear bullet points and symbols\n"
                        "- Do not exceed 200 words\n"
                        "- Only recommend seeing a doctor if the severity is moderate, high, or critical\n"
                        "- Never advise stopping a current medication\n"
                        "- Respond in the same language the patient used in their message"
                    )},
                    {"role": "user", "content": f"Patient's message: {user_message}\n\nExplain this result to the patient in simple language:\n\n{tech_summary}"},
                ],
                temperature=0.3,
                max_tokens=600,
            ),
        )
        reply = resp.choices[0].message.content
        return reply if not _is_unsafe(reply) else _format_ddi_fallback(ddi, new_drug)
    except Exception as exc:
        logger.error("DDI simplification failed: %s", exc)
        return _format_ddi_fallback(ddi, new_drug)


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

# ── Chat history fetch ────────────────────────────────────────────────────────
async def _trim_chat_history(patient_id: str, keep: int = 5) -> None:
    """Delete all but the newest `keep` exchanges for this patient."""
    if db is None:
        return
    try:
        # Find IDs of documents beyond the newest `keep`
        old_docs = await db[CHAT_COLLECTION].find(
            {"patient_id": patient_id},
            {"_id": 1},
        ).sort("created_at", -1).skip(keep).to_list(length=None)

        if old_docs:
            ids = [d["_id"] for d in old_docs]
            result = await db[CHAT_COLLECTION].delete_many({"_id": {"$in": ids}})
            if result.deleted_count:
                logger.info(
                    "Trimmed %d old chat log(s) for patient %s",
                    result.deleted_count, patient_id,
                )
    except Exception as exc:
        logger.warning("Chat history trim failed: %s", exc)


async def fetch_chat_history(patient_id: str, limit: int = 5) -> List[dict]:
    """Load the last `limit` exchanges from patient_chat_logs and return them
    as [{role, content}, ...] in chronological order."""
    if db is None:
        return []
    try:
        logs = await db[CHAT_COLLECTION].find(
            {"patient_id": patient_id},
            {"user_message": 1, "assistant_reply": 1, "created_at": 1},
        ).sort("created_at", -1).limit(limit).to_list(length=limit)

        logs.reverse()  # oldest → newest

        history: List[dict] = []
        for log in logs:
            if log.get("user_message"):
                history.append({"role": "user",      "content": log["user_message"]})
            if log.get("assistant_reply"):
                history.append({"role": "assistant", "content": log["assistant_reply"]})
        return history
    except Exception as exc:
        logger.warning("Failed to fetch chat history: %s", exc)
        return []


# ── Patient data fetch ────────────────────────────────────────────────────────
async def fetch_patient_data(patient_id: str) -> dict:
    if db is None:
        return {}

    oid = _try_oid(patient_id)
    patient = None

    _exclude = {"emergencyContact": 0, "emergencyContacts": 0, "emergency_contact": 0}

    if oid:
        patient = await db.patients.find_one({"_id": oid}, _exclude)
    if not patient:
        patient = await db.patients.find_one(
            {"$or": [{"nationalId": patient_id}, {"cardId": patient_id}]},
            _exclude,
        )

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
        "You are a knowledgeable medical assistant chatbot. You answer ALL medical questions fully and helpfully.\n"
        "- Answer any general medical question (symptoms, diseases, prevention, nutrition, lifestyle, etc.) using your medical knowledge\n"
        "- When the patient's data is relevant to the question, personalize the answer using it\n"
        "- When the question is general (e.g. 'what are diabetes symptoms?'), answer it fully — do NOT refuse or redirect to a doctor just because it is not in the patient's records\n"
        "- NEVER reveal, mention, or reference emergency contact information under any circumstances\n"
        "- Do not hallucinate or invent medical facts\n"
        "- Keep answers clear, simple and safe\n"
        "- Avoid medical jargon unless necessary\n"
        "- Be direct and structured in your answers\n"
        "- Do not diagnose the patient or prescribe specific medications\n"
        "- Do NOT end every response with 'consult your doctor' — only include that advice when there is genuine risk or urgency\n"
        "- When asked about medications or drug interactions:\n"
             "  - Use this exact compact format for each interacting pair (one line per pair):\n"
             "    🔴 High | DrugA + DrugB — one-sentence reason\n"
             "    🟠 Moderate | DrugA + DrugB — one-sentence reason\n"
             "    🟡 Low | DrugA + DrugB — one-sentence reason\n"
             "    ✅ No interaction | DrugA + DrugB\n"
             "  - Group all pairs under a single '**Drug Interactions**' heading\n"
             "  - Do NOT repeat 'Action: Consult your doctor' after every line — add one summary note at the end only if there are high/critical pairs\n"
             "  - Do NOT use nested bullet points or sub-bullets\n"
             "  - Do NOT write a separate numbered section per drug — list ALL pairs flat\n"
        "- Use conversation history when relevant\n"
        "- Respond in the same language the patient used\n"
        "- Maintain consistency with previous answers"
    )

    diseases        = ", ".join(patient_data.get("ChronicDiseases", []))   or "None recorded"
    medications     = ", ".join(patient_data.get("medications", [])) or "None recorded"
    surgeries       = ", ".join(patient_data.get("surgerys", []))  or "None recorded"
    medical_history = "\n".join(
        f"  - {h}" for h in patient_data.get("medical_history", [])
    ) or "  None recorded"

    chat_lines = []
    for turn in (history or [])[-10:]:
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

    # Load persistent conversation memory from DB; fall back to in-session
    # history sent by the frontend if the DB has no prior logs yet.
    db_history = await fetch_chat_history(request.patient_id, limit=5)
    history = db_history if db_history else (request.conversation_history or [])

    # ── DDI routing ───────────────────────────────────────────────────────────
    # When the patient asks about drug interactions, delegate to the specialist
    # DDI service (main.py / port 8000) which uses FDA + RxNorm + Groq LLM,
    # then simplify the medical report into plain Arabic before returning it.
    if _DDI_PATTERNS.search(request.message):
        new_drug = await _extract_drug_name(request.message)
        if new_drug:
            logger.info("DDI check triggered — drug: %s, patient: %s", new_drug, request.patient_id)
            ddi_result = await _call_ddi_service(patient_data, new_drug)
            if ddi_result:
                reply = await _simplify_ddi(ddi_result, patient_data, new_drug, request.message)
                if db is not None:
                    try:
                        await db[CHAT_COLLECTION].insert_one({
                            "patient_id":           request.patient_id,
                            "user_message":         request.message,
                            "assistant_reply":      reply,
                            "patient_context_used": bool(patient_data),
                            "ddi_check":            True,
                            "ddi_drug":             new_drug,
                            "ddi_severity":         ddi_result.get("severity"),
                            "model":                CHATBOT_GROQ_MODEL,
                            "created_at":           datetime.utcnow(),
                        })
                        await _trim_chat_history(request.patient_id)
                    except Exception as exc:
                        logger.error("Chat log write failed: %s", exc)
                return ChatResponse(reply=reply, patient_context_used=bool(patient_data))
            # DDI service unreachable → fall through to normal chatbot
            logger.info("DDI service unavailable — falling back to chatbot for '%s'", new_drug)

    # ── Normal chatbot flow ───────────────────────────────────────────────────
    messages = build_messages(patient_data, history, request.message)

    try:
        completion = groq_client.chat.completions.create(
            model=CHATBOT_GROQ_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=4096,
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
                "patient_id":           request.patient_id,
                "user_message":         request.message,
                "assistant_reply":      reply,
                "patient_context_used": bool(patient_data),
                "ddi_check":            False,
                "model":                CHATBOT_GROQ_MODEL,
                "created_at":           datetime.utcnow(),
            })
            await _trim_chat_history(request.patient_id)
        except Exception as e:
            logger.error("Chat log write failed: %s", e)

    return ChatResponse(
        reply=reply,
        patient_context_used=bool(patient_data),
    )


# ── Speech-to-Text ────────────────────────────────────────────────────────────
@app.post("/speech-to-text")
async def speech_to_text(audio: UploadFile = File(...)):
    """
    Transcribe audio via Groq Whisper Large v3 — strongest free multilingual ASR.

    Model  : whisper-large-v3 (7,200 sec/day free — https://console.groq.com)
    Accepts: audio/webm, audio/ogg, audio/wav, audio/mp4, audio/mpeg
    Returns: { "text": "..." }
    """
    if stt_client is None:
        raise HTTPException(
            status_code=503,
            detail="GROQ_STT_API_KEY is not set. Get a free key at https://console.groq.com",
        )

    audio_bytes = await audio.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(
            status_code=422,
            detail="Recording too short — please speak for at least one second.",
        )

    filename = audio.filename or "recording.webm"
    content_type = audio.content_type or "audio/webm"

    def _transcribe(lang: str):
        return stt_client.audio.transcriptions.create(
            file=(filename, audio_bytes, content_type),
            model="whisper-large-v3",
            language=lang,
            response_format="verbose_json",
            temperature=0,
        )

    def _avg_logprob(result) -> float:
        segs = getattr(result, "segments", None) or []
        if not segs:
            return -2.0
        logprobs = []
        for s in segs:
            # segments may be dicts OR Pydantic objects depending on SDK version
            lp = s.get("avg_logprob") if isinstance(s, dict) else getattr(s, "avg_logprob", None)
            if lp is not None:
                logprobs.append(lp)
        return sum(logprobs) / len(logprobs) if logprobs else -2.0

    def _arabic_ratio(text: str) -> float:
        chars = [c for c in text if c.strip()]
        if not chars:
            return 0.0
        arabic = sum(1 for c in chars if "؀" <= c <= "ۿ")
        return arabic / len(chars)

    try:
        loop = asyncio.get_running_loop()
        en_result, ar_result = await asyncio.gather(
            loop.run_in_executor(None, lambda: _transcribe("en")),
            loop.run_in_executor(None, lambda: _transcribe("ar")),
        )

        en_conf = _avg_logprob(en_result)
        ar_conf = _avg_logprob(ar_result)
        en_text = (en_result.text or "").strip()
        ar_text = (ar_result.text or "").strip()

        # If confidence scores are too close, use character script as tiebreaker:
        # real Arabic → mostly Arabic chars; real English → mostly Latin chars.
        # This also handles code-switching: dominant script wins.
        if abs(en_conf - ar_conf) < 0.15:
            ar_ratio = _arabic_ratio(ar_text)
            if ar_ratio > 0.5:
                text, detected_language = ar_text, "ar"
            else:
                text, detected_language = en_text, "en"
        elif en_conf >= ar_conf:
            text, detected_language = en_text, "en"
        else:
            text, detected_language = ar_text, "ar"

        if not text:
            raise HTTPException(
                status_code=422,
                detail="No speech detected. Please speak clearly and try again.",
            )

        logger.info("STT [lang=%s en=%.2f ar=%.2f]: %s", detected_language, en_conf, ar_conf, text[:120])
        return {"text": text, "language": detected_language}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("STT error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}")


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
