"""Generate the mock borrowers into the DB.

Run as a module::

    python -m app.seed_data

It drops and recreates the borrower table each run so the demo always starts
from a known state. The audit log is left untouched.

Every borrower uses the same five factors (same weights, same directions); only
the per-factor *values* vary, tuned per sector so the demo has a spread across
all three decision bands. Scores/decisions are NOT stored — they are computed
deterministically by ``scoring.py`` whenever a borrower is read.
"""
from __future__ import annotations

from .db import Base, SessionLocal, engine, init_db
from .models import Borrower
from .scoring import compute_score, decide

# name -> (weight, direction, description). Weights sum to 1.0.
FACTOR_META = {
    "repayment_history": (0.35, "positive", "Past loan repayment consistency"),
    "income_stability": (0.25, "positive", "Steadiness of monthly cash flow"),
    "utility_payment_consistency": (0.15, "positive", "On-time electricity/water bill payments"),
    "existing_debt_ratio": (0.15, "negative", "Existing debt vs. income"),
    "sector_risk_multiplier": (0.10, "negative", "Seasonal / structural risk for this sector"),
}

# id, name, sector, {factor_name: value}
BORROWER_VALUES = [
    ("B1042", "Anita R.", "dairy", {
        "repayment_history": 0.72, "income_stability": 0.45,
        "utility_payment_consistency": 0.80, "existing_debt_ratio": 0.55,
        "sector_risk_multiplier": 0.62,
    }),
    ("B2091", "Farhan K.", "agri", {
        "repayment_history": 0.30, "income_stability": 0.28,
        "utility_payment_consistency": 0.40, "existing_debt_ratio": 0.78,
        "sector_risk_multiplier": 0.80,
    }),
    ("B3310", "Meena L.", "women-led micro-business", {
        "repayment_history": 0.88, "income_stability": 0.75,
        "utility_payment_consistency": 0.90, "existing_debt_ratio": 0.20,
        "sector_risk_multiplier": 0.15,
    }),
    ("B4127", "Ravi T.", "nano-retail", {
        "repayment_history": 0.60, "income_stability": 0.55,
        "utility_payment_consistency": 0.65, "existing_debt_ratio": 0.45,
        "sector_risk_multiplier": 0.10,
    }),
    ("B5202", "Sunita D.", "women-led micro-business", {
        "repayment_history": 0.40, "income_stability": 0.35,
        "utility_payment_consistency": 0.55, "existing_debt_ratio": 0.60,
        "sector_risk_multiplier": 0.30,
    }),
    ("B6318", "Gopal N.", "agri", {
        "repayment_history": 0.82, "income_stability": 0.60,
        "utility_payment_consistency": 0.70, "existing_debt_ratio": 0.30,
        "sector_risk_multiplier": 0.55,
    }),
    ("B7044", "Lakshmi P.", "dairy", {
        "repayment_history": 0.25, "income_stability": 0.30,
        "utility_payment_consistency": 0.35, "existing_debt_ratio": 0.70,
        "sector_risk_multiplier": 0.68,
    }),
    ("B8155", "Imran S.", "nano-retail", {
        "repayment_history": 0.90, "income_stability": 0.82,
        "utility_payment_consistency": 0.85, "existing_debt_ratio": 0.25,
        "sector_risk_multiplier": 0.12,
    }),
]


def build_factor_list(values: dict) -> list[dict]:
    factors = []
    for name, (weight, direction, description) in FACTOR_META.items():
        factors.append({
            "name": name,
            "value": values[name],
            "weight": weight,
            "direction": direction,
            "description": description,
        })
    return factors


def seed_if_empty() -> None:
    """Populate the borrowers table only when it's empty.

    Safe to call on every process start — the API lifespan does, so a fresh
    deploy (new Postgres, empty SQLite) is never served with zero borrowers.
    Unlike ``seed()`` this never drops anything.
    """
    init_db()
    with SessionLocal() as db:
        if db.query(Borrower).first() is not None:
            return
        for bid, name, sector, values in BORROWER_VALUES:
            db.add(Borrower(id=bid, name=name, sector=sector, factors=build_factor_list(values)))
        db.commit()
    print(f"Seeded {len(BORROWER_VALUES)} borrowers (table was empty).")


def seed() -> None:
    init_db()
    # Fresh borrowers every run; keep the audit_entries table as-is.
    Borrower.__table__.drop(bind=engine, checkfirst=True)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        for bid, name, sector, values in BORROWER_VALUES:
            factors = build_factor_list(values)
            db.add(Borrower(id=bid, name=name, sector=sector, factors=factors))
            score = compute_score(factors)
            print(f"  {bid}  {name:<12} {sector:<24} score={score:>3}  {decide(score)}")
        db.commit()
    print(f"Seeded {len(BORROWER_VALUES)} borrowers.")


if __name__ == "__main__":
    seed()
