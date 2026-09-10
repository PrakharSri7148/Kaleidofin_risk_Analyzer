"""SQLAlchemy models + Pydantic schemas.

Factors are stored as a JSON blob on the borrower row. For a demo this keeps the
schema tiny; a production system would likely normalise factors into their own
table. The Pydantic layer is what the API actually speaks.
"""
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy import JSON, Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base

Direction = Literal["positive", "negative"]
Decision = Literal["rejected", "review", "approved"]


# --------------------------------------------------------------------------- #
# SQLAlchemy models
# --------------------------------------------------------------------------- #
class Borrower(Base):
    __tablename__ = "borrowers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sector: Mapped[str] = mapped_column(String, nullable=False)
    # List[dict] of factor definitions; score/decision are derived, not stored.
    factors: Mapped[list] = mapped_column(JSON, nullable=False)


class AuditEntry(Base):
    __tablename__ = "audit_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    borrower_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    question: Mapped[str] = mapped_column(String, nullable=False)
    answer: Mapped[str] = mapped_column(String, nullable=False)
    cited_factors: Mapped[list] = mapped_column(JSON, nullable=False)
    was_fallback: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Which Groq model served the answer ("openai/gpt-oss-120b" /
    # "openai/gpt-oss-20b"), or NULL if no model call succeeded (fallback text).
    model_used: Mapped[str | None] = mapped_column(String, nullable=True)


# --------------------------------------------------------------------------- #
# Pydantic schemas
# --------------------------------------------------------------------------- #
class Factor(BaseModel):
    name: str
    value: float = Field(ge=0.0, le=1.0)
    weight: float = Field(ge=0.0, le=1.0)
    direction: Direction
    description: str


class BorrowerSummary(BaseModel):
    id: str
    name: str
    sector: str
    score: int
    decision: Decision


class BorrowerDetail(BorrowerSummary):
    factors: list[Factor]


class ExplainRequest(BaseModel):
    borrower_id: str
    question: str = Field(min_length=1)


class ExplainResponse(BaseModel):
    answer: str
    cited_factors: list[str]


class WhatIfRequest(BaseModel):
    borrower_id: str
    factor_overrides: dict[str, float]


class WhatIfResponse(BaseModel):
    old_score: int
    new_score: int
    delta: int
    new_decision: Decision
    explanation: str


class AuditRow(BaseModel):
    timestamp: datetime
    question: str
    answer: str
    cited_factors: list[str]
    was_fallback: bool
    model_used: str | None = None
