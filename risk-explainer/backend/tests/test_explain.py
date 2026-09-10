"""Tests for the LLM grounding / fallback logic in ``llm_client.explain``.

Groq (via the OpenAI-compatible client) is never hit here — ``_call_model`` is
monkeypatched. ``_call_model`` now takes ``(system, user_message, model,
json_mode=True)`` and the wrapper ``_complete`` handles PRIMARY -> FALLBACK
model switching on ``RateLimitError``.
"""
import json

import httpx
from openai import RateLimitError

from app import llm_client
from app.llm_client import FALLBACK_MODEL, PRIMARY_MODEL

BORROWER = {
    "id": "B1042",
    "name": "Anita R.",
    "sector": "dairy",
    "score": 60,
    "decision": "review",
    "factors": [
        {"name": "repayment_history", "value": 0.72, "weight": 0.35,
         "direction": "positive", "description": "Past loan repayment consistency"},
        {"name": "sector_risk_multiplier", "value": 0.62, "weight": 0.10,
         "direction": "negative", "description": "Seasonal risk for this sector"},
    ],
}


def _rate_limit_error() -> RateLimitError:
    req = httpx.Request("POST", f"{llm_client.GROQ_BASE_URL}/chat/completions")
    resp = httpx.Response(429, request=req)
    return RateLimitError("rate limit exceeded", response=resp, body=None)


def _patch_responses(monkeypatch, responses):
    """Feed ``responses`` (strings or Exceptions) to successive ``_call_model``
    calls, regardless of which model is asked for."""
    calls = {"n": 0, "models": []}

    def fake_call_model(system, user_message, model, json_mode=True):
        calls["models"].append(model)
        i = calls["n"]
        calls["n"] += 1
        item = responses[i] if i < len(responses) else responses[-1]
        if isinstance(item, Exception):
            raise item
        return item

    monkeypatch.setattr(llm_client, "_call_model", fake_call_model)
    return calls


def test_valid_grounded_response_passes_through(monkeypatch):
    good = json.dumps({
        "answer": "Anita's repayment_history is strong at 0.72, which supports the score.",
        "cited_factors": ["repayment_history"],
    })
    calls = _patch_responses(monkeypatch, [good])

    result = llm_client.explain(BORROWER, "Why this score?")

    assert result["was_fallback"] is False
    assert result["cited_factors"] == ["repayment_history"]
    assert result["model_used"] == PRIMARY_MODEL
    assert calls["n"] == 1  # no retry, no model fallback


def test_rate_limited_primary_retries_on_fallback_model(monkeypatch):
    """429 on PRIMARY_MODEL -> same request re-run on FALLBACK_MODEL."""
    good = json.dumps({
        "answer": "sector_risk_multiplier at 0.62 signals seasonal risk, pulling the score down.",
        "cited_factors": ["sector_risk_multiplier"],
    })

    def fake_call_model(system, user_message, model, json_mode=True):
        if model == PRIMARY_MODEL:
            raise _rate_limit_error()
        assert model == FALLBACK_MODEL
        return good

    monkeypatch.setattr(llm_client, "_call_model", fake_call_model)

    result = llm_client.explain(BORROWER, "Why was this borrower flagged?")

    assert result["was_fallback"] is False
    assert result["cited_factors"] == ["sector_risk_multiplier"]
    assert result["model_used"] == FALLBACK_MODEL


def test_rate_limited_on_both_models_falls_back_to_template(monkeypatch):
    def always_429(system, user_message, model, json_mode=True):
        raise _rate_limit_error()

    monkeypatch.setattr(llm_client, "_call_model", always_429)

    result = llm_client.explain(BORROWER, "Why flagged?")

    assert result["was_fallback"] is True
    assert result["answer"] == llm_client.FALLBACK_ANSWER
    assert result["model_used"] is None


def test_malformed_json_then_fallback(monkeypatch):
    calls = _patch_responses(monkeypatch, ["not json at all", "still {not] json"])

    result = llm_client.explain(BORROWER, "Why was this borrower flagged?")

    assert result["was_fallback"] is True
    assert result["cited_factors"] == []
    assert result["answer"] == llm_client.FALLBACK_ANSWER
    assert calls["n"] == 2  # tried once, retried once (both on the primary model)
    assert calls["models"] == [PRIMARY_MODEL, PRIMARY_MODEL]


def test_empty_cited_factors_triggers_retry_then_succeeds(monkeypatch):
    bad = json.dumps({"answer": "Something vague.", "cited_factors": []})
    good = json.dumps({
        "answer": "Based on sector_risk_multiplier (0.62), seasonality drags the score down.",
        "cited_factors": ["sector_risk_multiplier"],
    })
    calls = _patch_responses(monkeypatch, [bad, good])

    result = llm_client.explain(BORROWER, "Why flagged?")

    assert result["was_fallback"] is False
    assert result["cited_factors"] == ["sector_risk_multiplier"]
    assert result["model_used"] == PRIMARY_MODEL
    assert calls["n"] == 2


def test_cited_factor_not_belonging_to_borrower_is_rejected(monkeypatch):
    hallucinated = json.dumps({
        "answer": "Their credit_card_utilization is the problem.",
        "cited_factors": ["credit_card_utilization"],
    })
    _patch_responses(monkeypatch, [hallucinated, hallucinated])

    result = llm_client.explain(BORROWER, "Why flagged?")

    assert result["was_fallback"] is True
    assert result["cited_factors"] == []


def test_empty_response_triggers_fallback(monkeypatch):
    _patch_responses(monkeypatch, ["", ""])
    result = llm_client.explain(BORROWER, "Why flagged?")
    assert result["was_fallback"] is True


def test_api_exception_falls_back_without_crashing(monkeypatch):
    _patch_responses(monkeypatch, [RuntimeError("network down")])
    result = llm_client.explain(BORROWER, "Why flagged?")
    assert result["was_fallback"] is True
    assert result["answer"] == llm_client.FALLBACK_ANSWER


def test_response_wrapped_in_code_fence_is_parsed(monkeypatch):
    fenced = (
        "Here you go:\n```json\n"
        + json.dumps({"answer": "repayment_history at 0.72 is solid.",
                      "cited_factors": ["repayment_history"]})
        + "\n```"
    )
    _patch_responses(monkeypatch, [fenced])
    result = llm_client.explain(BORROWER, "Why?")
    assert result["was_fallback"] is False
    assert result["cited_factors"] == ["repayment_history"]


def test_whatif_phrasing_falls_back_to_deterministic_sentence(monkeypatch):
    def boom(system, user_message, model, json_mode=True):
        raise RuntimeError("no api")

    monkeypatch.setattr(llm_client, "_call_model", boom)

    sentence = llm_client.phrase_whatif(
        BORROWER, {"repayment_history": 0.9}, 60, 74, "review", "approved"
    )
    assert "60" in sentence and "74" in sentence
    assert "approved" in sentence


def test_whatif_phrasing_retries_on_fallback_model(monkeypatch):
    def fake_call_model(system, user_message, model, json_mode=True):
        if model == PRIMARY_MODEL:
            raise _rate_limit_error()
        return "Raising repayment history moves the score from 60 to 74."

    monkeypatch.setattr(llm_client, "_call_model", fake_call_model)

    sentence = llm_client.phrase_whatif(
        BORROWER, {"repayment_history": 0.9}, 60, 74, "review", "approved"
    )
    assert "74" in sentence
