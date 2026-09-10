"""Minimal in-process rate limiting — no external dependency.

A fixed-window request counter keyed by client IP. This exists so a public
demo deployment can't have its shared Groq quota drained by anyone who finds
the URL. It is deliberately simple:

- Per worker process (on a multi-process or serverless host each worker keeps
  its own window), so treat the limit as approximate.
- In-memory only; counters reset on restart.

Tune via env: RATE_LIMIT_MAX_REQUESTS (default 20) per
RATE_LIMIT_WINDOW_SECONDS (default 60).
"""
from __future__ import annotations

import os
import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request

_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "20"))
_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

_hits: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


def _client_key(request: Request) -> str:
    """Best-effort caller identity. Behind Vercel/Render the real client IP is
    in X-Forwarded-For; fall back to the socket peer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request) -> None:
    """FastAPI dependency. Raises HTTP 429 once a caller exceeds the window."""
    now = time.monotonic()
    cutoff = now - _WINDOW_SECONDS
    key = _client_key(request)

    with _lock:
        hits = _hits[key]
        hits[:] = [t for t in hits if t > cutoff]
        if len(hits) >= _MAX_REQUESTS:
            retry_after = int(hits[0] + _WINDOW_SECONDS - now) + 1
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Rate limit exceeded: {_MAX_REQUESTS} requests per "
                    f"{_WINDOW_SECONDS}s. Retry in ~{retry_after}s."
                ),
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)
