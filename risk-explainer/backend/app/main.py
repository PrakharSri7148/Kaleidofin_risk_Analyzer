"""FastAPI app + route registration.

Endpoints
---------
GET  /borrowers            -> list of summaries
GET  /borrowers/{id}       -> full record incl. factors, score, decision
POST /explain              -> grounded Q&A (writes an audit row every time)
POST /whatif               -> deterministic rescore + plain-language phrasing
GET  /audit/{borrower_id}  -> audit trail, newest first
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from . import audit, llm_client
from .db import get_db, init_db
from .ratelimit import rate_limit
from .seed_data import seed_if_empty
from .models import (
    AuditRow,
    Borrower,
    BorrowerDetail,
    BorrowerSummary,
    ExplainRequest,
    ExplainResponse,
    WhatIfRequest,
    WhatIfResponse,
)
from .scoring import compute_score, decide

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Ensure a freshly-provisioned database (new deploy) is never served empty.
    seed_if_empty()
    yield


app = FastAPI(title="Conversational Risk Explainer", version="1.0.0", lifespan=lifespan)

# In the deployed build the frontend is served from this same origin, so CORS is
# not needed there. It IS needed for local dev, where Vite (:5173) and this API
# (:8000) are different origins — hence the localhost regex. CORS_ORIGINS can add
# extra origins (e.g. a separately-hosted frontend) if you ever split them out.
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _get_borrower_or_404(db: Session, borrower_id: str) -> Borrower:
    borrower = db.get(Borrower, borrower_id)
    if borrower is None:
        raise HTTPException(status_code=404, detail=f"Borrower {borrower_id} not found")
    return borrower


def _borrower_payload(borrower: Borrower) -> dict:
    """Shape a borrower ORM row into the dict sent to the LLM / frontend,
    with the deterministically computed score + decision attached."""
    score = compute_score(borrower.factors)
    return {
        "id": borrower.id,
        "name": borrower.name,
        "sector": borrower.sector,
        "score": score,
        "decision": decide(score),
        "factors": borrower.factors,
    }


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #
@app.get("/borrowers", response_model=list[BorrowerSummary])
def list_borrowers(db: Session = Depends(get_db)):
    borrowers = db.query(Borrower).order_by(Borrower.id).all()
    out = []
    for b in borrowers:
        score = compute_score(b.factors)
        out.append(
            BorrowerSummary(
                id=b.id, name=b.name, sector=b.sector,
                score=score, decision=decide(score),
            )
        )
    return out


@app.get("/borrowers/{borrower_id}", response_model=BorrowerDetail)
def get_borrower(borrower_id: str, db: Session = Depends(get_db)):
    borrower = _get_borrower_or_404(db, borrower_id)
    return BorrowerDetail(**_borrower_payload(borrower))


@app.post("/explain", response_model=ExplainResponse)
def explain(
    req: ExplainRequest,
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit),
):
    borrower = _get_borrower_or_404(db, req.borrower_id)
    payload = _borrower_payload(borrower)

    result = llm_client.explain(payload, req.question)

    # Every question — grounded or fallback — is logged.
    audit.write_entry(
        db,
        borrower_id=borrower.id,
        question=req.question,
        answer=result["answer"],
        cited_factors=result["cited_factors"],
        was_fallback=result["was_fallback"],
        model_used=result.get("model_used"),
    )
    return ExplainResponse(answer=result["answer"], cited_factors=result["cited_factors"])


@app.post("/whatif", response_model=WhatIfResponse)
def whatif(
    req: WhatIfRequest,
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit),
):
    borrower = _get_borrower_or_404(db, req.borrower_id)

    valid_names = {f["name"] for f in borrower.factors}
    unknown = set(req.factor_overrides) - valid_names
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown factor(s) for this borrower: {sorted(unknown)}",
        )

    old_score = compute_score(borrower.factors)
    new_score = compute_score(borrower.factors, overrides=req.factor_overrides)
    old_decision = decide(old_score)
    new_decision = decide(new_score)

    explanation = llm_client.phrase_whatif(
        _borrower_payload(borrower),
        req.factor_overrides,
        old_score,
        new_score,
        old_decision,
        new_decision,
    )

    return WhatIfResponse(
        old_score=old_score,
        new_score=new_score,
        delta=new_score - old_score,
        new_decision=new_decision,
        explanation=explanation,
    )


@app.get("/audit/{borrower_id}", response_model=list[AuditRow])
def get_audit(borrower_id: str, db: Session = Depends(get_db)):
    return audit.read_entries(db, borrower_id)


@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok"}


# --------------------------------------------------------------------------- #
# Static frontend (combined deployment)
# --------------------------------------------------------------------------- #
# In the Docker image the built React app is copied to $FRONTEND_DIST. When that
# directory exists we serve it from this same service: real files are returned
# as-is, everything else falls through to index.html so client-side routing and
# hard refreshes work. Registered LAST so it never shadows an API route.
_DIST = Path(
    os.getenv(
        "FRONTEND_DIST",
        str(Path(__file__).resolve().parents[2] / "frontend" / "dist"),
    )
).resolve()

if _DIST.is_dir():

    @app.get("/", include_in_schema=False)
    def _spa_root():
        return FileResponse(_DIST / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    def _spa(full_path: str):
        candidate = (_DIST / full_path).resolve()
        if candidate.is_file() and _DIST in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html")
