"""Investment Intelligence service: source-backed assumptions, deterministic results, memo,
and approval routed by the approval-policy source.

The analysis is a Case (access, revision, audit, Guard context). Values come only from
stored, authorized chunks; conflicting values stay unresolved until a Finance user picks
one with a reason. Calculations use finance_calc; the LLM never performs arithmetic.
"""

from datetime import date
from itertools import count

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from . import finance_calc as calc
from .auth import can_read
from .cases import (
    CALCULATION_INPUTS,
    activity,
    can_access_case,
    context,
    log,
    new_case,
    require_edit,
)
from .guard import CalculationInput, CalculationItem
from .investment_contracts import AnalysisPhase as P
from .investment_extraction import DeterministicExtractor, SourceChunk, resolve
from .knowledge import accessible_document, citation_payload
from .models import (
    Approval,
    Case,
    Document,
    DocumentVersion,
    InvestmentAnalysis,
    WorkflowRun,
    now,
)
from .reliability import digest
from .reliability_contracts import ReliabilityStatus
from .workflow_contracts import ApprovalStatus, CaseCreate, CaseStatus, WorkflowStatus
from .workflow_definitions import INVESTMENT_APPROVAL, INVESTMENT_COMMITTEE, install
from .workflows import start_workflow

extractor = DeterministicExtractor()
ANALYST_ROLES = {"finance"}
MAX_CONTEXT = 30
CALCULATION_KEYS = ["initial_investment", "annual_inflow", "periods", "discount_rate"]
VARIABLES = {
    "investment": "Initial investment",
    "annual_inflow": "Annual net cash inflow",
    "rate": "Discount rate",
}


def require_analyst(user):
    if user.role_id not in ANALYST_ROLES:
        raise HTTPException(403, "Investment Analysis is available to Finance.")


def active_version(document: Document) -> DocumentVersion | None:
    return next(
        (v for v in document.versions if v.status == "active" and v.effective_date <= date.today()),
        None,
    )


def chunks_of(version: DocumentVersion) -> list[SourceChunk]:
    return [SourceChunk(chunk.id, chunk.text) for chunk in version.chunks]


def is_proposal(document: Document, version: DocumentVersion | None) -> bool:
    # A proposal states its own initial investment; quotations and projections support it.
    return bool(
        version
        and document.domain == "Finance"
        and any(
            item.origin == "proposal" and item.key == "initial_investment"
            for chunk in chunks_of(version)
            for item in extractor.extract(chunk)
        )
    )


def ref(document: Document, version: DocumentVersion) -> dict:
    return {"document_id": document.id, "title": document.title, "version": version.version}


def related_sources(db, user, proposal: Document) -> list[tuple[Document, DocumentVersion]]:
    result = []
    for document_id in proposal.related_document_ids:
        document = db.get(Document, document_id)
        # Restricted related sources are skipped silently; nothing about them is returned.
        if document and can_read(user, document) and (version := active_version(document)):
            result.append((document, version))
    return result


def open_analysis_for(db, user, version_id) -> InvestmentAnalysis | None:
    for analysis in db.scalars(
        select(InvestmentAnalysis).where(InvestmentAnalysis.proposal_version_id == version_id)
    ):
        case = db.get(Case, analysis.case_id)
        if case.status not in {CaseStatus.COMPLETED, CaseStatus.CANCELLED} and can_access_case(
            db, user, case
        ):
            return analysis
    return None


def proposal_sources(db, user) -> list[dict]:
    require_analyst(user)
    result = []
    for document in db.scalars(
        select(Document).where(Document.context_run_id.is_(None)).order_by(Document.title)
    ):
        # Authorize before reading any version or chunk text.
        if not can_read(user, document):
            continue
        version = active_version(document)
        if not is_proposal(document, version):
            continue
        existing = open_analysis_for(db, user, version.id)
        result.append(
            {
                "document_id": document.id,
                "title": document.title,
                "version": version.version,
                "effective_date": version.effective_date,
                "related": [ref(d, v) for d, v in related_sources(db, user, document)],
                "open_analysis_id": existing.case_id if existing else None,
            }
        )
    return result


