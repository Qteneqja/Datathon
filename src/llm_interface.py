"""
DeepSeek LLM integration for Explore Winnipeg.

Provides an optional AI layer for richer itinerary descriptions and an
interactive chat assistant.  The app works without it — if the API key is
missing or any call fails, every public function falls back gracefully.

Environment variables (also readable from Streamlit secrets):
    DEEPSEEK_API_KEY   — required for LLM features
    DEEPSEEK_BASE_URL  — optional; default https://api.deepseek.com
    DEEPSEEK_MODEL     — optional; default deepseek-chat
"""

from __future__ import annotations

import os
import time
import logging
from typing import Any

import requests
import pandas as pd

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------

class LLMError(Exception):
    """Raised when a DeepSeek API call fails after all retries."""


# ---------------------------------------------------------------------------
# Key resolution (env var → Streamlit secrets → None)
# ---------------------------------------------------------------------------

def _get_secret(name: str, default: str = "") -> str:
    """Read from env first, then try Streamlit secrets, else return *default*."""
    val = os.environ.get(name, "")
    if val:
        return val
    try:
        import streamlit as st
        return st.secrets.get(name, default)
    except Exception:
        return default


def deepseek_available() -> bool:
    """Return True if a non-empty DeepSeek API key is configured."""
    return bool(_get_secret("DEEPSEEK_API_KEY"))


# ---------------------------------------------------------------------------
# Low-level API call
# ---------------------------------------------------------------------------

_DEFAULT_BASE = "https://api.deepseek.com"
_DEFAULT_MODEL = "deepseek-chat"
_TIMEOUT = 20  # seconds
_MAX_RETRIES = 2
_BACKOFF_BASE = 1.5  # seconds


def call_deepseek(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.5,
    max_tokens: int = 250,
) -> str:
    """
    Send a chat-completion request to DeepSeek's OpenAI-compatible endpoint.

    Parameters
    ----------
    messages : list of {"role": ..., "content": ...} dicts
    model : override for DEEPSEEK_MODEL env var
    temperature : sampling temperature (0–2)
    max_tokens : maximum tokens in the response

    Returns
    -------
    str — the assistant's reply text.

    Raises
    ------
    LLMError — after *_MAX_RETRIES* unsuccessful attempts.
    """
    api_key = _get_secret("DEEPSEEK_API_KEY")
    if not api_key:
        raise LLMError("DEEPSEEK_API_KEY is not set")

    base_url = _get_secret("DEEPSEEK_BASE_URL", _DEFAULT_BASE).rstrip("/")
    model = model or _get_secret("DEEPSEEK_MODEL", _DEFAULT_MODEL)
    url = f"{base_url}/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    last_err: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            last_err = exc
            if attempt < _MAX_RETRIES:
                wait = _BACKOFF_BASE * (2 ** attempt)
                logger.warning("DeepSeek attempt %d failed: %s — retrying in %.1fs", attempt + 1, exc, wait)
                time.sleep(wait)

    raise LLMError(f"DeepSeek API failed after {_MAX_RETRIES + 1} attempts: {last_err}")


# ---------------------------------------------------------------------------
# Grounded itinerary description
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are a friendly local travel guide for Winnipeg, Manitoba. "
    "You MUST use ONLY the locations listed below — never invent new ones. "
    "If asked about a place not in the provided list, say you can't find it "
    "in the current selection. "
    "Write a short, punchy itinerary summary (80–140 words). "
    "Tone: warm, enthusiastic, like a knowledgeable local friend. "
    "Do not mention datasets, data, code, AI models, or prompts. "
    "Do not use markdown formatting — write plain text only."
)


def _build_itinerary_user_prompt(
    itinerary: pd.DataFrame,
    allowed_names: list[str],
    user_prefs: dict[str, Any] | None = None,
) -> str:
    """Construct the USER message for itinerary description generation."""
    lines: list[str] = []

    # User preferences
    if user_prefs:
        interests = user_prefs.get("interests", [])
        days = user_prefs.get("trip_days", 1)
        if interests:
            lines.append(f"Visitor interests: {', '.join(interests)}.")
        lines.append(f"Trip length: {days} day(s).")
        lines.append("")

    # Itinerary stops
    lines.append("Itinerary stops (in order):")
    for _, row in itinerary.iterrows():
        stop_line = f"  {int(row['stop_number'])}. {row['name']} — {row['category']}"
        if "time_slot" in row.index and pd.notna(row.get("time_slot")):
            stop_line += f" [{row['time_slot']}]"
        if "tourism_score" in row.index and pd.notna(row.get("tourism_score")):
            stop_line += f" (score {row['tourism_score']:.0f}/100)"
        if "distance_to_transit_stop" in row.index and pd.notna(row.get("distance_to_transit_stop")):
            stop_line += f" ~{row['distance_to_transit_stop']:.0f}m to transit"
        lines.append(stop_line)

    # Allowed locations (compact)
    lines.append("")
    lines.append(f"Allowed locations (use ONLY these names): {', '.join(allowed_names[:40])}")

    lines.append("")
    lines.append("Write a vivid itinerary summary for these stops.")
    return "\n".join(lines)


