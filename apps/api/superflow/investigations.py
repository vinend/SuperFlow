"""Bounded synthetic investigation on shared Case, Guard, workflow and audit services."""

import hashlib
import json

import httpx
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select

from .cases import activity, can_access_case, get_case, log, new_case
from .config import settings
from .guard import SuperFlowGuard
from .investigation_contracts import (
    TOOL_RESULT_SCHEMAS,
    AgentAction,
    SyntheticToolRequest,
    ToolName,
)
from .models import (
    Approval,
    CaseEvidence,
    Investigation,
    QuestionRun,
    ToolRun,
    WorkflowDefinition,
    WorkflowRun,
    now,
)
from .reliability import digest, persist_guard_result
from .reliability_contracts import EvidenceItem, GuardResult, ReliabilityStatus
from .workflow_contracts import CaseCreate
from .workflows import start_workflow

TEMPLATE = {
    "id": "synthetic-alert-review-v1",
    "version": "1.0",
    "required": {
        "customer_profile": "Customer profile / CIF context",
        "source_of_funds": "Declared source of funds",
        "transaction_pattern": "Transaction pattern summary",
        "watchlist_screening": "Watchlist screening",
        "adverse_news": "Adverse-news screening",
    },
    "optional": {"supporting_documents": "Supporting documents"},
}
TOOL_EVIDENCE = {
    ToolName.CUSTOMER_PROFILE: ("customer_profile", "source_of_funds"),
    ToolName.TRANSACTIONS: ("transaction_pattern",),
    ToolName.WATCHLIST: ("watchlist_screening",),
    ToolName.ADVERSE_NEWS: ("adverse_news",),
}
MAX_TOOL_ATTEMPTS = 2
MAX_AGENT_STEPS = 8

SCENARIOS = {
    "complete": {"alert": "AML-2026-001", "subject": "SYN-CIF-001", "name": "Rizky Pratama"},
    "failed_evidence": {"alert": "AML-2026-002", "subject": "SYN-CIF-002", "name": "Ayu Lestari"},
    "conflict": {"alert": "AML-2026-003", "subject": "SYN-CIF-003", "name": "Bima Hartono"},
}
TRANSACTIONS = [
    {
        "time": "15 Sep 08:42",
        "type": "Inbound transfer",
        "amount": 98000000,
        "context": "New sender",
    },
    {
        "time": "15 Sep 10:06",
        "type": "Outbound transfer",
        "amount": -74500000,
        "context": "New beneficiary",
    },
    {
        "time": "15 Sep 11:18",
        "type": "Merchant payment",
        "amount": -41000000,
        "context": "Gaming merchant",
    },
    {
        "time": "15 Sep 13:29",
        "type": "Outbound transfer",
        "amount": -82500000,
        "context": "New beneficiary",
    },
    {
        "time": "16 Sep 17:04",
        "type": "Outbound transfer",
        "amount": -67000000,
        "context": "New beneficiary",
    },
]
INDICATORS = [
    "Unusual transaction velocity: 18 transfers in 36 hours",
    "Outbound pattern exceeds the declared monthly baseline",
    "Seven first-seen counterparties",
    "Declared salary does not explain the alerted transfer volume",
]


def triage_priority(indicators: list[str]) -> str:
    """Explicit demo rule, never an AML probability or model output."""
    count = len(indicators)
    return "HIGH" if count >= 3 else "MEDIUM" if count >= 2 else "LOW"


def detect_evidence_conflict(profile: dict, transaction: dict) -> str | None:
    if (
        profile.get("declared_source_of_funds") == "Monthly salary"
        and transaction.get("narrative") == "Business settlement"
    ):
        return (
            "Profile declares salary-only funds; transaction narrative describes "
            "business settlement. Analyst must resolve the mismatch."
        )
    return None


