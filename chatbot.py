"""
Patient Medical QA Chatbot — Port 8001
Flow: patients + medicalrecords → prompt → Gemini LLM → response
STT: Speechmatics Arabic (enhanced) — best accuracy for Egyptian Arabic dialect
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import asyncio
import os
import re
import time
import json
import logging
import tempfile
import subprocess
import requests as _req
from datetime import datetime, date, timezone
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MONGO_URI               = os.getenv("MONGO_URI", "mongodb+srv://bodytarek2003_db_user:bPzJxGCug6LhNKxl@cluster0.qkbfket.mongodb.net/nfc-healthcare?appName=Cluster0")
GEMINI_API_KEY          = os.getenv("GEMINI_API_KEY")
SPEECHMATICS_API_KEY    = os.getenv("SPEECHMATICS_API_KEY")
CHATBOT_GROQ_MODEL      = os.getenv("CHATBOT_GROQ_MODEL", "gemini-2.5-flash")
CHAT_COLLECTION         = os.getenv("CHAT_COLLECTION", "patient_chat_logs")
DDI_SERVICE_URL         = os.getenv("DDI_SERVICE_URL", "http://localhost:8000")
SPEECHMATICS_URL        = "https://asr.api.speechmatics.com/v2"
GROQ_API_KEY            = os.getenv("GROQ_API_KEY")

if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY not set — chatbot will not function")
if not SPEECHMATICS_API_KEY:
    logger.warning("SPEECHMATICS_API_KEY not set — speech-to-text will not function")

groq_client = OpenAI(
    api_key=GEMINI_API_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
) if GEMINI_API_KEY else None

mongo_client = None
db = None

# ── Hospital cache (5-minute TTL) ─────────────────────────────────────────────
_hospital_cache: list = []
_hospital_cache_ts: float = 0.0
_HOSPITAL_TTL = 300  # seconds


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
    parts = med_str.split(" for ")
    tokens = parts[0].strip().split()
    name = tokens[0] if tokens else med_str
    dosage = " ".join(tokens[1:]) if len(tokens) > 1 else "unknown"
    return {"name": name, "dosage": dosage or "unknown", "frequency": "unknown", "notes": ""}


async def _extract_drug_name(message: str) -> Optional[str]:
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
    "none":     "لا يوجد تفاعل دوائي معروف",
    "low":      "تفاعل بسيط",
    "moderate": "تفاعل متوسط — يحتاج انتباه",
    "high":     "تفاعل عالي الخطورة — راجع دكتورك فورا",
    "critical": "تفاعل حرج — لا تاخده من غير موافقة الدكتور",
}


_SEVERITY_LABEL_EN = {
    "none":     "No known drug interaction",
    "low":      "Minor interaction",
    "moderate": "Moderate interaction — use with caution",
    "high":     "High-risk interaction — consult your doctor immediately",
    "critical": "Critical interaction — do not take without doctor approval",
}

def _format_ddi_fallback(ddi: dict, new_drug: str, arabic: bool = True) -> str:
    if arabic:
        sev = _SEVERITY_LABEL.get(ddi.get("severity", "none"), "خطورة غير معروفة")
        lines = [f"فحص التفاعل الدوائي — {new_drug}", "", sev, ""]
        for r in ddi.get("recommendations", [])[:4]:
            lines.append(f"• {r}")
        lines += ["", "راجع دكتورك قبل ما تاخد أي دواء جديد."]
    else:
        sev = _SEVERITY_LABEL_EN.get(ddi.get("severity", "none"), "Unknown severity")
        lines = [f"Drug Interaction Check — {new_drug}", "", sev, ""]
        for r in ddi.get("recommendations", [])[:4]:
            lines.append(f"• {r}")
        lines += ["", "Please consult your doctor before taking any new medication."]
    return "\n".join(lines)


async def _simplify_ddi(ddi: dict, patient_data: dict, new_drug: str, user_message: str = "") -> str:
    arabic = _is_arabic(user_message)
    if not groq_client:
        return _format_ddi_fallback(ddi, new_drug, arabic)

    tech_summary = (
        f"Drug being asked about: {new_drug}\n"
        f"Conflict detected: {ddi.get('has_conflict')}\n"
        f"Severity: {ddi.get('severity', 'none')}\n"
        f"Analysis: {ddi.get('analysis', '')}\n"
        f"Recommendations: {'; '.join(ddi.get('recommendations', []))}\n"
        f"Known interactions: {'; '.join(ddi.get('interactions', []))}"
    )

    patient_name = patient_data.get("name", "المريض")
    current_meds = "، ".join(patient_data.get("medications", [])) or "لا يوجد أدوية مسجلة"

    try:
        loop = asyncio.get_running_loop()
        resp = await loop.run_in_executor(
            None,
            lambda: groq_client.chat.completions.create(
                model=CHATBOT_GROQ_MODEL,
                messages=[
                    {"role": "system", "content": (
                        f"أنت مساعد طبي بتشرح نتيجة فحص تفاعل الأدوية للمريض {patient_name}.\n"
                        f"أدويته الحالية: {current_meds}.\n\n"
                        "قواعد:\n"
                        "- لو الرسالة بالعربي: رد باللهجة المصرية البسيطة فقط، متستخدمش إنجليزي إلا في أسماء الأدوية\n"
                        "- لو الرسالة بالإنجليزي: رد بالإنجليزي\n"
                        "- لو في تفاعل: اشرح الخطر ببساطة (ليه بيحصل وإيه الضرر)\n"
                        "- لو مفيش تفاعل: طمن المريض من غير ما تنصحه يراجع دكتور\n"
                        "- استخدم bullet points ورموز واضحة\n"
                        "- متتعدش 150 كلمة\n"
                        "- انصح بزيارة دكتور بس لو الخطورة متوسطة أو عالية\n"
                        "- متنصحش بوقف أي دواء حالي\n"
                    )},
                    {"role": "user", "content": f"رسالة المريض: {user_message}\n\nاشرح النتيجة دي للمريض بلغة بسيطة:\n\n{tech_summary}"},
                ],
                temperature=0.5,
                max_tokens=1024,
            ),
        )
        reply = resp.choices[0].message.content
        return reply if not _is_unsafe(reply) else _format_ddi_fallback(ddi, new_drug, arabic)
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

# ── Chat history ──────────────────────────────────────────────────────────────
async def _trim_chat_history(patient_id: str, keep: int = 5) -> None:
    if db is None:
        return
    try:
        old_docs = await db[CHAT_COLLECTION].find(
            {"patient_id": patient_id},
            {"_id": 1},
        ).sort("created_at", -1).skip(keep).to_list(length=None)

        if old_docs:
            ids = [d["_id"] for d in old_docs]
            result = await db[CHAT_COLLECTION].delete_many({"_id": {"$in": ids}})
            if result.deleted_count:
                logger.info("Trimmed %d old chat log(s) for patient %s", result.deleted_count, patient_id)
    except Exception as exc:
        logger.warning("Chat history trim failed: %s", exc)


async def fetch_chat_history(patient_id: str, limit: int = 5) -> List[dict]:
    if db is None:
        return []
    try:
        logs = await db[CHAT_COLLECTION].find(
            {"patient_id": patient_id},
            {"user_message": 1, "assistant_reply": 1, "created_at": 1},
        ).sort("created_at", -1).limit(limit).to_list(length=limit)

        logs.reverse()

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

        data["medications"]     = list(dict.fromkeys(meds))
        data["medical_history"] = history

    return data


# ── Hospitals fetch (cached) ──────────────────────────────────────────────────
async def fetch_hospitals() -> List[dict]:
    global _hospital_cache, _hospital_cache_ts
    now = time.time()
    if _hospital_cache and (now - _hospital_cache_ts) < _HOSPITAL_TTL:
        return _hospital_cache
    if db is None:
        return []
    try:
        hospitals = await db.hospitals.find(
            {},
            {"name": 1, "address": 1, "phoneNumber": 1, "hotline": 1, "departments": 1},
        ).to_list(length=100)
        _hospital_cache = hospitals
        _hospital_cache_ts = now
        return hospitals
    except Exception as exc:
        logger.warning("Failed to fetch hospitals: %s", exc)
        return _hospital_cache  # return stale cache on error rather than empty


# ── Language detection ────────────────────────────────────────────────────────
def _is_arabic(text: str) -> bool:
    return any("؀" <= c <= "ۿ" for c in text)


# ── Prompt builder ────────────────────────────────────────────────────────────
def build_messages(patient_data: dict, history: List[dict], question: str, hospitals: List[dict] = []) -> List[dict]:
    arabic = _is_arabic(question)

    if arabic:
        system = (
            "أنت مساعد طبي ذكي بتتكلم باللهجة المصرية البسيطة.\n"
            "هدفك إنك تشرح لأي مريض أي معلومة طبية بطريقة سهلة وودودة.\n\n"
            "قواعد مهمة:\n"
            "- لازم ردك يكون باللهجة المصرية العامية فقط\n"
            "- متستخدمش إنجليزي إلا في أسماء الأدوية\n"
            "- اتكلم بلهجة مصرية طبيعية، مش فصحى تقيلة\n"
            "- استخدم جمل قصيرة وواضحة وأسلوب friendly\n"
            "- ابدأ بجملة طبيعية (زي: بص، خليني أوضح لك، طبعاً)\n"
            "- ابعد عن المصطلحات الطبية المعقدة إلا لو ضروري\n"
            "- متشخصش المرض بشكل نهائي ومتوصفش أدوية بجرعات\n"
            "- انصح بزيارة دكتور بس لو في خطر حقيقي أو الحالة مش واضحة\n"
            "- لو سألك عن تفاعل دوائي استخدم الفورمات ده (سطر لكل زوج):\n"
            "    🔴 عالي | دواء أ + دواء ب — سبب في جملة واحدة\n"
            "    🟠 متوسط | دواء أ + دواء ب — سبب في جملة واحدة\n"
            "    🟡 بسيط | دواء أ + دواء ب — سبب في جملة واحدة\n"
            "    ✅ مفيش تفاعل | دواء أ + دواء ب\n"
            "- متكررش 'راجع دكتور' بعد كل سطر، قولها مرة واحدة في الآخر بس لو في خطر\n"
            "- خليك مختصر (80–120 كلمة)\n"
            "- متفضحش بيانات الطوارئ أو أي بيانات شخصية حساسة\n"
            "- عندك قائمة بكل المستشفيات في النظام مع عناوينها — استخدمها لو سألك عنها\n"
            "- لو سألك عن أقرب مستشفى واديتلك موقعه، قارن موقعه بعناوين المستشفيات وقوله الأقرب\n"
            "- لو سألك عن أقرب مستشفى من غير ما يقولك موقعه، اسأله هو بيه دلوقتي\n"
        )
    else:
        system = (
            "You are a smart medical assistant. Communicate in clear, friendly, plain English.\n\n"
            "Rules:\n"
            "- ALWAYS reply in English only — never use Arabic under any circumstance\n"
            "- Use short, clear sentences and a warm, approachable tone\n"
            "- Avoid complex medical jargon unless necessary\n"
            "- Do not give a definitive diagnosis or prescribe specific dosages\n"
            "- Recommend seeing a doctor only if there is a real risk or the situation is unclear\n"
            "- For drug interaction questions use this format (one line per pair):\n"
            "    🔴 High | Drug A + Drug B — reason in one sentence\n"
            "    🟠 Moderate | Drug A + Drug B — reason in one sentence\n"
            "    🟡 Minor | Drug A + Drug B — reason in one sentence\n"
            "    ✅ No interaction | Drug A + Drug B\n"
            "- Don't repeat 'see a doctor' after every line — say it once at the end only if there's risk\n"
            "- Keep responses concise (80–120 words)\n"
            "- Never reveal emergency contacts or sensitive personal data\n"
            "- You have a list of all hospitals in the system with their addresses — use it when asked\n"
            "- If asked about the nearest hospital and given a location, compare it to hospital addresses and name the closest one\n"
            "- If asked about the nearest hospital without a location, ask where the patient is now\n"
        )

    none_val   = "لا يوجد" if arabic else "None"
    unknown    = "غير معروف" if arabic else "Unknown"
    no_history = "  لا يوجد" if arabic else "  None"
    no_chat    = "لا يوجد" if arabic else "None"

    diseases        = "، ".join(patient_data.get("ChronicDiseases", [])) or none_val
    medications     = "، ".join(patient_data.get("medications", []))     or none_val
    surgeries       = "، ".join(patient_data.get("surgerys", []))        or none_val
    medical_history = "\n".join(
        f"  - {h}" for h in patient_data.get("medical_history", [])
    ) or no_history

    chat_lines = []
    for turn in (history or [])[-10:]:
        role    = turn.get("role", "")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            chat_lines.append(f"{role.capitalize()}: {content}")
    chat_history = "\n".join(chat_lines) or no_chat

    def _fmt_hospital(h: dict) -> str:
        line = f"  - {h.get('name', '?')}: {h.get('address', 'N/A')}"
        if h.get('phoneNumber'):
            line += f" | {h['phoneNumber']}"
        if h.get('hotline'):
            line += f" | طوارئ: {h['hotline']}"
        depts = h.get('departments', [])
        if depts:
            dept_names = ", ".join(
                d.get('name', '') for d in depts if d.get('name')
            )
            if dept_names:
                line += f"\n      الأقسام: {dept_names}"
        return line

    hosp_lines = "\n".join(_fmt_hospital(h) for h in hospitals) \
        or ("  لا يوجد مستشفيات مسجلة" if arabic else "  No hospitals registered")

    if arabic:
        user_content = (
            f"بيانات المريض:\n"
            f"الاسم: {patient_data.get('name', unknown)}\n"
            f"العمر: {patient_data.get('age', unknown)}\n"
            f"فصيلة الدم: {patient_data.get('blood_type', unknown)}\n"
            f"الأمراض المزمنة: {diseases}\n"
            f"الأدوية الحالية: {medications}\n"
            f"العمليات: {surgeries}\n"
            f"السجل الطبي:\n{medical_history}\n\n"
            f"المستشفيات في النظام:\n{hosp_lines}\n\n"
            f"سجل المحادثة:\n{chat_history}\n\n"
            f"سؤال المريض:\n{question}\n\n"
            f"الرد:"
        )
        examples = [
            {"role": "user", "content": "عندي صداع بقاله يومين"},
            {"role": "assistant", "content": (
                "بص، الصداع ممكن يكون من كذا سبب زي قلة النوم أو الجفاف أو الضغط النفسي.\n\n"
                "جرب:\n"
                "- تشرب مية كتير\n"
                "- ترتاح شوية وتبعد عن الشاشات\n"
                "- تاخد مسكن بسيط زي البنادول\n\n"
                "لو الصداع شديد أو مستمر أكتر من كده، ساعتها الأفضل تعمل كشف."
            )},
        ]
    else:
        user_content = (
            f"Patient Data:\n"
            f"Name: {patient_data.get('name', unknown)}\n"
            f"Age: {patient_data.get('age', unknown)}\n"
            f"Blood Type: {patient_data.get('blood_type', unknown)}\n"
            f"Chronic Diseases: {diseases}\n"
            f"Current Medications: {medications}\n"
            f"Surgeries: {surgeries}\n"
            f"Medical History:\n{medical_history}\n\n"
            f"Hospitals in System:\n{hosp_lines}\n\n"
            f"Chat History:\n{chat_history}\n\n"
            f"Patient Question:\n{question}\n\n"
            f"Answer:"
        )
        examples = [
            {"role": "user", "content": "What are the symptoms of diabetes?"},
            {"role": "assistant", "content": (
                "Common symptoms of diabetes include frequent urination, excessive thirst, "
                "unexplained weight loss, fatigue, and blurred vision.\n\n"
                "If you're experiencing several of these, it's worth getting a blood sugar test."
            )},
        ]

    return (
        [{"role": "system", "content": system}]
        + examples
        + [{"role": "user", "content": user_content}]
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not groq_client:
        raise HTTPException(status_code=503, detail="CHATBOT_GROQ_API_KEY not configured")
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    patient_data, db_history, hospitals = await asyncio.gather(
        fetch_patient_data(request.patient_id),
        fetch_chat_history(request.patient_id, limit=5),
        fetch_hospitals(),
    )
    history = db_history if db_history else (request.conversation_history or [])

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
                            "created_at":           datetime.now(timezone.utc),
                        })
                        await _trim_chat_history(request.patient_id)
                    except Exception as exc:
                        logger.error("Chat log write failed: %s", exc)
                return ChatResponse(reply=reply, patient_context_used=bool(patient_data))
            logger.info("DDI service unavailable — falling back to chatbot for '%s'", new_drug)

    messages = build_messages(patient_data, history, request.message, hospitals)

    try:
        loop = asyncio.get_running_loop()
        completion = await loop.run_in_executor(
            None,
            lambda: groq_client.chat.completions.create(
                model=CHATBOT_GROQ_MODEL,
                messages=messages,
                temperature=0.5,
                max_tokens=1024,
            ),
        )
        reply = completion.choices[0].message.content
    except Exception as e:
        logger.error("Groq API error: %s", e)
        raise HTTPException(status_code=502, detail=f"LLM error: {str(e)}")

    if _is_unsafe(reply):
        reply = (
            "من فضلك راجع دكتورك لأي توصية من النوع ده."
            if _is_arabic(request.message)
            else "Please consult your doctor for recommendations of this nature."
        )

    if db is not None:
        try:
            await db[CHAT_COLLECTION].insert_one({
                "patient_id":           request.patient_id,
                "user_message":         request.message,
                "assistant_reply":      reply,
                "patient_context_used": bool(patient_data),
                "ddi_check":            False,
                "model":                CHATBOT_GROQ_MODEL,
                "created_at":           datetime.now(timezone.utc),
            })
            await _trim_chat_history(request.patient_id)
        except Exception as e:
            logger.error("Chat log write failed: %s", e)

    return ChatResponse(
        reply=reply,
        patient_context_used=bool(patient_data),
    )


# ── Speech-to-Text ────────────────────────────────────────────────────────────
def _to_wav(audio_bytes: bytes) -> bytes:
    """Convert any browser audio (webm/ogg/mp4) to 16 kHz mono WAV via ffmpeg."""
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        proc = subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_path,
             "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1"],
            capture_output=True, timeout=30,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg: {proc.stderr.decode(errors='replace')[:200]}")
        return proc.stdout
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _speechmatics_transcribe(audio_bytes: bytes, filename: str) -> str:
    """Convert audio to WAV, submit to Speechmatics batch API, poll for transcript."""
    wav_bytes = _to_wav(audio_bytes)

    headers = {"Authorization": f"Bearer {SPEECHMATICS_API_KEY}"}

    config = {
        "type": "transcription",
        "transcription_config": {
            "language": "auto",
            "operating_point": "enhanced",
            "diarization": "none",
        },
    }

    submit_resp = _req.post(
        f"{SPEECHMATICS_URL}/jobs",
        headers=headers,
        data={"config": json.dumps(config)},
        files={"data_file": ("recording.wav", wav_bytes, "audio/wav")},
        timeout=30,
    )
    if not submit_resp.ok:
        raise RuntimeError(f"Speechmatics submit failed: {submit_resp.status_code} {submit_resp.text[:200]}")

    job_id = submit_resp.json()["id"]
    logger.info("Speechmatics job submitted — id: %s", job_id)

    for _ in range(30):
        time.sleep(2)
        status_resp = _req.get(
            f"{SPEECHMATICS_URL}/jobs/{job_id}",
            headers=headers,
            timeout=10,
        )
        status = status_resp.json().get("job", {}).get("status", "")
        if status == "done":
            break
        if status in ("rejected", "deleted"):
            raise RuntimeError(f"Speechmatics job {status}: {status_resp.text[:200]}")

    transcript_resp = _req.get(
        f"{SPEECHMATICS_URL}/jobs/{job_id}/transcript",
        headers=headers,
        params={"format": "txt"},
        timeout=15,
    )
    if not transcript_resp.ok:
        raise RuntimeError(f"Speechmatics transcript fetch failed: {transcript_resp.status_code}")

    return transcript_resp.content.decode("utf-8").strip()


@app.post("/speech-to-text")
async def speech_to_text(audio: UploadFile = File(...)):
    if not SPEECHMATICS_API_KEY:
        raise HTTPException(status_code=503, detail="SPEECHMATICS_API_KEY not configured")

    audio_bytes = await audio.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(
            status_code=422,
            detail="Recording too short — please speak for at least one second.",
        )

    try:
        filename = audio.filename or "recording.webm"
        loop = asyncio.get_running_loop()
        text = await loop.run_in_executor(
            None, _speechmatics_transcribe, audio_bytes, filename
        )

        if not text:
            raise HTTPException(
                status_code=422,
                detail="No speech detected. Please speak clearly and try again.",
            )

        logger.info("STT: %s", text[:120])
        return {"text": text}

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
        "stt_ready": bool(SPEECHMATICS_API_KEY),
        "stt_provider": "Speechmatics",
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
