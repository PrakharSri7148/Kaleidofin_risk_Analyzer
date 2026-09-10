# Conversational Risk Explainer

A working prototype of a credit-risk assistant for lenders: pick a borrower, see their AI-generated risk score and the factors behind it, ask plain-language questions and get answers **grounded in that borrower's own factor data**, simulate what would change the outcome, and review a full audit trail of every question asked.

Built as a portfolio piece for the Risk & AI team at Kaleidofin — the UI and copy carry Kaleidofin branding intentionally.

## Why this exists

RBI's 2022 Digital Lending Guidelines require lenders to record and disclose the basis of a creditworthiness assessment, issue a Key Fact Statement, and handle borrower disputes. In practice that means someone — a compliance officer, a credit committee, a field agent — eventually has to explain in plain language *why* a model rejected or approved a loan. An AI credit model that only speaks in scores and feature weights makes that hard.

This prototype demonstrates a small stack that closes that gap: deterministic scoring so the number itself is inspectable, an LLM constrained to answer only from the borrower's actual factors, and a persistent audit log of every explanation. Three interactions in one flow:

1. **Assessment** — the score, decision, and factor breakdown rendered as a proper instrument panel (SVG arc gauge + linear meters), not a stack of colored badges.
2. **Simulation** — drag any factor slider and see the score recompute in real time, with a plain-language explanation of the change.
3. **Audit trail** — a chronological ledger of every question asked, the answer, which factors it cited, and which model served the response.

## Architecture

Four backend components, each with one job:

- **Scoring engine** — deterministic, pure Python. Score = weighted sum of factor values (adjusted for direction), normalized to 0–100. This is what makes "what-if" possible and what keeps the whole system auditable.
- **Prompt builder** — packages a single borrower's factor JSON into a system prompt that instructs the model to answer only from that data and to cite specific factor names.
- **LLM client** — Groq API via the OpenAI-compatible endpoint, with automatic model fallback on rate-limit errors.
- **Audit logger** — every question, answer, cited factors, and which model responded is persisted per borrower.

## Tech stack

**Backend:** Python 3.11+, FastAPI, SQLAlchemy, Pydantic v2, SQLite locally / Postgres in deployment, Groq API via the `openai` SDK
**Frontend:** React + Vite + Tailwind CSS v3.4, hand-built SVG arc gauge, Public Sans + IBM Plex Mono
**Deploy:** Single Docker service on Render (Dockerfile at `risk-explainer/Dockerfile` builds the React app and serves it + the API from one origin), free Render Postgres

## Getting started

### Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- A Groq API key from [console.groq.com/keys](https://console.groq.com/keys) (free, no credit card)

### Backend

```bash
cd risk-explainer/backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                 # then edit .env and paste your GROQ_API_KEY
python -m app.seed_data              # creates ./risk_explainer.db and seeds 8 borrowers
uvicorn app.main:app --reload --port 8000
```

Interactive API docs at `http://localhost:8000/docs`.

The seed step is optional — the app auto-seeds an empty database on startup via `seed_if_empty()`. Run `python -m app.seed_data` explicitly only when you want to **reset** the borrowers table (it drops and recreates it; the audit log is left untouched).

Without a valid `GROQ_API_KEY` the app still boots and every endpoint works, but `/explain` will always return the safe fallback answer.

### Frontend

```bash
cd risk-explainer/frontend
npm install
cp .env.example .env                 # contains VITE_API_BASE=http://localhost:8000
npm run dev
```

Opens at `http://localhost:5173`.

The frontend needs the backend running. If you change `.env`, restart `npm run dev` — Vite inlines env values at build time.

Build for production: `npm run build` → outputs to `frontend/dist/`.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GROQ_API_KEY` | For real LLM responses | none | Groq API key. Missing → `/explain` returns the safe fallback answer. |
| `DATABASE_URL` | No | `sqlite:///./risk_explainer.db` | Any SQLAlchemy URL. `postgres://` / `postgresql://` are auto-normalized to the psycopg driver. |
| `CORS_ORIGINS` | No | empty | Comma-separated extra origins. `localhost` / `127.0.0.1` on any port is always allowed. |
| `FRONTEND_DIST` | No | `../frontend/dist` (relative to `app/`) | Directory of the built frontend. If it exists, the API serves the SPA from the same origin; if not, only the API is served. |
| `RATE_LIMIT_MAX_REQUESTS` | No | `20` | Per-IP requests per window on `/explain` and `/whatif`. |
| `RATE_LIMIT_WINDOW_SECONDS` | No | `60` | Rate-limit window size. |
| `PORT` | Docker only | `8000` | Container listen port (Render sets this automatically). |
| `VITE_API_BASE` | Frontend | `http://localhost:8000` (dev) / `""` (prod build) | Where the frontend calls the API. |

