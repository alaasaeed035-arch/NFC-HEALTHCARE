from openai import OpenAI
from .config import settings

_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

def make_client() -> OpenAI:
    if not settings.GROQ_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is missing")
    return OpenAI(api_key=settings.GROQ_API_KEY, base_url=_GEMINI_BASE_URL)

def chat_completion(messages, temperature: float = 0.3, max_tokens: int = 1024) -> str:
    client = make_client()
    resp = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content
