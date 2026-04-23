from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, date
from typing import List, Optional
from bson import ObjectId

from .config import settings
from .models import ChatRequest, ChatResponse
from .db import get_db
from .llm import chat_completion

app = FastAPI(title="Patient Chatbot", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_UNSAFE = [
    "i recommend stopping", "stop taking", "discontinue your",
    "i diagnose", "you have cancer", "take more than", "overdose on",
]

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

async def fetch_patient_data(patient_id: str) -> dict:
    db = get_db()
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

        data["medications"]     = list(dict.fromkeys(meds))
        data["medical_history"] = history

    return data

def build_messages(patient_data: dict, history: List[dict], question: str) -> List[dict]:
    system = (
        "You are a medical assistant chatbot helping a patient using their personal medical data.\n"
        "- Use only the provided data\n"
        "- Do not hallucinate\n"
        "- If unsure, say: 'Please consult your doctor'\n"
        "- Keep answers simple and safe\n"
        "- Do not diagnose or prescribe medications\n"
        "- When asked about drug interactions:
  - Explain the interaction clearly
  - Mention the level of risk (low / moderate / high)
  - Connect the answer directly to the patient's medications
  - Avoid saying "I'm not sure" unless absolutely necessary"
    )

    diseases        = ", ".join(patient_data.get("diseases", []))   or "None recorded"
    medications     = ", ".join(patient_data.get("medications", [])) or "None recorded"
    surgeries       = ", ".join(patient_data.get("surgeries", []))  or "None recorded"
    medical_history = "\n".join(
        f"  - {h}" for h in patient_data.get("medical_history", [])
    ) or "  None recorded"

    chat_lines = []
    for turn in (history or [])[-5:]:
        if "message" in turn and "answer" in turn:
            chat_lines.append(f"Patient: {turn['message']}")
            chat_lines.append(f"Assistant: {turn['answer']}")
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

@app.get("/health")
def health():
    return {"status": "ok", "service": "patient-chatbot", "version": "2.0.0"}

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not req.patientId or not req.message.strip():
        raise HTTPException(status_code=400, detail="patientId and message are required")

    db = get_db()
    history_docs = await db[settings.CHAT_COLLECTION].find(
        {"patientId": req.patientId}
    ).sort("createdAt", -1).limit(5).to_list(length=5)
    history_docs.reverse()
    history = [{"message": d["message"], "answer": d["answer"]} for d in history_docs]

    patient_data = await fetch_patient_data(req.patientId)
    messages     = build_messages(patient_data, history, req.message)
    answer       = chat_completion(messages, temperature=0.3, max_tokens=1024)

    if any(p in answer.lower() for p in _UNSAFE):
        answer = "Please consult your doctor for this kind of recommendation."

    await db[settings.CHAT_COLLECTION].insert_one({
        "patientId":  req.patientId,
        "message":    req.message,
        "answer":     answer,
        "createdAt":  datetime.utcnow(),
    })

    return ChatResponse(answer=answer)
