from groq import Groq
from .config import settings

def make_client() -> Groq:
    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is missing")
    return Groq(api_key=settings.GROQ_API_KEY)

def chat_completion(messages, temperature: float = 0.2, max_tokens: int = 800) -> str:
    client = make_client()
    resp = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content 