## Project structure

```
Kaleidofin_risk_Analyzer/
├── render.yaml                     # Render blueprint: 1 Docker web service + free Postgres
└── risk-explainer/
    ├── Dockerfile                  # multi-stage: build React → serve UI + API from FastAPI
    ├── DEPLOYMENT.md
    ├── backend/
    │   ├── .env.example
    │   ├── pytest.ini
    │   ├── requirements.txt
    │   ├── app/
    │   │   ├── main.py             # FastAPI app, all routes, SPA static serving
    │   │   ├── models.py           # SQLAlchemy models + Pydantic schemas
    │   │   ├── scoring.py          # deterministic 0–100 score + decision bands
    │   │   ├── prompts.py          # system prompts for explain / whatif
    │   │   ├── llm_client.py       # Groq (via openai SDK); primary → fallback switch
    │   │   ├── audit.py            # audit-log read/write
    │   │   ├── db.py               # engine/session, URL normalization, lightweight migrations
    │   │   ├── ratelimit.py        # in-process per-IP fixed-window limiter
    │   │   └── seed_data.py        # 8 mock borrowers
    │   └── tests/                  # 21 unit tests (pytest)
    └── frontend/
        ├── vite.config.js
        ├── tailwind.config.js
        ├── src/
        │   ├── App.jsx             # 3-panel shell, tab routing
        │   ├── api.js              # fetch wrappers
        │   └── components/
        │       ├── ScoreGauge.jsx      # hand-built SVG arc gauge
        │       ├── Meter.jsx           # thin linear factor meter
        │       ├── FactorBreakdown.jsx
        │       ├── ChatWindow.jsx      # "Ask Kaleido" chat card
        │       ├── WhatIfPanel.jsx
        │       ├── AuditLog.jsx
        │       ├── BorrowerSelector.jsx
        │       ├── FactorChip.jsx
        │       └── brand.jsx
        └── assets/                 # Kaleidofin logo, wordmark, reviewer avatar
```