def create_analysis(db, user, value) -> tuple[Case, bool]:
    require_analyst(user)
    proposal = accessible_document(db, user, value.proposal_document_id)
    version = active_version(proposal)
    if not is_proposal(proposal, version):
        raise HTTPException(422, "Select a current investment proposal.")
    existing = open_analysis_for(db, user, version.id)
    if existing:
        return db.get(Case, existing.case_id), False
    if value.supporting_document_ids is None:
        supporting = related_sources(db, user, proposal)
    else:
        supporting = []
        for document_id in dict.fromkeys(value.supporting_document_ids):
            if document_id == proposal.id:
                continue
            document = accessible_document(db, user, document_id)
            if (active := active_version(document)) is None:
                raise HTTPException(422, f"{document.title} has no current version.")
            supporting.append((document, active))
    versions = [version] + [item for _, item in supporting]
    chunk_ids = [chunk.id for item in versions for chunk in item.chunks]
    if len(chunk_ids) > MAX_CONTEXT:
        raise HTTPException(422, "Select fewer supporting sources (30-section context limit).")
    assumptions = [
        found.as_dict()
        for item in versions
        for chunk in chunks_of(item)
        for found in extractor.extract(chunk)
    ]
    case = new_case(
        db,
        user,
        CaseCreate(
            title=f"{proposal.title} — investment analysis"[:200],
            description="Source-backed assumptions, deterministic results and a draft memo "
            "for the investment approval decision.",
            type="investment",
            chunk_ids=chunk_ids,
        ),
    )
    case.status = CaseStatus.IN_PROGRESS
    db.add(
        InvestmentAnalysis(
            case_id=case.id,
            proposal_document_id=proposal.id,
            proposal_version_id=version.id,
            supporting=[{"document_id": d.id, "version_id": v.id} for d, v in supporting],
            extractor=extractor.name,
            assumptions=assumptions,
            selections={},
        )
    )
    db.flush()
    inputs = resolve(assumptions, {})
    log(
        db,
        user,
        case,
        "investment_analysis_started",
        proposal_document_id=proposal.id,
        proposal_version_id=version.id,
        supporting_document_ids=[d.id for d, _ in supporting],
        extractor=extractor.name,
        assumption_count=len(assumptions),
        conflict_count=sum(item["status"] == "conflict" for item in inputs),
        missing_count=sum(item["status"] == "missing" for item in inputs),
    )
    return case, True


def get_analysis(db, case) -> InvestmentAnalysis:
    analysis = db.get(InvestmentAnalysis, case.id)
    if analysis is None:
        raise HTTPException(404, "Investment analysis not found.")
    return analysis


def calculation_inputs(inputs) -> calc.Inputs | None:
    values = {item["key"]: item["value"] for item in inputs}
    if any(values.get(key) is None for key in CALCULATION_KEYS):
        return None
    return calc.Inputs(
        investment=values["initial_investment"],
        annual_inflow=values["annual_inflow"],
        periods=int(values["periods"]),
        rate=values["discount_rate"] / 100,
    )


def idr(value: float) -> str:
    return f"IDR {value:,.0f}"


def calculation_view(inputs: calc.Inputs) -> dict:
    result = calc.metrics(inputs)
    rate = f"{inputs.rate * 100:g}%"
    term = f"{inputs.periods} annual periods"
    return {
        "investment": inputs.investment,
        "annual_inflow": inputs.annual_inflow,
        "periods": inputs.periods,
        "discount_rate": inputs.rate * 100,
        "cash_flows": result["cash_flows"],
        "metrics": [
            {
                "key": "npv",
                "label": "Net present value",
                "value": result["npv"],
                "unit": "IDR",
                "period": f"{term}, discounted at {rate}",
                "formula": "NPV = Σ CFₜ ÷ (1 + r)ᵗ for t = 0…n",
                "note": "Positive when discounted inflows exceed the investment at this rate.",
            },
            {
                "key": "irr",
                "label": "Internal rate of return",
                "value": None if result["irr"] is None else round(result["irr"] * 100, 2),
                "unit": "percent",
                "period": "per year",
                "formula": "Rate r at which NPV = 0 (bisection)",
                "note": "Undefined when cash flows never change sign."
                if result["irr"] is None
                else f"Compare with the {rate} discount rate.",
            },
            {
                "key": "roi",
                "label": "Return on investment",
                "value": round(result["roi"] * 100, 2),
                "unit": "percent",
                "period": f"over {term}, undiscounted",
                "formula": "ROI = (Σ inflows − investment) ÷ investment",
                "note": "Ignores the time value of money.",
            },
            {
                "key": "payback_years",
                "label": "Payback period",
                "value": result["payback_years"],
                "unit": "years",
                "period": "undiscounted",
                "formula": "Years until cumulative cash flow ≥ 0, linear within the year",
                "note": "Not reached within the term."
                if result["payback_years"] is None
                else f"Within the {inputs.periods}-year term.",
            },
            {
                "key": "break_even_inflow",
                "label": "Break-even annual inflow",
                "value": result["break_even_inflow"],
                "unit": "IDR per year",
                "period": f"{term} at {rate}",
                "formula": "Investment ÷ [(1 − (1 + r)⁻ⁿ) ÷ r]",
                "note": f"Level inflow for NPV = 0; the assumption is {idr(inputs.annual_inflow)}.",
            },
        ],
        "steps": [step * 100 for step in calc.SENSITIVITY_STEPS],
        "sensitivity": [
            {**row, "label": VARIABLES[row["variable"]]} for row in calc.sensitivity(inputs)
        ],
    }


