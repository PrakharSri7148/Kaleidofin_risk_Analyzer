# Deployment (Render — single service)

One Docker web service serves the built React app **and** the API from the same
URL, plus a managed Postgres. Everything is in the repo-root blueprint,
[`../render.yaml`](../render.yaml).

Because the UI and API share an origin there is **no CORS to configure and no
`VITE_API_BASE` to set** — the frontend calls `/borrowers`, `/explain`, etc.
relative.

| Piece | Where |
|---|---|
| Frontend build (`npm run build` → `dist/`) | stage 1 of [`Dockerfile`](./Dockerfile) |
| FastAPI + static file serving | stage 2 of the Dockerfile; `app/main.py` serves `$FRONTEND_DIST` |
| Data | `risk-explainer-db` (Render Postgres) |

## First deploy

1. Push to GitHub (`PrakharSri7148/Kaleidofin_risk_Analyzer`).
2. Render dashboard → **New → Blueprint** → pick the repo. Render reads
   `render.yaml`, builds the Docker image, and creates the service + Postgres.
3. On **`risk-explainer` → Environment**, set:
   - `GROQ_API_KEY` — a fresh key from <https://console.groq.com/keys>
     (revoke the one committed earlier — it's compromised).
4. Deploy. On first boot the app creates its tables and seeds the 8 borrowers
   (`seed_if_empty()` in the lifespan). Health check is `/healthz`.
5. Open the service URL — the whole app is there.

## Env vars (all optional except the key)

| Var | Set by | Purpose |
|---|---|---|
| `GROQ_API_KEY` | you, in the dashboard | LLM calls; without it `/explain` returns the safe fallback |
| `DATABASE_URL` | `render.yaml` (from the Postgres) | `postgres://…` is normalised to the psycopg driver in `app/db.py` |
| `FRONTEND_DIST` | `Dockerfile` (`/app/static`) | where `main.py` looks for the built UI |
| `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | — (defaults 20 / 60) | per-IP limit on `/explain` + `/whatif` |
| `CORS_ORIGINS` | — | only if you later host a frontend on a *different* origin |

## Notes / limitations

- **Free tier sleeps** after ~15 min idle; the container then cold-starts on the
  next request (~30–50s) and the SQLite-free Postgres keeps the data. The UI just
  shows "Preparing response…" longer on that first hit.
- **Render free Postgres is deleted after 30 days.** Fine for a demo; upgrade the
  database (or repoint `DATABASE_URL`) if you need it to stick around.
- **No user auth.** The rate limit is in-memory per worker — it blunts abuse of
  the shared Groq quota, it is not a security boundary.
- **Branding.** `frontend/assets/logo.jpg` + `name.png` are Kaleidofin marks used
  for a portfolio demo. Replace them (and the "Ask Kaleido" / "Ki-score" UI
  strings) before any public, non-portfolio hosting.

## Local dev (no Docker needed)

```bash
# backend
cd risk-explainer/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # paste your GROQ_API_KEY
python -m app.seed_data         # create + seed the SQLite DB
uvicorn app.main:app --reload --port 8000

# frontend (new shell)
cd risk-explainer/frontend
npm install
cp .env.example .env            # VITE_API_BASE=http://localhost:8000
npm run dev                     # http://localhost:5173
```

Locally the two run as separate origins (that's why dev needs `VITE_API_BASE`
and the CORS localhost rule). Keep the uvicorn port in sync with
`frontend/.env`, and restart `npm run dev` after editing that file.

### Optional: run the combined image locally

```bash
cd risk-explainer
docker build -t risk-explainer .
docker run -p 8000:8000 -e GROQ_API_KEY=sk_... risk-explainer
# whole app on http://localhost:8000
```
