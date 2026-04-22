from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from bson import ObjectId
from .config import settings
from .db import get_db
from .llm import chat_completion

_model = None

def get_embedder() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _model

def embed_text(text: str) -> List[float]:
    vec = get_embedder().encode(text, normalize_embeddings=True)
    return vec.tolist()

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    norm = np.linalg.norm(v1) * np.linalg.norm(v2)
    if norm == 0:
        return 0.0
    return float(np.dot(v1, v2) / norm)

async def vector_search_kb(query: str, k: int = 5) -> List[Dict[str, Any]]:
    db = get_db()
    qvec = embed_text(query)

    cursor = db[settings.KB_COLLECTION].find({})
    all_docs = await cursor.to_list(length=1000)

    scored_docs = []
    for doc in all_docs:
        if "embedding" in doc:
            score = cosine_similarity(qvec, doc["embedding"])
            doc["score"] = score
            scored_docs.append(doc)

    scored_docs.sort(key=lambda x: x["score"], reverse=True)
    return scored_docs[:k]


def _try_object_id(value: str) -> Optional[ObjectId]:
    """Safely convert a string to ObjectId, return None if invalid."""
    try:
        return ObjectId(value)
    except Exception:
        return None


async def get_patient_context(patient_id: str) -> str:
    """
    Build a comprehensive patient context by joining:
      - patients collection  (demographics)
      - medicalrecords collection (diagnosis + medications)
    
    patient_id can be the patient's _id (ObjectId string) or patientId field.
    """
    db = get_db()

    # ── 1. Resolve patient document ────────────────────────────────────────
    patient_doc = None
    oid = _try_object_id(patient_id)

    if oid:
        # Try by _id first (most common: frontend sends the MongoDB _id)
        patient_doc = await db["patients"].find_one({"_id": oid})

    if not patient_doc:
        # Fallback: try nationalId or cardId
        patient_doc = await db["patients"].find_one({
            "$or": [
                {"nationalId": patient_id},
                {"cardId":     patient_id},
            ]
        })

    # ── 2. Resolve medical record ───────────────────────────────────────────
    medical_doc = None
    if patient_doc:
        pid_str = str(patient_doc["_id"])
        medical_doc = await db[settings.PATIENT_COLLECTION].find_one(
            {"patientId": pid_str}
        )

    # ── 3. Build context string ─────────────────────────────────────────────
    if not patient_doc and not medical_doc:
        # Last-ditch: query medicalrecords directly with the raw patient_id
        medical_doc = await db[settings.PATIENT_COLLECTION].find_one(
            {"patientId": patient_id}
        )

    if not patient_doc and not medical_doc:
        return "No patient record found in the database for this patient ID."

    lines = ["=== PATIENT PROFILE ==="]

    if patient_doc:
        name = f"{patient_doc.get('firstName', '')} {patient_doc.get('lastName', '')}".strip()
        if name:
            lines.append(f"Name: {name}")

    blood_type = (patient_doc or {}).get('bloodType') or (medical_doc or {}).get('bloodType')
    if blood_type:
        lines.append(f"Blood Type: {blood_type}")

    if medical_doc:
        lines.append("\n=== MEDICAL RECORD ===")
        diagnosis = medical_doc.get("diagnosis", "")
        if diagnosis:
            lines.append(f"Diagnosis: {diagnosis}")

        meds = medical_doc.get("medications", [])
        if meds and isinstance(meds, list):
            med_lines = []
            for m in meds:
                if isinstance(m, dict):
                    med_name = m.get("name", "")
                    dose     = m.get("dose", "")
                    entry    = med_name
                    if dose:
                        entry += f" {dose}"
                    if entry:
                        med_lines.append(entry)
            if med_lines:
                lines.append("Current Medications: " + ", ".join(med_lines))

    return "\n".join(lines)


