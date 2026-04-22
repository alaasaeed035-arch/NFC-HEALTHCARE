from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

class ChatRequest(BaseModel):
    patient_id: int = Field(..., description="ID of patient in DB")
    message: str = Field(..., min_length=1, max_length=2000)

class NLPResponse(BaseModel):
    intent: str
    entities: Dict[str, Any] = {}
    confidence: float = 0.0
    answer: str
    data: Optional[Any] = None
    suggestions: List[str] = []