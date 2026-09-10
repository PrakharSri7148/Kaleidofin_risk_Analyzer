"""Unit tests for the deterministic scoring engine."""
from app.scoring import compute_score, decide

# A canonical factor set: weights sum to 1.0, three positive / two negative.
BASE_FACTORS = [
    {"name": "repayment_history", "value": 0.5, "weight": 0.35, "direction": "positive"},
    {"name": "income_stability", "value": 0.5, "weight": 0.25, "direction": "positive"},
    {"name": "utility_payment_consistency", "value": 0.5, "weight": 0.15, "direction": "positive"},
    {"name": "existing_debt_ratio", "value": 0.5, "weight": 0.15, "direction": "negative"},
    {"name": "sector_risk_multiplier", "value": 0.5, "weight": 0.10, "direction": "negative"},
]


def _with(name, value):
    return [
        {**f, "value": value} if f["name"] == name else f for f in BASE_FACTORS
    ]


def test_high_scoring_profile_is_approved():
    factors = [
        {**f, "value": 1.0 if f["direction"] == "positive" else 0.0}
        for f in BASE_FACTORS
    ]
    score = compute_score(factors)
    assert score == 100
    assert decide(score) == "approved"


def test_low_scoring_profile_is_rejected():
    factors = [
        {**f, "value": 0.0 if f["direction"] == "positive" else 1.0}
        for f in BASE_FACTORS
    ]
    score = compute_score(factors)
    assert score == 0
    assert decide(score) == "rejected"


def test_neutral_profile_lands_mid_scale():
    score = compute_score(BASE_FACTORS)
    assert score == 50
    assert decide(score) == "review"


def test_raising_a_positive_factor_raises_the_score():
    low = compute_score(_with("repayment_history", 0.2))
    high = compute_score(_with("repayment_history", 0.9))
    assert high > low


def test_raising_a_negative_factor_lowers_the_score():
    low_debt = compute_score(_with("existing_debt_ratio", 0.1))
    high_debt = compute_score(_with("existing_debt_ratio", 0.9))
    assert high_debt < low_debt


def test_overrides_match_editing_the_factor_list():
    via_override = compute_score(BASE_FACTORS, overrides={"repayment_history": 0.9})
    via_edit = compute_score(_with("repayment_history", 0.9))
    assert via_override == via_edit


def test_override_values_are_clamped_to_unit_interval():
    clamped_high = compute_score(BASE_FACTORS, overrides={"repayment_history": 5.0})
    exactly_one = compute_score(BASE_FACTORS, overrides={"repayment_history": 1.0})
    assert clamped_high == exactly_one


def test_score_always_within_0_100():
    weird = [
        {"name": "a", "value": 1.0, "weight": 5.0, "direction": "positive"},
        {"name": "b", "value": 1.0, "weight": 3.0, "direction": "negative"},
    ]
    assert 0 <= compute_score(weird) <= 100
    assert 0 <= compute_score(weird, overrides={"b": 0.0}) <= 100


def test_empty_factor_set_scores_50():
    assert compute_score([]) == 50


def test_decision_thresholds_exact_boundaries():
    assert decide(39) == "rejected"
    assert decide(40) == "review"
    assert decide(70) == "review"
    assert decide(71) == "approved"