def _fingerprint(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def _rows(db, case_id):
    return list(
        db.scalars(
            select(CaseEvidence).where(CaseEvidence.case_id == case_id).order_by(CaseEvidence.key)
        )
    )


def _attempts(db, case_id, tool=None):
    statement = select(ToolRun).where(ToolRun.investigation_id == case_id)
    if tool:
        statement = statement.where(ToolRun.tool_name == tool)
    return list(
        db.scalars(statement.order_by(ToolRun.started_at, ToolRun.attempt_number, ToolRun.id))
    )


def require_investigation(db, user, case_id, *, lock=False):
    case = get_case(db, user, case_id, lock=lock)
    investigation = db.get(Investigation, case.id)
    if investigation is None or case.type != "aml_investigation":
        raise HTTPException(404, "Investigation unavailable.")
    return case, investigation


def require_analyst(user, case, investigation):
    if user.role_id != "compliance" or user.id != case.owner_id:
        raise HTTPException(
            403, "Only the assigned Compliance analyst may edit this investigation."
        )
    if investigation.submitted_at:
        raise HTTPException(409, "Investigation has already been submitted for checker review.")


def _evidence(db, investigation):
    return [EvidenceItem.model_validate(row.item) for row in _rows(db, investigation.case_id)]


def evaluate_investigation_case(db, user, case) -> GuardResult:
    investigation = db.get(Investigation, case.id)
    if investigation is None:
        raise HTTPException(404, "Investigation unavailable.")
    authorized = can_access_case(db, user, case)
    if not authorized:
        return SuperFlowGuard().evaluate_investigation(
            authorized=False, evidence=[], provenance_valid=False, conflict=None, failed_tools=[]
        )
    evidence = _evidence(db, investigation)
    provenance = investigation.provenance or {}
    runs = {row.id: row for row in _attempts(db, case.id)}
    valid = all(
        item.key.startswith("request-")
        or (
            (p := provenance.get(item.key)) is not None
            and (run := runs.get(p.get("tool_run_id"))) is not None
            and run.status == "completed"
            and p.get("fingerprint") == _fingerprint(run.result_metadata)
        )
        for item in evidence
        if item.status == "available"
    )
    failed = [
        tool.value
        for tool, keys in TOOL_EVIDENCE.items()
        if any(e.key in keys and e.status == "missing" for e in evidence)
        and (attempts := _attempts(db, case.id, tool.value))
        and attempts[-1].status == "failed"
    ]
    profile_result = next(
        (
            r.result_metadata
            for r in runs.values()
            if r.tool_name == ToolName.CUSTOMER_PROFILE and r.status == "completed"
        ),
        {},
    )
    transaction_result = next(
        (
            r.result_metadata
            for r in runs.values()
            if r.tool_name == ToolName.TRANSACTIONS and r.status == "completed"
        ),
        {},
    )
    conflict = detect_evidence_conflict(profile_result, transaction_result)
    if not all(
        any(e.key == key and e.status == "available" for e in evidence)
        for key in ("source_of_funds", "transaction_pattern")
    ):
        conflict = None
    result = SuperFlowGuard().evaluate_investigation(
        authorized=True,
        evidence=evidence,
        provenance_valid=valid,
        conflict=conflict,
        failed_tools=failed,
        template_valid=investigation.template_id == TEMPLATE["id"],
    )
    run = db.get(QuestionRun, case.context_run_id)
    result = persist_guard_result(db, user, run, result)
    if case.guard_id != result.id:
        log(db, user, case, "guard_evaluated", guard_id=result.id, guard_status=result.status.value)
    case.guard_id, case.reliability_status = result.id, result.status.value
    return result


def _tool_fixture(investigation, tool):
    if tool == ToolName.CUSTOMER_PROFILE:
        return {
            "customer_name": investigation.context_data["customer_name"],
            "occupation": "Logistics staff",
            "declared_source_of_funds": "Monthly salary",
            "profile_baseline": "IDR 18–35M per month",
        }
    if tool == ToolName.TRANSACTIONS:
        return {
            "count": 18,
            "window_hours": 36,
            "alerted_value_idr": 487500000,
            "new_beneficiaries": 7,
            "sample": TRANSACTIONS,
            "narrative": "Business settlement"
            if investigation.scenario == "conflict"
            else "Rapid movement to new beneficiaries",
        }
    if tool == ToolName.WATCHLIST:
        return {
            "exact_match": False,
            "possible_name_similarity": True,
            "provider": "synthetic-watchlist-v1",
        }
    if tool == ToolName.ADVERSE_NEWS:
        return {
            "candidate_articles": 2,
            "identity_confirmed": False,
            "provider": "synthetic-news-v1",
        }
    raise HTTPException(422, "Unknown investigation tool.")


def execute_tool(db, user, case, investigation, tool_name: str, *, retry=False):
    require_analyst(user, case, investigation)
    try:
        tool = ToolName(tool_name)
    except ValueError as error:
        raise HTTPException(422, "Unknown investigation tool.") from error
    previous = _attempts(db, case.id, tool.value)
    keys = TOOL_EVIDENCE[tool]
    if all(
        next(e for e in _evidence(db, investigation) if e.key == key).status == "available"
        for key in keys
    ):
        raise HTTPException(409, "Evidence is already collected; duplicate execution was rejected.")
    if previous and previous[-1].status == "failed" and not retry:
        raise HTTPException(409, "Retry the failed tool explicitly.")
    if retry and (not previous or previous[-1].status != "failed"):
        raise HTTPException(409, "Only a failed tool can be retried.")
    if len(previous) >= MAX_TOOL_ATTEMPTS:
        raise HTTPException(409, "Tool retry limit reached; manual attention is required.")
    attempt = len(previous) + 1
    request = SyntheticToolRequest(
        subject_reference=investigation.subject_reference,
        fixture=investigation.scenario,
    )
    run = ToolRun(
        investigation_id=case.id,
        tool_name=tool.value,
        status="running",
        attempt_number=attempt,
        request_metadata=request.model_dump(mode="json"),
        result_metadata={},
    )
    db.add(run)
    db.flush()
    log(
        db,
        user,
        case,
        "tool_retried" if retry else "tool_requested",
        tool_name=tool.value,
        attempt=attempt,
        tool_run_id=run.id,
    )
    if investigation.scenario == "failed_evidence" and tool == ToolName.WATCHLIST:
        run.status, run.error_code, run.error_summary = (
            "failed",
            "SYNTHETIC_UNAVAILABLE",
            "Synthetic watchlist adapter is unavailable for this scenario.",
        )
        run.completed_at = now()
        log(
            db,
            user,
            case,
            "tool_failed",
            tool_name=tool.value,
            attempt=attempt,
            tool_run_id=run.id,
            error_code=run.error_code,
        )
        if attempt >= MAX_TOOL_ATTEMPTS:
            log(
                db,
                user,
                case,
                "fallback_triggered",
                tool_name=tool.value,
                destination="manual_attention",
            )
    else:
        try:
            result = (
                TOOL_RESULT_SCHEMAS[tool]
                .model_validate(_tool_fixture(investigation, tool))
                .model_dump(mode="json")
            )
        except ValidationError:
            run.status, run.error_code, run.error_summary = (
                "failed",
                "INVALID_SYNTHETIC_RESULT",
                "Synthetic tool returned an invalid structured result.",
            )
            run.completed_at = now()
            log(
                db,
                user,
                case,
                "tool_failed",
                tool_name=tool.value,
                attempt=attempt,
                tool_run_id=run.id,
                error_code=run.error_code,
            )
            if attempt >= MAX_TOOL_ATTEMPTS:
                log(
                    db,
                    user,
                    case,
                    "fallback_triggered",
                    tool_name=tool.value,
                    destination="manual_attention",
                )
            evaluate_investigation_case(db, user, case)
            return run
        run.status, run.result_metadata, run.completed_at = "completed", result, now()
        provenance = dict(investigation.provenance or {})
        for key in keys:
            row = next(row for row in _rows(db, case.id) if row.key == key)
            item = EvidenceItem.model_validate(row.item)
            item.status = "available"
            item.details = f"Synthetic {tool.value} result; attempt {attempt}; run {run.id}."
            row.item = item.model_dump(mode="json")
            provenance[key] = {
                "tool_run_id": run.id,
                "tool_name": tool.value,
                "collected_at": run.completed_at.isoformat(),
                "fingerprint": _fingerprint(result),
            }
            log(
                db,
                user,
                case,
                "evidence_collected",
                key=key,
                tool_run_id=run.id,
                fingerprint=provenance[key]["fingerprint"],
            )
        investigation.provenance = provenance
        log(
            db,
            user,
            case,
            "tool_completed",
            tool_name=tool.value,
            attempt=attempt,
            tool_run_id=run.id,
        )
    evaluate_investigation_case(db, user, case)
    return run


def deterministic_plan(db, investigation) -> AgentAction:
    evidence = {item.key: item for item in _evidence(db, investigation)}
    for tool, keys in TOOL_EVIDENCE.items():
        if not any(evidence[key].status == "missing" for key in keys):
            continue
        attempts = _attempts(db, investigation.case_id, tool.value)
        if len(attempts) >= MAX_TOOL_ATTEMPTS:
            continue
        return AgentAction(
            next_action=tool,
            evidence_requirement=keys[0],
            reason=f"Required {TEMPLATE['required'][keys[0]]} evidence is missing.",
            stop=False,
        )
    return AgentAction(
        next_action=None,
        evidence_requirement=None,
        reason="No permitted automated evidence action remains; analyst attention is required.",
        stop=True,
    )


def _ollama_plan(db, investigation, allowed: AgentAction) -> AgentAction:
    """Model may select only an action already offered by deterministic policy."""
    if settings.llm_provider != "ollama" or allowed.stop:
        return allowed
    payload = {
        "model": settings.ollama_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Select only the allowed next investigation tool. Return strict JSON "
                    "matching the schema. No final AML decision, no invented evidence."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "allowed_action": allowed.next_action.value,
                        "missing_requirement": allowed.evidence_requirement,
                    }
                ),
            },
        ],
        "stream": False,
        "think": False,
        "format": AgentAction.model_json_schema(),
        "options": {"temperature": 0, "num_ctx": settings.ollama_num_ctx, "num_predict": 160},
    }
    try:
        with httpx.Client(timeout=settings.ollama_timeout_seconds) as client:
            response = client.post(settings.ollama_base_url.rstrip("/") + "/api/chat", json=payload)
            response.raise_for_status()
        candidate = AgentAction.model_validate_json(response.json()["message"]["content"])
        if (
            candidate.stop
            or candidate.next_action != allowed.next_action
            or candidate.evidence_requirement != allowed.evidence_requirement
        ):
            raise ValueError("Model action is outside the current allowlist")
        return candidate
    except (httpx.HTTPError, KeyError, TypeError, ValueError, ValidationError):
        return allowed