def build_messages(
    user_msg: str,
    patient_context: str,
    kb_docs: List[Dict[str, Any]],
    language: str,
    history: List[Dict[str, str]] = None,
) -> List[Dict[str, str]]:
    if history is None:
        history = []

    sources_block = "\n\n".join(
        [f"[{i+1}] {d.get('title','Untitled')}\n{d.get('text','')[:900]}" for i, d in enumerate(kb_docs)]
    ) or "No knowledge base sources available."

    system = """
You are a warm, knowledgeable, and patient-friendly healthcare assistant for a hospital system.
You have access to this patient's complete medical profile and approved knowledge base articles.

══ SAFETY RULES (non-negotiable) ══
- Do NOT diagnose or suggest new diagnoses.
- Do NOT prescribe, increase, or decrease medication doses.
- Do NOT advise the patient to stop any medication.
- For URGENT symptoms (chest pain, severe difficulty breathing, fainting, stroke signs, severe allergic reaction, suicidal thoughts, heavy bleeding):
  IMMEDIATELY tell the patient to call emergency services or go to the ER. If responding in Arabic, use exactly "يرجى طلب المساعدة الطبية الطارئة فوراً" (DO NOT use the Chinese character 尋求).
- Regarding blood types: You may contextually discuss the patient's blood type (provided in the Patient Profile) to explain compatibility or general facts, but NEVER recommend or prescribe distinct blood therapies.

══ CONTEXT & MEMORY ══
- The Patient Profile contains database records. If it says "No patient record found", it simply means their medical record isn't linked yet.
- You MUST remember details the user tells you in the conversation history (such as their name). Treat the conversation history as factual.

══ RESPONSE STYLE ══
- Be conversational, warm, and empathetic. Address the patient by first name if known.
- For casual chat (e.g., "Hey", "How are you", "My name is..."), reply naturally and KEEP IT BRIEF. Do NOT output "Next Steps" or long disclaimers for casual chat.
- ONLY when the patient specifically asks a medical, health, or record-related question, provide a detailed response including:
    1. A clear explanation of what is known.
    2. General educational information if applicable.
    3. Specific, actionable recommendations.
    4. A "Next Steps" section with 2-3 concrete bullet points.
- You MAY draw on general clinical knowledge to enrich answers, but remind them it's general info.
- If you genuinely do not have enough information for a medical question, say so clearly.

══ LANGUAGE ══
- You MUST answer ENTIRELY in the target language. NEVER provide English translations if speaking Arabic.
- "ar"   → answer ONLY in Arabic (Egyptian dialect). No English words or translations.
- "en"   → answer ONLY in English.
- "auto" → strictly detect the user's language and reply EXCLUSIVELY in that same language. Do not mix languages.
""".strip()

    messages = [{"role": "system", "content": system}]

    # Inject conversational history
    for item in history:
        if "message" in item and "answer" in item:
            messages.append({"role": "user",      "content": item["message"]})
            messages.append({"role": "assistant", "content": item["answer"]})

    user_content = f"""
Patient Profile:
{patient_context}

Knowledge Base Sources:
{sources_block}

Patient's message: {user_msg}

Language mode: {language}

[CRITICAL OUTPUT INSTRUCTIONS]
1. You MUST respond EXCLUSIVELY in the SAME LANGUAGE the user typed in. If the user types in English, respond ONLY in English. If Arabic, ONLY in Arabic.
2. DO NOT output "(Translation: ...)" under any circumstances.
3. DO NOT mix English words into Arabic sentences. Use pure Egyptian Arabic when speaking Arabic.
""".strip()

    messages.append({"role": "user", "content": user_content})
    return messages


async def answer_with_rag(
    patient_id: str,
    message: str,
    language: str = "auto",
    history: List[Dict[str, str]] = None,
) -> Tuple[str, List[Dict[str, Any]]]:
    if history is None:
        history = []

    patient_ctx = await get_patient_context(patient_id)
    kb_docs     = await vector_search_kb(message, k=5)
    msgs        = build_messages(message, patient_ctx, kb_docs, language, history)

    # Increase max_tokens for richer answers
    answer = chat_completion(msgs, temperature=0.4, max_tokens=1500)
    return answer, kb_docs
