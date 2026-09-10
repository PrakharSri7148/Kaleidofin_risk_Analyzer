# Conversational Risk Explainer

A live-demoable prototype that lets you pick a mock loan borrower, see their
credit-risk score and the factors behind it, then:

1. **Ask plain-language questions** ("Why was this borrower flagged?") and get an
   answer grounded **only** in that borrower's recorded factor data — never
   general knowledge. Every answer must cite at least one real factor or it is
   rejected and replaced with a safe fallback.
2. **Run "what-if" scenarios** — drag sliders for each factor and watch the score
   recompute live (via a deterministic formula, not a model call), with a
   plain-language explanation of the change.
3. **Review an audit log** of every question asked, the answer given, which
   factors were cited, and whether the answer was a fallback.

This is a portfolio/demo project. It has no user auth (only a basic per-IP rate
limit on the LLM endpoints). Deployment config — one Render blueprint for the
API, a static frontend, and Postgres — lives in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

> **Branding note:** the Kaleidofin name and logo (`frontend/assets/`) are used
> here for a role-specific portfolio demo. Remove or replace them before hosting
> this anywhere public.

---

## Architecture at a glance

| Concern | Where | Note |
|---|---|---|
| Scoring | `backend/app/scoring.py` | Pure, deterministic, side-effect-free. Weighted sum of factors → 0–100. |
| LLM grounding | `backend/app/llm_client.py` + `prompts.py` | Groq via the OpenAI-compatible API. Sends only one borrower's factors; requires cited factors; retries once; falls back to a template. |
| Model fallback | `backend/app/llm_client.py` | Tries `openai/gpt-oss-120b`; on HTTP 429 auto-retries the same request on `openai/gpt-oss-20b`. |
| Audit log | `backend/app/audit.py` | Every `/explain` call writes a row (grounded **or** fallback), including `model_used`. |
| Persistence | SQLite via SQLAlchemy (`backend/app/db.py`) | Swap to Postgres by setting `DATABASE_URL` (`postgres://` URLs auto-normalised). Seeds itself if empty on startup. |
| API | FastAPI (`backend/app/main.py`) | CORS origins from `CORS_ORIGINS` (default `localhost:5173`). Per-IP rate limit on `/explain` + `/whatif`. |
| UI | React + Vite + Tailwind (`frontend/`) | Single page, four components. |

### Scoring formula

Each factor contributes `value * weight`, negated when `direction == "negative"`.
The raw sum is bounded by the weights themselves:

```
raw_min = -(sum of negative-direction weights)
raw_max = +(sum of positive-direction weights)
score   = round((raw_sum - raw_min) / (raw_max - raw_min) * 100)   # clamped to [0, 100]
```

So an all-0.5 borrower lands at 50, a perfect borrower at 100, a worst-case
borrower at 0. Decision bands (per spec): `< 40 → rejected`, `40–70 → review`,
`> 70 → approved`.

---

## Prerequisites

