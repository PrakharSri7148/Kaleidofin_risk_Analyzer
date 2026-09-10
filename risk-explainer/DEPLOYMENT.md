# Deployment (Render)

Everything runs on Render — three resources defined in one blueprint at the
repo root, [`../render.yaml`](../render.yaml):

| Resource | Type | What |
|---|---|---|
| `risk-explainer-api` | Web Service | FastAPI (`risk-explainer/backend`) |
| `risk-explainer-web` | Static Site | Vite build of `risk-explainer/frontend` |
| `risk-explainer-db` | PostgreSQL | data store for the API |

The frontend and backend are separate services (each redeploys on its own) but
they wire themselves together — no URLs to copy by hand:

- `VITE_API_BASE` on the static site is pulled from the API service's hostname
  via `fromService`. `src/api.js` prepends `https://` to the bare host.
- The API allows any `*.onrender.com` origin (see `app/main.py`), so CORS just
  works for the static site with no `CORS_ORIGINS` to set.

## First deploy

1. Push to GitHub (already done: `PrakharSri7148/Kaleidofin_risk_Analyzer`).
2. Render dashboard → **New → Blueprint** → pick the repo. Render reads
   `render.yaml` and creates all three resources.
3. On **`risk-explainer-api` → Environment**, set:
   - `GROQ_API_KEY` — a fresh key from <https://console.groq.com/keys>.
     (The one committed earlier is compromised — revoke it.)
4. Deploy. On first boot the API creates its tables and seeds the 8 borrowers
   (`seed_if_empty()` in the lifespan). Check
   `https://risk-explainer-api.onrender.com/borrowers` returns JSON.
5. Open the static site URL (`https://risk-explainer-web.onrender.com`) — the
   full app should work.

## Optional env (API service)

| Var | Default | Purpose |
|---|---|---|
| `CORS_ORIGINS` | *(none)* | Extra allowed origins, comma-separated. Only needed for a custom domain. |
| `RATE_LIMIT_MAX_REQUESTS` | `20` | Per-IP requests to `/explain` + `/whatif`… |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | …per this window. |

## Notes / limitations

- **Free tier sleeps.** The API service spins down after ~15 min idle; the first
  request then takes 30–50s (the static site does **not** sleep). The frontend
  just shows "Preparing response…" longer on that first call.
- **`DATABASE_URL`** is injected by Render from the Postgres resource.
  `postgres://` / `postgresql://` URLs are normalised to the `psycopg` driver in
  `app/db.py`, so nothing to configure.
- **No user auth.** The rate limit is per-worker, in-memory — it blunts abuse of
  the shared Groq quota, it is not a security boundary.
- **Branding.** `frontend/assets/logo.jpg` + `name.png` are Kaleidofin marks,
  used for a portfolio demo. Replace them (and the "Ask Kaleido" / "Ki-score"
  UI strings) before any public, non-portfolio hosting.

## Local dev

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

Keep the uvicorn port (`8000`) in sync with `frontend/.env`; restart `npm run
dev` after changing that file (Vite reads it once at startup).
