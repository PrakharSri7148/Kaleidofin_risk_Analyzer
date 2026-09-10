# One image: build the React app, then serve it + the API from FastAPI.
# Build context is risk-explainer/ (see render.yaml / .dockerignore).

# ---- stage 1: build the frontend ---------------------------------------
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# VITE_API_BASE is intentionally unset -> the app uses same-origin relative URLs.
RUN npm run build

# ---- stage 2: python runtime -----------------------------------------
FROM python:3.12-slim AS app
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=frontend /fe/dist ./static
ENV FRONTEND_DIST=/app/static
# Render provides $PORT; default to 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