- Python 3.11+ (tested through 3.14)
- Node 18+ / npm
- A Groq API key ([console.groq.com/keys](https://console.groq.com/keys) — free,
  no credit card required) — the app runs without one, but `/explain` will
  always return the safe fallback answer instead of a grounded response.

---

## Backend — install, seed, run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env                  # then edit .env and paste your key
# .env contents:
#   GROQ_API_KEY=gsk_...              <- from https://console.groq.com/keys

# Seed the mock borrowers (drops & recreates the borrowers table each run):
python -m app.seed_data

# Run the API:
uvicorn app.main:app --reload
```

The API is now on `http://localhost:8000` (interactive docs at `/docs`).
If port 8000 is taken, run `uvicorn app.main:app --reload --port 8001` and start
the frontend with `VITE_API_BASE=http://localhost:8001 npm run dev`.

### Endpoints

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/borrowers` | GET | — | `[{id, name, sector, score, decision}]` |
| `/borrowers/{id}` | GET | — | full record incl. `factors` |
| `/explain` | POST | `{borrower_id, question}` | `{answer, cited_factors}` (always writes an audit row) |
| `/whatif` | POST | `{borrower_id, factor_overrides: {name: value}}` | `{old_score, new_score, delta, new_decision, explanation}` |
| `/audit/{borrower_id}` | GET | — | `[{timestamp, question, answer, cited_factors, was_fallback}]` newest first |

### Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

- `tests/test_scoring.py` — high/low/neutral profiles, directional sensitivity,
  override equivalence, clamping, decision thresholds.
- `tests/test_explain.py` — malformed / empty / hallucinated-factor LLM
  responses all route to the fallback; a valid response passes through; a 429 on
  the primary model retries on the fallback model and still returns a valid
  answer; the Groq API is mocked (never hit).

---

## Frontend — install and run

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server calls the backend at
`http://localhost:8000` by default (override with `VITE_API_BASE`).

Components (`frontend/src/components/`):

- **BorrowerSelector** — list of borrowers with a red/amber/green decision badge.
- **ChatWindow** — question input + message bubbles; each answer shows
  `FactorChip` tags for its cited factors.
- **WhatIfPanel** — a 0.0–1.0 slider per factor; debounced calls to `/whatif`
  show the new score, delta, decision, and plain-language explanation.
- **AuditLog** — expandable panel of this borrower's `/audit` history, refetched
  after every question.

---

## Demo flow (what to show on a call)

1. **Select a borrower** — e.g. *Farhan K. (B2091)*, an agri borrower who scores
   29 → `rejected`.
2. **Ask "Why was this borrower flagged?"** — the answer names specific factors
   (`repayment_history`, `existing_debt_ratio`, `sector_risk_multiplier`) and
   those appear as chips beneath the answer. Nothing outside the borrower's data
   is used; an answer that cited nothing would have been replaced by the
   fallback message.
3. **Drag a what-if slider** — raise `repayment_history` and lower
   `existing_debt_ratio`; the score jumps live and a sentence explains the move
   ("…raising the score from 29 to X and moving the decision from 'rejected' to
   'review'"). The number comes purely from `scoring.py`; the LLM only phrases
   it.
4. **Open the audit log** — the question you just asked is at the top, with its
   timestamp, the answer, and the cited factors.

If the primary model (`openai/gpt-oss-120b`) is rate-limited, the app
automatically retries on `openai/gpt-oss-20b` — no manual switching needed.
The audit log records which model actually answered (`model_used`).

---

## Seeded borrowers

8 borrowers across dairy, agri, nano-retail, and women-led micro-business, with a
spread across all three decision bands (agri/dairy carry a meaningful
`sector_risk_multiplier`; nano-retail does not). Scores are computed at read
time, never stored, so editing `seed_data.py` values immediately changes the
demo.

## Documented choices / deviations

- **LLM provider is Groq** via the OpenAI-compatible endpoint
  (`https://api.groq.com/openai/v1`), so the code uses the standard `openai`
  SDK, not a Groq-specific one. Primary model `openai/gpt-oss-120b`, automatic
  fallback to `openai/gpt-oss-20b` on HTTP 429. (The migration brief named
  `llama-3.3-70b-versatile` / `llama-3.1-8b-instant`; the gpt-oss large→smaller
  pair is used instead — both are currently listed by
  `GET https://api.groq.com/openai/v1/models`. Change the two constants in
  `llm_client.py` for any pair your account exposes.)
- **Score scaling** normalises against each borrower's own positive/negative
  weight totals (see formula above) rather than a fixed ±1 scale, so the full
  0–100 range and the decision thresholds are actually reachable.
- **`/whatif` rejects unknown factor names** with HTTP 422 rather than silently
  ignoring them.
- **`seed_data.py` drops only the `borrowers` table**, leaving the audit log
  intact across reseeds.
