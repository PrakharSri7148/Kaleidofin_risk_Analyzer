"""Audit log read/write.

Every /explain call — grounded or fallback — is recorded here. This is the
feature that turns the chatbot into an auditable compliance tool.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AuditEntry, AuditRow


def write_entry(
    db: Session,
    *,
    borrower_id: str,
    question: str,
    answer: str,
    cited_factors: list[str],
    was_fallback: bool,
    model_used: str | None = None,
) -> AuditEntry:
    entry = AuditEntry(
        borrower_id=borrower_id,
        question=question,
        answer=answer,
        cited_factors=cited_factors,
        was_fallback=was_fallback,
        model_used=model_used,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def read_entries(db: Session, borrower_id: str) -> list[AuditRow]:
    """Return this borrower's audit trail, newest first."""
    rows = db.scalars(
        select(AuditEntry)
        .where(AuditEntry.borrower_id == borrower_id)
        .order_by(AuditEntry.timestamp.desc(), AuditEntry.id.desc())
    ).all()
    return [
        AuditRow(
            timestamp=row.timestamp,
            question=row.question,
            answer=row.answer,
            cited_factors=row.cited_factors,
            was_fallback=row.was_fallback,
            model_used=row.model_used,
        )
        for row in rows
    ]
