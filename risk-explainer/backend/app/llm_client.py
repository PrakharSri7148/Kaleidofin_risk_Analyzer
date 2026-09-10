"""LLM wrapper — Groq via the OpenAI-compatible API.

Groq exposes an OpenAI-compatible endpoint, so we use the standard ``openai``
SDK pointed at Groq's base URL (no Groq-specific SDK).

Two entry points:
- ``explain(...)`` -> grounded Q&A that MUST cite at least one factor, with a
  retry and a safe template fallback.
- ``phrase_whatif(...)`` -> plain-language phrasing of an already-computed score
  change (no numbers come from the model).

Model fallback: every model call tries PRIMARY_MODEL first; on a 429
(``RateLimitError``) it logs a warning and retries the same request against
FALLBACK_MODEL, which shares the free tier but has a much higher daily cap.
The model that actually served the response is reported back as ``model_used``.

The API key is read from the environment (GROQ_API_KEY), never hardcoded.
"""
from __future__ import annotations

import json
import logging
import os
import re
from functools import lru_cache

from openai import OpenAI, RateLimitError

from . import prompts

logger = logging.getLogger(__name__)

# NOTE: the migration brief specified llama-3.3-70b-versatile / llama-3.1-8b-instant.
# This uses the gpt-oss large->smaller pair, both currently listed by
# `GET https://api.groq.com/openai/v1/models`. Swap these two constants for the
# llama pair (or any pair your Groq account exposes) if you prefer.
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
PRIMARY_MODEL = "openai/gpt-oss-120b"
FALLBACK_MODEL = "openai/gpt-oss-20b"

FALLBACK_ANSWER = (
    "I can only answer based on this borrower's recorded factors, and couldn't "
    "generate a grounded response — please rephrase the question."
)


@lru_cache(maxsize=1)
def _client() -> OpenAI:
    """Lazily construct the client so importing this module (e.g. in tests that
    mock the call) doesn't require an API key."""
    return OpenAI(
        api_key=os.environ["GROQ_API_KEY"],
        base_url=GROQ_BASE_URL,
    )


def _call_model(system: str, user_message: str, model: str, json_mode: bool = True) -> str:
    """One chat completion against a specific model. Raises on API errors
    (including ``RateLimitError`` for HTTP 429)."""
    kwargs = {}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = _client().chat.completions.create(
        model=model,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ],
        **kwargs,
    )
    return (response.choices[0].message.content or "").strip()


def _complete(system: str, user_message: str, json_mode: bool = True) -> tuple[str, str]:
    """Try PRIMARY_MODEL; on RateLimitError (429) fall back to FALLBACK_MODEL.

    Returns ``(text, model_used)``. Any non-429 error, or a 429 on the fallback
    model too, propagates to the caller.
    """
    try:
        return _call_model(system, user_message, PRIMARY_MODEL, json_mode), PRIMARY_MODEL
    except RateLimitError:
        logger.warning(
            "Primary model %s rate-limited (HTTP 429); falling back to %s",
            PRIMARY_MODEL,
            FALLBACK_MODEL,
        )
        return _call_model(system, user_message, FALLBACK_MODEL, json_mode), FALLBACK_MODEL


def _parse_json_object(text: str) -> dict | None:
    """Best-effort parse of a single JSON object out of the model's reply."""
    text = text.strip()
    # Strip ```json ... ``` fences if the model added them.
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    else:
        brace = re.search(r"\{.*\}", text, re.DOTALL)
        if brace:
            text = brace.group(0)
    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _valid_explanation(parsed: dict | None, valid_factor_names: set[str]) -> dict | None:
    """Return a cleaned {answer, cited_factors} dict, or None if invalid.

    Invalid = not a dict, missing keys, empty answer, or no cited factor that
    actually belongs to this borrower. (Provider-independent — unchanged by the
    Groq migration.)
    """
    if not parsed:
        return None
    answer = parsed.get("answer")
    cited = parsed.get("cited_factors")
    if not isinstance(answer, str) or not answer.strip():
        return None
    if not isinstance(cited, list):
        return None
    cleaned = [c for c in cited if isinstance(c, str) and c in valid_factor_names]
    if not cleaned:
        return None
    return {"answer": answer.strip(), "cited_factors": cleaned}


def explain(borrower: dict, question: str) -> dict:
    """Return {"answer", "cited_factors", "was_fallback", "model_used"}.

    Sends ONLY this borrower's factor data. Retries once with a stricter prompt
    if the first reply isn't valid grounded JSON; falls back to a safe template
    if the retry also fails or the API errors out. ``model_used`` is whichever
    Groq model served the last response we got (or None if no call succeeded).
    """
    valid_names = {f["name"] for f in borrower.get("factors", [])}
    user_message = prompts.build_explain_user_message(borrower, question)

    attempts = [
        prompts.EXPLAIN_SYSTEM_PROMPT,
        prompts.EXPLAIN_SYSTEM_PROMPT + prompts.EXPLAIN_RETRY_SUFFIX,
    ]
    model_used: str | None = None
    for system in attempts:
        try:
            text, model_used = _complete(system, user_message, json_mode=True)
        except Exception:
            # Network/API failure (incl. 429 on the fallback model too) —
            # don't leak an unsourced answer.
            break
        result = _valid_explanation(_parse_json_object(text), valid_names)
        if result:
            result["was_fallback"] = False
            result["model_used"] = model_used
            return result

    return {
        "answer": FALLBACK_ANSWER,
        "cited_factors": [],
        "was_fallback": True,
        "model_used": model_used,
    }


def phrase_whatif(
    borrower: dict,
    overrides: dict,
    old_score: int,
    new_score: int,
    old_decision: str,
    new_decision: str,
) -> str:
    """One model call purely to phrase an already-computed score change.

    Falls back to a deterministic sentence if the API errors out.
    """
    user_message = prompts.build_whatif_user_message(
        borrower, overrides, old_score, new_score, old_decision, new_decision
    )
    try:
        text, _ = _complete(prompts.WHATIF_SYSTEM_PROMPT, user_message, json_mode=False)
        if text:
            return text
    except Exception:
        pass

    changed = ", ".join(f"{k} to {v}" for k, v in overrides.items()) or "these factors"
    direction = "raising" if new_score >= old_score else "lowering"
    decision_note = (
        f" and moves the decision from '{old_decision}' to '{new_decision}'"
        if new_decision != old_decision
        else ""
    )
    return (
        f"Adjusting {changed} changes the score from {old_score} to {new_score} "
        f"({direction} it by {abs(new_score - old_score)} points){decision_note}."
    )
