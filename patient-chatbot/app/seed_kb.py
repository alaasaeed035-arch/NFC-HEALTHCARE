import asyncio
from .db import get_db
from .config import settings
from .rag import embed_text

SAMPLE_DOCS = [
    {
        "title": "When to seek emergency help",
        "text": "Seek emergency help if you have chest pain, difficulty breathing, severe allergic reaction (swelling of face/lips, trouble breathing), fainting, stroke symptoms (face droop, arm weakness, speech difficulty), or severe bleeding."
    },
    {
        "title": "Medication safety basics",
        "text": "Do not stop or change medications without consulting your doctor. If you suspect a side effect, contact your clinician. For severe symptoms, go to emergency services."
    },
    {
        "title": "Appointment guidance",
        "text": "For non-urgent issues, schedule a clinic appointment. Prepare a list of symptoms, current medications, and any allergies."
    }
]

SAMPLE_PATIENTS = [
    {
        "patientId": "P001",
        "diagnosis": "Type 2 Diabetes, Hypertension",
        "medications": [
            {"name": "Metformin", "dose": "500mg"},
            {"name": "Lisinopril", "dose": "10mg"}
        ]
    }
]

async def main():
    db = get_db()
    
    # Seed KB
    kb_col = db[settings.KB_COLLECTION]
    await kb_col.delete_many({}) # Clear old
    docs = []
    for d in SAMPLE_DOCS:
        d["embedding"] = embed_text(d["text"])
        docs.append(d)
    await kb_col.insert_many(docs)
    print(f"Inserted {len(docs)} KB docs into {settings.KB_COLLECTION}")

    # Seed Patients
    patient_col = db[settings.PATIENT_COLLECTION]
    await patient_col.delete_many({}) # Clear old
    await patient_col.insert_many(SAMPLE_PATIENTS)
    print(f"Inserted {len(SAMPLE_PATIENTS)} patient records into {settings.PATIENT_COLLECTION}")

if __name__ == "__main__":
    asyncio.run(main())