from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ChatRequest(BaseModel):
    patientId: str = Field(..., description="Patient identifier (demo only; add auth in production)")
    message: str
    language: Optional[str] = Field(default="auto", description="auto | en | ar")

class SourceDoc(BaseModel):
    id: str
    title: str
    snippet: str
    score: float

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceDoc] = []
    safety_note: str