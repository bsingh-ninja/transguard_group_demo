"""Google Gemini client shared by the copilot and the board pack.

Key and model come from backend/.env: GEMINI_API_KEY, GEMINI_MODEL.
"""

import os

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types

load_dotenv()

MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
NO_KEY_MESSAGE = "The AI features need a Gemini API key: set GEMINI_API_KEY in backend/.env, then try again."


def client() -> genai.Client | None:
    load_dotenv(override=True)  # re-read .env so a newly added key works without restarting the API
    key = os.getenv("GEMINI_API_KEY", "").strip()
    # Function calling is only enabled on the v1beta API; this SDK version defaults to v1.
    return genai.Client(api_key=key, http_options=types.HttpOptions(api_version="v1beta")) if key else None


def error_message(e: errors.APIError) -> str:
    code = getattr(e, "code", None)
    if code == 429:
        return "The Gemini API rate limit was reached; try again in a minute."
    if code in (401, 403):
        return "Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env."
    if code == 404:
        return f"Gemini model '{MODEL}' was not found. Set GEMINI_MODEL in backend/.env to an available model."
    return f"Gemini API error {code}: {getattr(e, 'message', e)}"


def generate_text(prompt: str, system: str) -> str:
    """One-shot text generation (guard message translation). Raises RuntimeError with a readable message.
    Thinking is off: translation needs no reasoning, and it cuts each call from about 9 s to about 3 s."""
    c = client()
    if c is None:
        raise RuntimeError(NO_KEY_MESSAGE)
    try:
        r = c.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=system, thinking_config=types.ThinkingConfig(thinking_budget=0)),
        )
    except errors.APIError as e:
        raise RuntimeError(error_message(e)) from e
    return (r.text or "").strip()