def agent_step(db, user, case, investigation):
    require_analyst(user, case, investigation)
    allowed = deterministic_plan(db, investigation)
    plan = _ollama_plan(db, investigation, allowed)
    log(
        db,
        user,
        case,
        "agent_action_planned",
        next_action=plan.next_action.value if plan.next_action else None,
        reason=plan.reason,
        provider="ollama-validated"
        if settings.llm_provider == "ollama" and plan is not allowed
        else "deterministic",
    )
    if plan.stop:
        return plan
    attempts = _attempts(db, case.id, plan.next_action.value)
    execute_tool(db, user, case, investigation, plan.next_action.value, retry=bool(attempts))
    return plan


def create_investigation(db, user, scenario="complete", *, seed=False):
    if user.role_id != "compliance" or user.id == "compliance_checker":
        raise HTTPException(403, "Only the Compliance analyst may open an investigation.")
    fixture = SCENARIOS[scenario]
    existing = db.scalar(
        select(Investigation).where(Investigation.alert_reference == fixture["alert"])
    )
    if existing:
        if seed:
            return existing
        raise HTTPException(409, "Investigation for this alert already exists.")
    case = new_case(
        db,
        user,
        CaseCreate(
            title=f"Investigation Review — Alert {fixture['alert']}",
            description="Synthetic transaction alert requiring analyst and checker review.",
            type="aml_investigation",
        ),
        may_assign=True,
    )
    investigation = Investigation(
        case_id=case.id,
        alert_reference=fixture["alert"],
        template_id=TEMPLATE["id"],
        scenario=scenario,
        subject_reference=fixture["subject"],
        context_data={
            "customer_name": fixture["name"],
            "indicators": INDICATORS,
            "synthetic": True,
        },
        provenance={},
        analyst_notes="",
        analyst_recommendation="",
    )
    db.add(investigation)
    db.flush()
    for key, label in {**TEMPLATE["required"], **TEMPLATE["optional"]}.items():
        item = EvidenceItem(
            key=key,
            label=label,
            required=key in TEMPLATE["required"],
            status="missing",
            details="Not collected from a synthetic adapter.",
        )
        db.add(CaseEvidence(case_id=case.id, key=key, item=item.model_dump(mode="json")))
    db.flush()
    log(
        db,
        user,
        case,
        "investigation_created",
        alert_reference=fixture["alert"],
        template_id=TEMPLATE["id"],
        scenario=scenario,
    )
    execute_tool(db, user, case, investigation, ToolName.CUSTOMER_PROFILE.value)
    execute_tool(db, user, case, investigation, ToolName.TRANSACTIONS.value)
    evaluate_investigation_case(db, user, case)
    return investigation


