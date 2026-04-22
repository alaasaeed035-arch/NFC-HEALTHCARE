import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    MONGODB_URI: str = os.getenv("MONGODB_URL", "") # Note: .env uses MONGODB_URL
    MONGODB_DB: str = os.getenv("MONGODB_DB", "nfc-healthcare")

    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

    KB_COLLECTION: str = os.getenv("KB_COLLECTION", "kb_documents")
    PATIENT_COLLECTION: str = os.getenv("PATIENT_COLLECTION", "medicalrecord")
    CHAT_COLLECTION: str = os.getenv("CHAT_COLLECTION", "patient_chat_logs")

    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

settings = Settings()