def approval_route(inputs, cite) -> dict | None:
    values = {item["key"]: item for item in inputs}
    threshold, investment = values["approval_threshold"], values["initial_investment"]
    if threshold["value"] is None or investment["value"] is None:
        return None
    source = next(
        (
            item
            for item in threshold["assumptions"]
            if threshold["selection"] is None
            or item["id"] == threshold["selection"]["assumption_id"]
        ),
        threshold["assumptions"][0],
    )
    within = investment["value"] <= threshold["value"]
    return {
        "threshold": threshold["value"],
        "route": "manager" if within else "committee",
        "label": f"Department manager approval ({idr(investment['value'])} ≤ "
        f"{idr(threshold['value'])})"
        if within
        else f"Investment committee approval ({idr(investment['value'])} > "
        f"{idr(threshold['value'])}; Governance acts as the committee in this demo)",
        "source": cite(source["chunk_id"]),
    }


def draft_memo(proposal: Document, version, inputs, calculation, route, titles) -> str:
    lines = [
        f"Investment memo — draft for human review: {proposal.title} (v{version.version}).",
        "Purpose: assess source-backed assumptions and deterministic results before the "
        "approval decision. All figures are synthetic and illustrative.",
        "",
        "Assumptions",
    ]
    for item in inputs:
        # One entry per source and value; a projection repeats the same yearly inflow.
        sources = "; ".join(
            dict.fromkeys(
                f"{titles[a['chunk_id']]}: {format_value(a['value'], a['unit'])}"
                for a in item["assumptions"]
            )
        )
        if item["status"] == "missing":
            lines.append(f"- {item['label']}: missing from the selected sources.")
        elif item["status"] == "conflict":
            lines.append(f"- {item['label']}: unresolved conflict ({sources}).")
        elif item["status"] == "resolved":
            lines.append(
                f"- {item['label']}: {format_value(item['value'], item['unit'])} selected by "
                f"Finance ({item['selection']['reason']}). Sources: {sources}."
            )
        else:
            lines.append(
                f"- {item['label']}: {format_value(item['value'], item['unit'])} ({sources})."
            )
    lines += ["", "Deterministic results"]
    if calculation:
        for metric in calculation["metrics"]:
            lines.append(f"- {metric['label']}: {metric_text(metric)} ({metric['period']}).")
        for row in calculation["sensitivity"]:
            lines.append(
                f"- Sensitivity, {row['label'].lower()} ±20%: NPV from {idr(min(row['npv']))} "
                f"to {idr(max(row['npv']))}."
            )
    else:
        lines.append("- Not calculated until required inputs are complete and conflicts resolved.")
    lines += ["", "Approval route"]
    limit = next(item["value"] for item in inputs if item["key"] == "approval_threshold")
    if route:
        lines.append(f"- {route['label']}.")
    elif limit is not None:
        lines.append(
            f"- Determined once the initial investment is resolved; the policy limit for "
            f"department manager approval is {idr(limit)}."
        )
    else:
        lines.append("- Approval authority source not available.")
    lines += [
        "",
        "Limitations",
        "- Proposal-level sources are below the approved-authority threshold; reviewer "
        "judgment is required. No commitment may be made before the required approval.",
    ]
    return "\n".join(lines)


def format_value(value, unit) -> str:
    if unit == "IDR":
        return idr(value)
    return f"{value:g}%" if unit == "percent" else f"{value:g} years"


def metric_text(metric) -> str:
    value = metric["value"]
    if value is None:
        return "undefined"
    if metric["unit"].startswith("IDR"):
        return idr(value) + (" per year" if metric["unit"] == "IDR per year" else "")
    return f"{value:g}%" if metric["unit"] == "percent" else f"{value:g} years"


def workflow_of(db, case) -> WorkflowRun | None:
    return db.scalar(select(WorkflowRun).where(WorkflowRun.case_id == case.id))


