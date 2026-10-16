import pytest
from sqlalchemy import func, select

from superflow.models import (
    Approval,
    Case,
    Investigation,
    InvestmentAnalysis,
    RegulatoryFinding,
    RegulatoryReview,
)
from superflow.presentation_demo import prepare_presentation
from superflow.seed import reset_synthetic


def counts(db):
    return {
        model.__name__: db.scalar(select(func.count()).select_from(model))
        for model in (Case, Approval, Investigation, InvestmentAnalysis, RegulatoryReview)
    }


def test_presentation_reset_is_repeatable_and_leaves_decisions_to_humans(db):
    reset_synthetic(db, presentation=True)
    expected = counts(db)
    assert expected["Case"] == 8  # Three requests, three investigations, review, analysis.
    assert expected["Investigation"] == 3
    assert expected["InvestmentAnalysis"] == expected["RegulatoryReview"] == 1
    assert expected["Approval"] == 0  # The presenter completes tasks/submits for review.
    assert all(f.status == "PROPOSED" for f in db.scalars(select(RegulatoryFinding)))
    assert all(a.status == "PENDING" for a in db.scalars(select(Approval)))
    prepare_presentation(db)
    assert counts(db) == expected
    reset_synthetic(db, presentation=True)
    assert counts(db) == expected


def test_presentation_failure_rolls_back_the_entire_reset(db, monkeypatch):
    import superflow.presentation_demo as demo

    reset_synthetic(db, presentation=True)
    existing_ids = set(db.scalars(select(Case.id)))

    def fail(db):
        db.flush()
        raise RuntimeError("Presentation setup failed")

    monkeypatch.setattr(demo, "prepare_presentation", fail)
    with pytest.raises(RuntimeError, match="Presentation setup failed"):
        reset_synthetic(db, presentation=True)
    assert set(db.scalars(select(Case.id))) == existing_ids
