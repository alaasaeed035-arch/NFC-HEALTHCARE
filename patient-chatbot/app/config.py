import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    MONGODB_URI:    str = os.getenv("MONGO_URI", "mongodb://localhost:27017/nfc-healthcare")
    MONGODB_DB:     str = os.getenv("MONGODB_DB", "nfc-healthcare")
    GROQ_API_KEY:   str = os.getenv("GEMINI_API_KEY", "")
    GROQ_MODEL:     str = os.getenv("CHATBOT_GROQ_MODEL", "gemini-2.5-flash")
    CHAT_COLLECTION: str = os.getenv("CHAT_COLLECTION", "patient_chat_logs")

settings = Settings()