def _validate_grounding(text: str, allowed_names: list[str]) -> bool:
    """
    Light validation: check that no obviously fabricated location names appear.
    Returns True if the text looks grounded (or we can't detect a violation).
    """
    import re

    # Strip markdown bold/italic markers for clean extraction
    clean = re.sub(r"\*{1,2}([^*]+)\*{1,2}", r"\1", text)

    # Extract explicitly named places: quoted names or markdown-bold names
    mentioned = set()
    # Quoted names
    for match in re.findall(r'"([^"]{3,40})"', clean):
        mentioned.add(match.strip().rstrip("."))
    for match in re.findall(r"'([^']{3,40})'", clean):
        mentioned.add(match.strip().rstrip("."))

    if not mentioned:
        return True  # nothing definitive to check — allow it

    allowed_lower = {n.lower() for n in allowed_names}
    for name in mentioned:
        nl = name.lower()
        if nl in allowed_lower:
            continue
        # Allow if it's a substring of any allowed name (or vice versa)
        if any(nl in a or a in nl for a in allowed_lower):
            continue
        logger.warning("Possible hallucinated location: %r", name)
        return False
    return True


def grounded_itinerary_description(
    itinerary: pd.DataFrame,
    locations_df: pd.DataFrame,
    user_prefs: dict[str, Any] | None = None,
) -> str:
    """
    Generate an LLM-powered itinerary description, grounded to real data.

    Falls back to the templated description if:
    - DeepSeek key is not configured
    - API call fails
    - Response contains hallucinated locations (after one retry)

    Parameters
    ----------
    itinerary : pd.DataFrame
        The generated itinerary (must have name, category, stop_number).
    locations_df : pd.DataFrame
        The full scored locations DataFrame (source of truth).
    user_prefs : dict, optional
        {"interests": [...], "trip_days": int}

    Returns
    -------
    str — A short narrative summary.
    """
    # ---- Fallback import (always available) ----
    from src.itinerary import generate_itinerary_description as _template_fallback

    if not deepseek_available():
        return _template_fallback(itinerary)

    if itinerary.empty:
        return "No itinerary to describe."

    # Build allowed names list (itinerary stops + top-scored neighbours)
    itin_names = itinerary["name"].tolist()
    top_names = (
        locations_df.nlargest(30, "tourism_score")["name"].tolist()
        if "tourism_score" in locations_df.columns
        else locations_df["name"].head(30).tolist()
    )
    allowed_names = list(dict.fromkeys(itin_names + top_names))  # dedupe, preserve order

    user_msg = _build_itinerary_user_prompt(itinerary, allowed_names, user_prefs)
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    # Attempt 1
    try:
        text = call_deepseek(messages, max_tokens=300)
    except LLMError as exc:
        logger.warning("LLM call failed, using template fallback: %s", exc)
        return _template_fallback(itinerary)

    if _validate_grounding(text, allowed_names):
        return text

    # Attempt 2 — stricter prompt
    logger.info("Grounding validation failed; retrying with stronger constraint")
    messages.append({"role": "assistant", "content": text})
    messages.append({
        "role": "user",
        "content": (
            "Your previous response mentioned places not in my list. "
            "Please rewrite using ONLY these locations: "
            + ", ".join(itin_names)
            + ". Do not add any other place names."
        ),
    })

    try:
        text = call_deepseek(messages, max_tokens=300)
    except LLMError:
        return _template_fallback(itinerary)

    if _validate_grounding(text, allowed_names):
        return text

    # Still not grounded — fall back
    logger.warning("LLM response not grounded after retry; using template")
    return _template_fallback(itinerary)


# ---------------------------------------------------------------------------
# Grounded chat assistant
# ---------------------------------------------------------------------------

_CHAT_SYSTEM_PROMPT = (
    "You are a helpful Winnipeg tourism assistant. "
    "You can ONLY discuss the locations listed below. "
    "If the user asks about a place not on the list, politely say it's not "
    "in the current selection. "
    "Keep answers concise (under 120 words). Be friendly and helpful. "
    "Do not mention datasets, code, AI, or prompts."
)


def chat_reply(
    user_message: str,
    locations_df: pd.DataFrame,
    conversation_history: list[dict[str, str]] | None = None,
    categories: list[str] | None = None,
) -> str:
    """
    Answer a user question grounded to the locations DataFrame.

    Parameters
    ----------
    user_message : str
    locations_df : pd.DataFrame
    conversation_history : prior messages (role/content dicts), if any
    categories : limit context to these categories

    Returns
    -------
    str — assistant reply, or a polite error message on failure.
    """
    if not deepseek_available():
        return "AI chat is not available (no API key configured)."

    df = locations_df
    if categories:
        df = df[df["category"].isin(categories)]

    # Build compact location context
    top = df.nlargest(50, "tourism_score") if "tourism_score" in df.columns else df.head(50)
    loc_lines = []
    for _, row in top.iterrows():
        line = f"- {row['name']} ({row['category']}"
        if "tourism_score" in row.index and pd.notna(row.get("tourism_score")):
            line += f", score {row['tourism_score']:.0f}"
        line += ")"
        loc_lines.append(line)
    loc_context = "\n".join(loc_lines)

    system = _CHAT_SYSTEM_PROMPT + f"\n\nAvailable locations:\n{loc_context}"

    messages = [{"role": "system", "content": system}]
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    try:
        return call_deepseek(messages, max_tokens=250, temperature=0.6)
    except LLMError as exc:
        logger.warning("Chat LLM call failed: %s", exc)
        return "Sorry, I couldn't process that request right now. Please try again."