def update_recommendation(db, user, case, investigation, notes, recommendation):
    require_analyst(user, case, investigation)
    investigation.analyst_notes, investigation.analyst_recommendation = notes, recommendation
    log(
        db,
        user,
        case,
        "analyst_recommendation_updated",
        recommendation_digest=digest(recommendation),
    )


def submit_investigation(db, user, case, investigation):
    require_analyst(user, case, investigation)
    guard = evaluate_investigation_case(db, user, case)
    if guard.status not in {ReliabilityStatus.VERIFIED, ReliabilityStatus.REVIEW_REQUIRED}:
        raise HTTPException(
            409,
            "Required evidence is incomplete. Resolve missing or failed collection "
            "before checker review.",
        )
    if len(investigation.analyst_recommendation.strip()) < 10:
        raise HTTPException(409, "Record an analyst recommendation before checker review.")
    definition = db.get(WorkflowDefinition, "aml-investigation-v1")
    if not definition:
        raise HTTPException(503, "Investigation workflow definition is not installed. Run seed.")
    workflow = start_workflow(db, user, case, definition)
    investigation.submitted_at = now()
    log(
        db,
        user,
        case,
        "investigation_submitted_to_checker",
        workflow_run_id=workflow.id,
        guard_status=guard.status.value,
    )