def phase(case, run, inputs) -> P:
    if case.status == CaseStatus.COMPLETED:
        return P.APPROVED
    if case.status == CaseStatus.CANCELLED:
        return P.CLOSED
    if run:
        if run.status == WorkflowStatus.WAITING_FOR_EVIDENCE:
            return P.INFORMATION_REQUESTED
        return P.IN_APPROVAL
    if any(item["status"] == "missing" for item in inputs):
        return P.MISSING_INFORMATION
    if any(item["status"] == "conflict" for item in inputs):
        return P.CONFLICTS
    return P.READY_TO_SUBMIT


def calculation_input(db, case) -> CalculationInput | None:
    """Registered Guard resolver: each required input must be present and unambiguous."""
    analysis = db.get(InvestmentAnalysis, case.id)
    if analysis is None:
        return None
    statuses = {
        "consistent": "available",
        "resolved": "available",
        "conflict": "conflicting",
        "missing": "missing",
    }
    items = []
    for item in resolve(analysis.assumptions, analysis.selections):
        values = ", ".join(format_value(a["value"], a["unit"]) for a in item["assumptions"])
        if item["status"] == "consistent":
            details = f"Sources agree: {values}."
        elif item["status"] == "resolved":
            chosen = format_value(item["value"], item["unit"])
            details = f"Sources differ ({values}); Finance selected {chosen}."
        elif item["status"] == "conflict":
            details = f"Sources differ: {values}. Select the value to use."
        else:
            details = "No selected source states this input."
        items.append(
            CalculationItem(
                key=item["key"],
                label=item["label"],
                status=statuses[item["status"]],
                chunk_ids=tuple(a["chunk_id"] for a in item["assumptions"]),
                details=details,
            )
        )
    ready = all(item.status == "available" for item in items)
    return CalculationInput(
        items=tuple(items),
        details="All inputs are source-backed and unambiguous; results use deterministic formulas."
        if ready
        else "Calculation waits for missing or conflicting inputs.",
    )


CALCULATION_INPUTS["investment"] = calculation_input


def summary(db, case, analysis, inputs=None) -> dict:
    inputs = resolve(analysis.assumptions, analysis.selections) if inputs is None else inputs
    run = workflow_of(db, case)
    proposal = db.get(Document, analysis.proposal_document_id)
    version = db.get(DocumentVersion, analysis.proposal_version_id)
    if analysis.submitted:
        npv = analysis.submitted["calculation"]["metrics"][0]["value"]
    else:
        live = calculation_inputs(inputs)
        npv = calc.metrics(live)["npv"] if live else None
    return {
        "id": case.id,
        "title": case.title,
        "proposal_document_id": proposal.id,
        "proposal_title": proposal.title,
        "proposal_version": version.version,
        "phase": phase(case, run, inputs),
        "status": case.status,
        "workflow_status": run.status if run else None,
        "created_by": case.created_by,
        "revision": case.revision,
        "created_at": case.created_at,
        "updated_at": case.updated_at,
        "conflict_count": sum(item["status"] == "conflict" for item in inputs),
        "missing_count": sum(item["status"] == "missing" for item in inputs),
        "npv": npv,
    }


def list_analyses(db, user) -> list[dict]:
    result = []
    for analysis in db.scalars(
        select(InvestmentAnalysis).order_by(InvestmentAnalysis.created_at.desc())
    ):
        case = db.get(Case, analysis.case_id)
        if can_access_case(db, user, case):
            result.append(summary(db, case, analysis))
    return result


def can_prepare(user, case) -> bool:
    return (
        user.role_id in ANALYST_ROLES
        and user.id in {case.owner_id, case.created_by}
        and case.status not in {CaseStatus.COMPLETED, CaseStatus.CANCELLED}
    )


