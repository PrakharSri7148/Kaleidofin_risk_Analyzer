# Deployment

The app is two deployables. **Vercel cannot run the backend** (it's a
long-lived FastAPI process with a SQL database), so:

| Piece | Host | Why |
|---|---|---|
| `frontend/` | Vercel | Static Vite build |
| `backend/` | Render (or Railway / Fly.io) | FastAPI + Postgres |

---

## 1. Backend — Render

A blueprint is committed at [`render.yaml`](./render.yaml).

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → pick the repo. It reads `render.yaml` and
   creates the web service + a free Postgres, wiring `DATABASE_URL` automatically.
3. In the service's **Environment** tab set:
   - `GROQ_API_KEY` — a **fresh** key from <https://console.groq.com/keys>
     (rotate the old one — it was committed earlier and must be considered leaked).
   - `CORS_ORIGINS` — your Vercel URL, e.g. `https://risk-explainer.vercel.app`
     (add the preview domain too if you use one, comma-separated).
4. Deploy. The service auto-creates its tables and seeds the 8 borrowers on
   first boot (`seed_if_empty()` in the lifespan). Health check: open
   `https://<service>.onrender.com/borrowers`.

Optional env: `RATE_LIMIT_MAX_REQUESTS` (default 20), `RATE_LIMIT_WINDOW_SECONDS`
(default 60) — the per-IP limit on `/explain` and `/whatif`.

## 2. Frontend — Vercel

1. Vercel → **Add New → Project** → import the repo.
2. **Root Directory:** `risk-explainer/frontend`.
   Framework preset **Vite** is detected; [`vercel.json`](./frontend/vercel.json)
   supplies the SPA rewrite.
3. **Environment Variables:** add
   `VITE_API_BASE = https://<your-render-service>.onrender.com`
   (Vite inlines this at build time — a build without it calls `localhost:8000`
   and fails; the app logs a console error in that case).
4. Deploy. Then go back to Render and make sure `CORS_ORIGINS` contains the
   final Vercel URL, and redeploy the backend if you changed it.

## 3. Local dev

```bash
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # paste your GROQ_API_KEY
uvicorn app.main:app --reload

# frontend (new shell)
cd frontend && npm install
cp .env.example .env        # VITE_API_BASE=http://localhost:8000
npm run dev
```

## Notes / limitations

- **SQLite is fine for local only.** On a host with an ephemeral or read-only
  filesystem the file DB is lost on restart — always set `DATABASE_URL` to
  Postgres in deployment. `postgres://` / `postgresql://` URLs are normalised to
  the `psycopg` driver automatically.
- **No user auth.** The rate limit is per-worker and in-memory; it slows abuse
  of the shared Groq quota but is not a security boundary. Don't put a
  high-value key behind a widely-shared URL.
- **Branding.** `frontend/assets/logo.jpg` and `name.png` are Kaleidofin marks
  used for a portfolio demo. Replace them (and the "Ask Kaleido" / "Ki-score"
  strings in the UI) before any public, non-portfolio hosting.