## API reference

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/borrowers` | — | `[{id, name, sector, score, decision}]` |
| GET | `/borrowers/{id}` | — | Above + `factors: [{name, value, weight, direction, description}]` |
| POST | `/explain` | `{borrower_id, question}` | `{answer, cited_factors}` |
| POST | `/whatif` | `{borrower_id, factor_overrides: {name: value}}` | `{old_score, new_score, delta, new_decision, explanation}` |
| GET | `/audit/{borrower_id}` | — | `[{timestamp, question, answer, cited_factors, was_fallback, model_used}]` — newest first |
| GET | `/healthz` | — | `{"status": "ok"}` — hidden from OpenAPI |

`decision` is derived from score: `<40` → `rejected`, `40–70` → `review`, `>70` → `approved`. Scores are never persisted — they're recomputed from factor values on every read, so editing values in `seed_data.py` and reseeding immediately changes the demo.

`/explain` and `/whatif` are rate-limited per IP. `/whatif` returns `422` if an override key isn't one of the borrower's actual factor names (rather than silently ignoring it). `/audit/{id}` returns `[]` (not `404`) for a borrower with no history.

## LLM configuration

Configured in `backend/app/llm_client.py`:

```python
GROQ_BASE_URL  = "https://api.groq.com/openai/v1"
PRIMARY_MODEL  = "openai/gpt-oss-120b"
FALLBACK_MODEL = "openai/gpt-oss-20b"
```

Groq is used through its OpenAI-compatible endpoint with the standard `openai` SDK — no Groq-specific dependency. Swap the two constants for any pair your Groq account exposes.

Two independent retry paths:

1. **Grounding retry** — if the model's first reply isn't valid JSON with at least one factor that actually belongs to the borrower, `/explain` retries on the same model with a stricter prompt suffix.
2. **Model switch** — if the primary model returns HTTP 429 (rate limit), the identical request is re-run against the fallback model.

If both fail — or the response is still ungrounded after retry — `/explain` returns a safe template answer with `was_fallback: true, model_used: null` and still writes an audit row. `/whatif` similarly falls back to a deterministic sentence.

The model that actually served each response is persisted on the audit row and returned by `/audit/{id}` as `model_used`.

## Data model

Every mock borrower has the same five factors; only the values vary:

| Factor | Weight | Direction | Meaning |
|---|---|---|---|
| `repayment_history` | 0.35 | positive | Past loan repayment consistency |
| `income_stability` | 0.25 | positive | Variance in monthly cash flow |
| `utility_payment_consistency` | 0.15 | positive | On-time electricity/water bill payments |
| `existing_debt_ratio` | 0.15 | negative | Existing debt vs. income |
| `sector_risk_multiplier` | 0.10 | negative | Seasonal/structural risk for the borrower's sector |

Eight seeded borrowers span dairy, agri, women-led micro-business, and nano-retail, with a mix across all three decision bands so the demo has range.

## Testing

```bash
cd risk-explainer/backend
source .venv/bin/activate
pytest
```

21 unit tests, all pure — the Groq API is monkeypatched and never hit, no DB or HTTP server is started.

- `tests/test_scoring.py` (10) — the deterministic scoring engine: perfect / worst / mid-range profiles, direction respected, overrides equivalent to editing factors, clamping to `[0, 1]`, empty factor set, exact decision-band boundaries.
- `tests/test_explain.py` (11) — grounding and fallback behavior in `llm_client.explain` and `phrase_whatif`: valid grounded JSON, 429-on-primary retries on the fallback and succeeds, 429-on-both routes to the template, malformed JSON / empty response / hallucinated factor names all route to the template, empty `cited_factors` triggers the prompt retry, ```json``` code-fenced replies parse cleanly.

Not covered: the FastAPI routes themselves (no `TestClient`), audit persistence, DB URL normalization, seeding, rate limiting, and the entire frontend (no frontend test runner is configured).

## Deployment

Single Docker service on Render, defined in the root `render.yaml`. The Dockerfile is multi-stage: `npm ci && npm run build` produces `frontend/dist/`, then a Python stage installs `requirements.txt` and runs `uvicorn app.main:app`. FastAPI serves the built React app and the API from the same origin, so CORS and `VITE_API_BASE` aren't exercised in production.

A free Render Postgres is provisioned alongside the web service and injected via `DATABASE_URL`.

Health check: `/healthz`.

Optional local combined run:

```bash
cd risk-explainer
docker build -t risk-explainer .
docker run -p 8000:8000 -e GROQ_API_KEY=... risk-explainer
```

Full deployment notes, including a note that a Groq key was committed in an early commit and must be treated as revoked, are in `risk-explainer/DEPLOYMENT.md`.

**Render free-tier caveats:** the web service sleeps after ~15 minutes idle (30–50 s cold start on the next request); the free Postgres database is deleted after 30 days.

## Known limitations

This is a demo, not production software. The specific shortcuts:

- **Rate limiting** is in-process, per-worker, fixed-window, in-memory. Counters reset on restart, and it's approximate on multi-worker or serverless hosts. It is not a security boundary.
- **No authentication** anywhere.
- **Factors** are stored as a JSON blob on the borrower row, not normalized into their own table.
- **Scores and decisions** are never persisted — always recomputed from factor values at read time. This is deliberate (it's what makes editing seed data and reseeding just work) but means you can't query historical scores from the DB.
- **Lightweight migrations only.** `db._lightweight_migrations()` hand-rolls a single `ALTER TABLE ... ADD COLUMN model_used` for older demo databases. There's no Alembic or equivalent — anything beyond `ADD COLUMN` isn't handled.
- **Fallback switching** triggers only on HTTP 429 on the primary. A 429 on the fallback, or any 500 / timeout / network error, goes straight to the safe template answer with no exponential backoff.
- **Layout** is a fixed, non-scrolling desktop shell (`body { overflow: hidden }`). It is not designed for mobile viewports.
- **Frontend has no tests** and no test runner is configured in `package.json`.
- **API endpoints have no integration tests** — coverage is unit-level only (scoring engine + LLM client).
- **Kaleidofin branding** (logo, wordmark, reviewer avatar, product strings like "Ask Kaleido" and "Ki-score") and a hardcoded reviewer identity are baked into the UI. Remove these before any public, non-portfolio hosting.

## License

Not currently licensed for distribution. Portfolio / demo use.