def analysis_view(db, user, case) -> dict:
    analysis = get_analysis(db, case)
    guard, _ = context(db, user, case)
    restricted = guard.status == ReliabilityStatus.ACCESS_RESTRICTED
    numbers = count(1)
    cited: dict[str, dict] = {}

    def cite(chunk_id):
        # Re-authorizes the actor for every chunk; never returns cached source text.
        if chunk_id not in cited:
            cited[chunk_id] = citation_payload(db, user, chunk_id, next(numbers))
        return cited[chunk_id]

    inputs = resolve(analysis.assumptions, analysis.selections)
    proposal = db.get(Document, analysis.proposal_document_id)
    version = db.get(DocumentVersion, analysis.proposal_version_id)
    base = summary(db, case, analysis, inputs)
    run = workflow_of(db, case)
    live = calculation_inputs(inputs)
    route = None if restricted else approval_route(inputs, cite)
    if analysis.submitted:
        calculation, memo = analysis.submitted["calculation"], analysis.submitted["memo"]
    else:
        calculation = calculation_view(live) if live else None
        titles = {a["chunk_id"]: cite(a["chunk_id"])["title"] for a in analysis.assumptions}
        memo = analysis.memo or draft_memo(proposal, version, inputs, calculation, route, titles)
    pending = db.scalar(
        select(Approval).where(
            Approval.case_id == case.id, Approval.status == ApprovalStatus.PENDING
        )
    )
    actions = []
    if can_prepare(user, case) and not run and not restricted:
        if any(len({a["value"] for a in item["assumptions"]}) > 1 for item in inputs):
            actions.append("select")
        actions.append("edit_memo")
        if base["phase"] == P.READY_TO_SUBMIT and guard.status in {
            ReliabilityStatus.VERIFIED,
            ReliabilityStatus.REVIEW_REQUIRED,
        }:
            actions.append("submit")
    if can_prepare(user, case) and base["phase"] == P.INFORMATION_REQUESTED:
        actions.append("provide_information")
    supporting = []
    for item in analysis.supporting:
        document = db.get(Document, item["document_id"])
        if can_read(user, document):
            supporting.append(ref(document, db.get(DocumentVersion, item["version_id"])))
    return base | {
        "extractor": analysis.extractor,
        "reliability": guard,
        "supporting": [] if restricted else supporting,
        "inputs": []
        if restricted
        else [
            item
            | {
                "assumptions": [
                    {key: a[key] for key in ["id", "key", "label", "value", "unit", "period"]}
                    | {"quote": a["quote"], "source": cite(a["chunk_id"])}
                    for a in item["assumptions"]
                ]
            }
            for item in inputs
        ],
        "calculation": None if restricted else calculation,
        "approval_route": route,
        "memo": "" if restricted else memo,
        "memo_edited": analysis.memo is not None,
        "submitted_at": analysis.submitted_at,
        "reviewer_id": pending.requested_from if pending else None,
        "activity": activity(db, case),
        "allowed_actions": actions,
    }


def require_preparer(db, user, case) -> InvestmentAnalysis:
    require_analyst(user)
    require_edit(user, case)
    return get_analysis(db, case)


def require_unsubmitted(db, case):
    if workflow_of(db, case):
        raise HTTPException(409, "The analysis was submitted; its inputs are locked.")


def select_assumption(db, user, case, analysis, value):
    require_unsubmitted(db, case)
    if not value.reason:
        raise HTTPException(422, "Record why this source value should be used.")
    chosen = next((a for a in analysis.assumptions if a["id"] == value.assumption_id), None)
    if chosen is None:
        raise HTTPException(404, "Assumption not found.")
    group = {a["value"] for a in analysis.assumptions if a["key"] == chosen["key"]}
    if len(group) < 2:
        raise HTTPException(422, "Sources agree on this input; no selection is needed.")
    analysis.selections = {
        **analysis.selections,
        chosen["key"]: {
            "assumption_id": chosen["id"],
            "reason": value.reason,
            "selected_by": user.id,
            "selected_at": now().isoformat(),
        },
    }
    flag_modified(analysis, "selections")
    log(
        db,
        user,
        case,
        "assumption_selected",
        key=chosen["key"],
        assumption_id=chosen["id"],
        value=chosen["value"],
        reason=value.reason,
    )


def update_memo(db, user, case, analysis, value):
    require_unsubmitted(db, case)
    analysis.memo = value.memo
    log(db, user, case, "memo_updated", memo_digest=digest(value.memo), length=len(value.memo))


def submit_analysis(db, user, case, analysis):
    require_unsubmitted(db, case)
    view = analysis_view(db, user, case)
    if "submit" not in view["allowed_actions"]:
        raise HTTPException(
            409,
            "Resolve conflicts and complete the required inputs, including the approval "
            "authority source, before submitting.",
        )
    route = view["approval_route"]
    if route is None:
        raise HTTPException(409, "An approval authority source is required before submitting.")
    definition = INVESTMENT_APPROVAL if route["route"] == "manager" else INVESTMENT_COMMITTEE
    analysis.submitted = {
        "calculation": view["calculation"],
        "memo": view["memo"],
        "route": {key: route[key] for key in ["threshold", "route", "label"]},
        "inputs": {item["key"]: item["value"] for item in view["inputs"]},
    }
    analysis.submitted_at = now()
    start_workflow(db, user, case, install(db, definition))
    log(
        db,
        user,
        case,
        "investment_submitted",
        route=route["route"],
        threshold=route["threshold"],
        investment=analysis.submitted["inputs"]["initial_investment"],
        npv=view["calculation"]["metrics"][0]["value"],
        memo_digest=digest(view["memo"]),
    )
