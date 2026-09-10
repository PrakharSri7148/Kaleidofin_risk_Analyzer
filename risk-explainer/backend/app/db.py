"""Database engine/session setup.

Kept intentionally minimal. Swapping SQLite for Postgres later only requires
changing DATABASE_URL (e.g. postgresql+psycopg://user:pass@host/db) and dropping
the SQLite-specific connect_args below.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./risk_explainer.db")

# Managed Postgres providers (Render, Railway, Heroku, Fly) hand out URLs like
# "postgres://..." or "postgresql://..."; point SQLAlchemy at the psycopg v3
# driver so no separate DB config is needed on the host.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL.split("://", 1)[1]
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL.split("://", 1)[1]

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables. Import models first so they register on Base.metadata."""
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _lightweight_migrations()


def _lightweight_migrations():
    """Tiny additive migrations for demo DBs created before a column existed.

    Only handles ADD COLUMN — enough to carry an existing audit log across the
    Groq migration (new `model_used` column) without a real migration tool.
    """
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "audit_entries" not in insp.get_table_names():
        return
    columns = {c["name"] for c in insp.get_columns("audit_entries")}
    if "model_used" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE audit_entries ADD COLUMN model_used VARCHAR"))
