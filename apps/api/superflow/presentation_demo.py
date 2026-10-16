"""Prepare synthetic presentation work inside the reset transaction.

Use domain services so sources, Guard and audit remain real. Human findings,
assumption selections and approvals are deliberately left for the presenter.
"""

from .investment import create_analysis
from .investment_contracts import AnalysisCreate
from .models import User
from .regulatory import create_review
from .regulatory_contracts import ReviewCreate
from .workflow_demo import seed_workflow_demo


def prepare_presentation(db):
    seed_workflow_demo(db, commit=False)
    create_review(db, db.get(User, "compliance"), ReviewCreate(document_id="regulation"))
    create_analysis(db, db.get(User, "finance"), AnalysisCreate(proposal_document_id="proposal-a"))
    db.flush()
