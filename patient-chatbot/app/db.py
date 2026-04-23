from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

_client = None

def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        if not settings.MONGODB_URI:
            raise RuntimeError("MONGO_URI is missing from environment")
        _client = AsyncIOMotorClient(settings.MONGODB_URI)
    return _client

def get_db():
    return get_client()[settings.MONGODB_DB]
