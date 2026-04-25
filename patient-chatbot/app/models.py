from pydantic import BaseModel, Field

class ChatRequest(BaseModel):
    patientId: str = Field(..., description="Patient MongoDB _id, nationalId, or cardId")
    message: str

class ChatResponse(BaseModel):
    answer: str
    safety_note: str = "This chatbot provides general information only and does not replace a clinician."
