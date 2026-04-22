from typing import Optional, Any, Dict, List
from pydantic import BaseModel, Field
from groq import Groq

client = Groq()  # reads GROQ_API_KEY from env

# This is the exact structure your backend already returns
class NLPResponseSchema(BaseModel):
    intent: str = Field(..., description="e.g., MEDICAL_QA, TRIAGE, MEDICATION_INFO")
    entities: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    answer: str
    data: Optional[Any] = None
    suggestions: List[str] = Field(default_factory=list)

SYSTEM_PROMPT = """
You are a patient-facing medical information assistant.
You must:
- Provide general medical information, not a diagnosis.
- If symptoms could be urgent, recommend urgent care / emergency services.
- Ask concise follow-up questions when needed (age, duration, severity, pregnancy, chronic disease, meds/allergies).
- Be clear, calm, and practical.
- NEVER claim you are a doctor. Encourage clinician consult for uncertain cases.
Return output strictly as JSON matching the provided schema.
"""

def medical_qa_llm(user_message: str) -> NLPResponseSchema:
    """
    Calls OpenAI Responses API and returns a structured NLPResponseSchema.
    Uses Structured Outputs so the model must comply with the schema. :contentReference[oaicite:3]{index=3}
    """
    # You can choose a model. The quickstart shows Responses API usage. :contentReference[oaicite:4]{index=4}
    # Pick a capable general model (examples: "gpt-5.2", "gpt-5", "gpt-4.1").
    model_name = "gpt-5.2"

    resp = client.responses.parse(
        model=model_name,
        input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        # Structured outputs: force valid JSON for this schema :contentReference[oaicite:5]{index=5}
        response_format=NLPResponseSchema,
    )

    # When using parse(), the SDK returns a parsed object
    return resp.output_parsed