def view(db, user, case, investigation):
    guard = evaluate_investigation_case(db, user, case)
    runs = _attempts(db, case.id)
    workflow = db.scalar(select(WorkflowRun).where(WorkflowRun.case_id == case.id))
    approval = db.scalar(
        select(Approval).where(Approval.case_id == case.id).order_by(Approval.requested_at.desc())
    )
    transaction = next(
        (
            run.result_metadata
            for run in runs
            if run.tool_name == ToolName.TRANSACTIONS and run.status == "completed"
        ),
        None,
    )
    draft_summary = (
        f"Synthetic alert shows {transaction['count']} transfers in "
        f"{transaction['window_hours']} hours "
        f"and {transaction['new_beneficiaries']} new beneficiaries. "
        "The pattern differs from the declared salary baseline; analyst and "
        "checker review is required."
        if transaction
        else "Transaction evidence has not been collected."
    )
    result = {
        "id": case.id,
        "case_id": case.id,
        "alert_reference": investigation.alert_reference,
        "template": TEMPLATE,
        "scenario": investigation.scenario,
        "subject_reference": investigation.subject_reference,
        "context": {
            **investigation.context_data,
            "triage_level": triage_priority(investigation.context_data.get("indicators", [])),
        },
        "draft_summary": draft_summary,
        "evidence": [item.model_dump(mode="json") for item in _evidence(db, investigation)],
        "provenance": investigation.provenance,
        "tool_runs": [
            {
                "id": r.id,
                "tool_name": r.tool_name,
                "status": r.status,
                "attempt_number": r.attempt_number,
                "result": r.result_metadata,
                "error_code": r.error_code,
                "error_summary": r.error_summary,
                "started_at": r.started_at,
                "completed_at": r.completed_at,
            }
            for r in runs
        ],
        "reliability": guard.model_dump(mode="json"),
        "analyst_notes": investigation.analyst_notes,
        "analyst_recommendation": investigation.analyst_recommendation,
        "submitted_at": investigation.submitted_at,
        "completed_at": investigation.completed_at,
        "status": case.status,
        "revision": case.revision,
        "owner_id": case.owner_id,
        "workflow_run_id": workflow.id if workflow else None,
        "approval_id": approval.id if approval else None,
        "approval_status": approval.status if approval else None,
        "activity": activity(db, case),
        "next_action": deterministic_plan(db, investigation).model_dump(mode="json")
        if not investigation.submitted_at
        else None,
    }
    return result
