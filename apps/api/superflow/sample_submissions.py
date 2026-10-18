"""Add isolated sample submissions without resetting or advancing existing work."""

import argparse
import json
from datetime import date

from sqlalchemy import select

from .config import ROOT, settings
from .db import SessionLocal
from .investigation_contracts import ToolName
from .investigations import (
    create_investigation,
    execute_tool,
    submit_investigation,
    update_recommendation,
)
from .investment import analysis_view, create_analysis, get_analysis, submit_analysis, update_memo
from .investment_contracts import AnalysisCreate, MemoUpdate
from .knowledge import add_version
from .models import Case, Document, Investigation, InvestmentAnalysis, User
from .schemas import VersionInput

POLICY_ID = "sample-approval-policy-v1"
INVESTMENTS = (
    ("sample-investment-ops-v1", "Operations automation", 120_000_000, 45_000_000),
    ("sample-investment-security-v1", "Security monitoring upgrade", 350_000_000, 120_000_000),
    ("sample-investment-service-v1", "Customer service tooling", 90_000_000, 32_000_000),
    ("sample-investment-reporting-v1", "Management reporting platform", 240_000_000, 85_000_000),
    ("sample-investment-recovery-v1", "Disaster recovery capacity", 600_000_000, 190_000_000),
    ("sample-investment-archive-v1", "Document archive replacement", 180_000_000, 35_000_000),
)


def sample_document(db, document_id, title, body, related=(), owner_id="finance"):
    if db.get(Document, document_id):
        return
    document = Document(
        id=document_id,
        title=f"[Sample] {title}",
        domain="Finance",
        owner_id=owner_id,
        authority_level=3,
        access_roles=["finance", "manager", "governance"],
        related_document_ids=list(related),
    )
    db.add(document)
    db.flush()
    add_version(
        db,
        document,
        VersionInput(version="1.0", status="active", effective_date=date(2026, 10, 18)),
        f"{document_id}.md",
        (
            f"# [Sample] {title}\n\nSynthetic training example, not a real bank proposal "
            f"or approval policy. Values are illustrative.\n\n## Assumptions\n\n{body}\n"
        ).encode(),
    )


def prepare_samples(db, *, finance_id="finance", analyst_id="compliance", prefix="sample"):
    """One transaction owned by caller; repeat runs preserve decisions and edits."""
    finance, analyst = db.get(User, finance_id), db.get(User, analyst_id)
    if (
        not finance
        or finance.role_id != "finance"
        or not analyst
        or analyst.role_id != "compliance"
    ):
        raise ValueError("Install the base demo users and workflows before adding samples.")
    # Serialize this additive command on PostgreSQL to prevent duplicate submissions.
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy import text

        db.execute(text("SELECT pg_advisory_xact_lock(734632019)"))
    policy_id = POLICY_ID.replace("sample-", prefix + "-", 1)
    sample_document(
        db,
        policy_id,
        "Training investment approval authority",
        "Investments up to IDR 250,000,000 require manager approval. "
        "Above this limit, investment committee approval is required. "
        "Governance represents the committee in this synthetic example.",
        owner_id=finance.id,
    )
    result = []
    for document_id, title, investment, inflow in INVESTMENTS:
        document_id = document_id.replace("sample-", prefix + "-", 1)
        existing = db.scalar(
            select(InvestmentAnalysis).where(InvestmentAnalysis.proposal_document_id == document_id)
        )
        if existing:
            result.append({"type": "investment", "id": existing.case_id, "created": False})
            continue
        sample_document(
            db,
            document_id,
            title,
            f"The proposal estimates an initial investment of IDR {investment:,} "
            f"and annual net cash inflows of IDR {inflow:,} for four years. "
            "The discount rate is 10 percent.",
            related=[policy_id],
            owner_id=finance.id,
        )
        case, _ = create_analysis(db, finance, AnalysisCreate(proposal_document_id=document_id))
        analysis = get_analysis(db, case)
        memo = analysis_view(db, finance, case)["memo"]
        update_memo(
            db,
            finance,
            case,
            analysis,
            MemoUpdate(
                expected_revision=case.revision,
                memo="SAMPLE SUBMISSION — illustrative training data.\n\n" + memo,
            ),
        )
        submit_analysis(db, finance, case, analysis)
        result.append({"type": "investment", "id": case.id, "created": True})
    for scenario, reference in (
        ("complete", "SAMPLE-AML-001"),
        ("conflict", "SAMPLE-AML-002"),
        ("complete", "SAMPLE-AML-003"),
        ("conflict", "SAMPLE-AML-004"),
        ("failed_evidence", "SAMPLE-AML-005"),
        ("failed_evidence", "SAMPLE-AML-006"),
    ):
        reference = reference.replace("SAMPLE", prefix.upper(), 1)
        existing = db.scalar(
            select(Investigation).where(Investigation.alert_reference == reference)
        )
        if existing:
            result.append({"type": "investigation", "id": existing.case_id, "created": False})
            continue
        browser = settings.investigation_provider == "browser"
        if browser:
            intake = json.loads(
                (ROOT / "apps/web/public/samples/investigation-intake.json").read_text()
            )
            intake["alert_reference"] = reference
            intake["subject_reference"] = reference + "-SUBJECT"
            intake["profile"]["customer_name"] = "UAT Sample Subject " + reference
            investigation = create_investigation(db, analyst, intake=intake)
        else:
            investigation = create_investigation(db, analyst, scenario, alert_reference=reference)
        case = db.get(Case, investigation.case_id)
        case.title = f"[Sample] Investigation — {reference}"
        if not browser:
            for tool in (ToolName.WATCHLIST, ToolName.ADVERSE_NEWS):
                execute_tool(db, analyst, case, investigation, tool.value)
        update_recommendation(
            db,
            analyst,
            case,
            investigation,
            notes="Synthetic training submission. Profile and transactions are sample records. "
            + (
                "Public-web screening must be collected; no clear finding is implied."
                if browser
                else "Screening and news are sample adapter evidence, not live records."
            ),
            recommendation=(
                "Request independent checker review of the recorded transaction indicators. "
                + (
                    "Conflicting source-of-funds evidence remains unresolved; request "
                    "clarification before accepting a disposition."
                    if scenario == "conflict"
                    else "Inspect the complete sample evidence and decide whether further "
                    "information is needed."
                )
                + " No account action or regulatory filing is authorized by this sample."
            ),
        )
        if not browser and scenario != "failed_evidence":
            submit_investigation(db, analyst, case, investigation)
        result.append({"type": "investigation", "id": case.id, "created": True})
    db.flush()
    return result


def main():
    parser = argparse.ArgumentParser(description="Add UAT samples without resetting data.")
    parser.add_argument("--finance", default="finance")
    parser.add_argument("--analyst", default="compliance")
    parser.add_argument("--prefix", choices=["sample", "stg"], default="sample")
    args = parser.parse_args()
    with SessionLocal.begin() as db:
        result = prepare_samples(
            db, finance_id=args.finance, analyst_id=args.analyst, prefix=args.prefix
        )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
