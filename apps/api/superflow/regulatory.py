"""Regulation-to-Action service: comparison snapshot, human gap decisions, remediation.

The review is a Case (access, revision, audit, Guard context). Findings are proposals until
a Compliance reviewer confirms or rejects them; confirmed gaps become remediation Cases on
the existing workflow engine. Nothing here authorizes content the actor cannot read.
"""

from datetime import date, datetime, time, timezone
from itertools import count

from fastapi import HTTPException
from sqlalchemy import select

from .auth import can_read
from .cases import activity, can_access_case, context, log, new_case, require_edit
from .knowledge import accessible_document, citation_payload
from .models import (
    Approval,
    Case,
    Document,
    DocumentChunk,
    DocumentVersion,
    RegulatoryFinding,
    RegulatoryReview,
    Task,
    WorkflowRun,
    now,
)
from .regulatory_analysis import (
    Candidate,
    DeterministicComparator,
    DeterministicGapAnalyzer,
    ReferenceTopicMapper,
    Section,
    proposed_summary,
)
from .regulatory_contracts import FindingStatus as FS
from .regulatory_contracts import ReviewPhase
from .reliability_contracts import ReliabilityStatus
from .workflow_contracts import ApprovalStatus, CaseCreate, CaseStatus
from .workflow_definitions import REGULATORY_REMEDIATION, install
from .workflows import start_workflow

comparator = DeterministicComparator()
mapper = ReferenceTopicMapper()
analyzer = DeterministicGapAnalyzer()
REVIEWER_ROLES = {"compliance"}
CLOSED = {CaseStatus.COMPLETED, CaseStatus.CANCELLED}
MAX_CONTEXT = 30


def require_reviewer(user):
    if user.role_id not in REVIEWER_ROLES:
        raise HTTPException(403, "Regulatory Review is available to Compliance.")


def is_regulation(document: Document) -> bool:
    # Prototype rule: highest-authority Compliance sources represent external regulation.
    return document.domain == "Compliance" and document.authority_level == 5


def version_pair(document: Document, base_version_id: str | None = None):
    """Current effective version plus the chosen (default: latest) earlier historical one."""
    ordered = sorted(
        document.versions,
        key=lambda v: (v.effective_date, v.created_at.replace(tzinfo=timezone.utc)),
    )
    current = next(
        (v for v in ordered if v.status == "active" and v.effective_date <= date.today()), None
    )
    if current is None:
        return None
    earlier = [v for v in ordered[: ordered.index(current)] if v.status == "outdated"]
    if base_version_id:
        base = next((v for v in earlier if v.id == base_version_id), None)
        if base is None:
            raise HTTPException(422, "Select an earlier historical version of this regulation.")
        return base, current
    return (earlier[-1], current) if earlier else None


def version_ref(version: DocumentVersion) -> dict:
    return {
        "id": version.id,
        "version": version.version,
        "status": version.status,
        "effective_date": version.effective_date,
    }


def open_review_for(db, user, target_version_id: str) -> RegulatoryReview | None:
    for review in db.scalars(
        select(RegulatoryReview).where(RegulatoryReview.target_version_id == target_version_id)
    ):
        case = db.get(Case, review.case_id)
        if case.status not in CLOSED and can_access_case(db, user, case):
            return review
    return None


def regulatory_sources(db, user) -> list[dict]:
    require_reviewer(user)
    result = []
    for document in db.scalars(
        select(Document).where(Document.context_run_id.is_(None)).order_by(Document.title)
    ):
        if not can_read(user, document) or not is_regulation(document):
            continue
        pair = version_pair(document)
        if pair is None:
            continue
        base, current = pair
        existing = open_review_for(db, user, current.id)
        result.append(
            {
                "document_id": document.id,
                "title": document.title,
                "owner": document.owner.name,
                "current": version_ref(current),
                "previous": version_ref(base),
                "open_review_id": existing.case_id if existing else None,
            }
        )
    return result


def impact_candidates(db, user, regulation: Document) -> list[Candidate]:
    related = set(regulation.related_document_ids)
    result = []
    for document in db.scalars(
        select(Document).where(Document.context_run_id.is_(None)).order_by(Document.id)
    ):
        # Authorize BEFORE any version or chunk text is read; restricted sources never map.
        if (
            document.id == regulation.id
            or not can_read(user, document)
            or is_regulation(document)
            or document.authority_level < 4
        ):
            continue
        version = next(
            (
                v
                for v in document.versions
                if v.status == "active" and v.effective_date <= date.today()
            ),
            None,
        )
        for chunk in version.chunks if version else []:
            result.append(
                Candidate(
                    document_id=document.id,
                    chunk_id=chunk.id,
                    section=chunk.section_path,
                    text=chunk.text,
                    related=document.id in related
                    or regulation.id in document.related_document_ids,
                )
            )
    return result


def create_review(db, user, value) -> tuple[Case, bool]:
    require_reviewer(user)
    document = accessible_document(db, user, value.document_id)
    pair = version_pair(document, value.base_version_id) if is_regulation(document) else None
    if pair is None:
        raise HTTPException(422, "Select a current regulation that has a previous version.")
    base, current = pair
    existing = open_review_for(db, user, current.id)
    if existing and existing.base_version_id == base.id:
        return db.get(Case, existing.case_id), False

    def sections(version):
        return [Section(chunk.id, chunk.section_path, chunk.text) for chunk in version.chunks]

    candidates = impact_candidates(db, user, document)
    planned = []
    for change in comparator.compare(sections(base), sections(current)):
        impacts = []
        if change.material and change.target:
            for candidate, basis in mapper.map(change, candidates):
                impacts.append((candidate, basis, analyzer.issues(change, candidate)))
        planned.append((change, impacts))
    chunk_ids = list(
        dict.fromkeys(
            [chunk.id for chunk in current.chunks]
            + [candidate.chunk_id for _, impacts in planned for candidate, _, _ in impacts]
        )
    )
    if len(chunk_ids) > MAX_CONTEXT:
        raise HTTPException(
            422, "This comparison exceeds the 30-section review context supported here."
        )
    case = new_case(
        db,
        user,
        CaseCreate(
            title=f"{document.title} — v{current.version} review"[:200],
            description=f"Compare v{base.version} (historical) with v{current.version} "
            "(current), assess procedure and control impact, and track remediation.",
            type="regulatory_review",
            chunk_ids=chunk_ids,
        ),
    )
    case.status = CaseStatus.IN_PROGRESS
    db.add(
        RegulatoryReview(
            case_id=case.id,
            document_id=document.id,
            base_version_id=base.id,
            target_version_id=current.id,
            comparator=comparator.name,
            changes=[
                {
                    "key": change.key,
                    "section": change.section,
                    "change_type": change.change_type,
                    "material": change.material,
                    "summary": change.summary,
                    "requirement_changes": change.requirement_changes,
                    "new_obligations": [sentence for sentence, _ in change.obligations],
                    "base_chunk_id": change.base.chunk_id if change.base else None,
                    "target_chunk_id": change.target.chunk_id if change.target else None,
                    "impacts": [
                        {"chunk_id": candidate.chunk_id, "basis": basis, "aligned": not issues}
                        for candidate, basis, issues in impacts
                    ],
                }
                for change, impacts in planned
            ],
        )
    )
    db.flush()
    findings = 0
    for change, impacts in planned:
        for candidate, basis, issues in impacts:
            if not issues:
                continue
            title = db.get(Document, candidate.document_id).title
            db.add(
                RegulatoryFinding(
                    review_id=case.id,
                    key=f"{change.key}:{candidate.chunk_id}",
                    change_key=change.key,
                    target_chunk_id=change.target.chunk_id,
                    impacted_chunk_id=candidate.chunk_id,
                    basis=basis,
                    issues=issues,
                    proposed_summary=proposed_summary(title, candidate.section, change, issues),
                )
            )
            findings += 1
    db.flush()
    log(
        db,
        user,
        case,
        "regulatory_review_started",
        document_id=document.id,
        base_version_id=base.id,
        target_version_id=current.id,
        comparator=comparator.name,
        change_count=len(planned),
        material_count=sum(change.material for change, _ in planned),
        finding_count=findings,
    )
    return case, True


def get_review(db, case) -> RegulatoryReview:
    review = db.get(RegulatoryReview, case.id)
    if review is None:
        raise HTTPException(404, "Regulatory review not found.")
    return review


def findings_for(db, case_id) -> list[RegulatoryFinding]:
    return list(
        db.scalars(
            select(RegulatoryFinding)
            .where(RegulatoryFinding.review_id == case_id)
            .order_by(RegulatoryFinding.change_key, RegulatoryFinding.key)
        )
    )


def remediation_case(db, finding) -> Case | None:
    return db.get(Case, finding.remediation_case_id) if finding.remediation_case_id else None


def phase(db, case, findings) -> ReviewPhase:
    if case.status == CaseStatus.CANCELLED:
        return ReviewPhase.CANCELLED
    if case.status == CaseStatus.COMPLETED:
        return ReviewPhase.COMPLETED
    if any(finding.status == FS.PROPOSED for finding in findings):
        return ReviewPhase.GAP_REVIEW
    if any(
        finding.status == FS.CONFIRMED
        and remediation_case(db, finding).status != CaseStatus.COMPLETED
        for finding in findings
    ):
        return ReviewPhase.REMEDIATION
    return ReviewPhase.READY_TO_CLOSE


def summary(db, case, review, findings=None) -> dict:
    findings = findings_for(db, case.id) if findings is None else findings
    remediations = [
        remediation_case(db, finding)
        for finding in findings
        if finding.status == FS.CONFIRMED and finding.remediation_case_id
    ]
    return {
        "id": case.id,
        "title": case.title,
        "document_id": review.document_id,
        "document_title": db.get(Document, review.document_id).title,
        "previous": version_ref(db.get(DocumentVersion, review.base_version_id)),
        "current": version_ref(db.get(DocumentVersion, review.target_version_id)),
        "phase": phase(db, case, findings),
        "status": case.status,
        "created_by": case.created_by,
        "revision": case.revision,
        "created_at": case.created_at,
        "updated_at": case.updated_at,
        "change_count": len(review.changes),
        "material_count": sum(change["material"] for change in review.changes),
        "finding_count": len(findings),
        "pending_count": sum(finding.status == FS.PROPOSED for finding in findings),
        "confirmed_count": sum(finding.status == FS.CONFIRMED for finding in findings),
        "remediation_total": len(remediations),
        "remediation_completed": sum(item.status == CaseStatus.COMPLETED for item in remediations),
    }


def list_reviews(db, user) -> list[dict]:
    result = []
    for review in db.scalars(select(RegulatoryReview).order_by(RegulatoryReview.created_at.desc())):
        case = db.get(Case, review.case_id)
        if can_access_case(db, user, case):
            result.append(summary(db, case, review))
    return result


def can_decide(user, case) -> bool:
    return (
        user.role_id in REVIEWER_ROLES
        and user.id in {case.owner_id, case.created_by}
        and case.status not in CLOSED
    )


def remediation_view(db, finding) -> dict | None:
    item = remediation_case(db, finding)
    if item is None:
        return None
    run = db.scalar(select(WorkflowRun).where(WorkflowRun.case_id == item.id))
    pending = db.scalar(
        select(Approval).where(
            Approval.case_id == item.id, Approval.status == ApprovalStatus.PENDING
        )
    )
    return {
        "case_id": item.id,
        "title": item.title,
        "status": item.status,
        "workflow_status": run.status if run else None,
        "owner_id": item.owner_id,
        "reviewer_id": pending.requested_from if pending else None,
        "due_date": finding.remediation_due_date,
    }


def review_view(db, user, case) -> dict:
    review = get_review(db, case)
    guard, _ = context(db, user, case)
    findings = findings_for(db, case.id)
    numbers = count(1)
    restricted = guard.status == ReliabilityStatus.ACCESS_RESTRICTED

    def cite(chunk_id):
        # Re-authorizes the actor for every chunk; never returns cached source text.
        return citation_payload(db, user, chunk_id, next(numbers)) if chunk_id else None

    sections = {change["key"]: change["section"] for change in review.changes}
    changes = [
        {
            **{key: change[key] for key in ["key", "section", "change_type", "material"]},
            **{key: change[key] for key in ["summary", "requirement_changes", "new_obligations"]},
            "previous": cite(change["base_chunk_id"]),
            "current": cite(change["target_chunk_id"]),
            "impacts": [
                {
                    "source": cite(item["chunk_id"]),
                    "basis": item["basis"],
                    "aligned": item["aligned"],
                }
                for item in change["impacts"]
            ],
        }
        for change in ([] if restricted else review.changes)
    ]
    decide = can_decide(user, case)
    finding_views = []
    for finding in [] if restricted else findings:
        impacted = cite(finding.impacted_chunk_id)
        remediation = remediation_view(db, finding)
        actions = []
        if decide and finding.status == FS.PROPOSED:
            actions = ["confirm", "reject"]
        elif decide and remediation and remediation["status"] == CaseStatus.CANCELLED:
            actions = ["reassign"]
        finding_views.append(
            {
                "id": finding.id,
                "change_key": finding.change_key,
                "section": sections.get(finding.change_key, impacted["section_path"]),
                "status": finding.status,
                "basis": finding.basis,
                "impacted": impacted,
                "requirement": cite(finding.target_chunk_id),
                "issues": finding.issues,
                "proposed_summary": finding.proposed_summary,
                "reviewer_summary": finding.reviewer_summary,
                "decision_reason": finding.decision_reason,
                "decided_by": finding.decided_by,
                "decided_at": finding.decided_at,
                "suggested_owner_id": db.get(Document, impacted["document_id"]).owner_id,
                "remediation": remediation,
                "allowed_actions": actions,
            }
        )
    base = summary(db, case, review, findings)
    return base | {
        "comparator": review.comparator,
        "reliability": guard,
        "changes": changes,
        "findings": finding_views,
        "activity": activity(db, case),
        "allowed_actions": ["complete"]
        if decide and base["phase"] == ReviewPhase.READY_TO_CLOSE
        else [],
    }


def finding_for(db, case, finding_id) -> RegulatoryFinding:
    finding = db.get(RegulatoryFinding, finding_id)
    if finding is None or finding.review_id != case.id:
        raise HTTPException(404, "Finding not found.")
    return finding


def require_decider(user, case):
    require_reviewer(user)
    require_edit(user, case)


def confirm_finding(db, user, case, finding, value):
    review = get_review(db, case)
    previous = remediation_case(db, finding)
    reassign = (
        finding.status == FS.CONFIRMED
        and previous is not None
        and previous.status == CaseStatus.CANCELLED
    )
    if finding.status != FS.PROPOSED and not reassign:
        raise HTTPException(409, "This finding has already been decided.")
    if value.due_date < date.today():
        raise HTTPException(422, "Choose a remediation due date of today or later.")
    edited = value.summary if value.summary and value.summary != finding.proposed_summary else None
    statement = edited or finding.reviewer_summary or finding.proposed_summary
    change = next(item for item in review.changes if item["key"] == finding.change_key)
    impacted_document = db.scalar(
        select(Document)
        .join(DocumentVersion, DocumentVersion.document_id == Document.id)
        .join(DocumentChunk, DocumentChunk.version_id == DocumentVersion.id)
        .where(DocumentChunk.id == finding.impacted_chunk_id)
    )
    # Remediation context: the current requirement plus every control mapped to it,
    # so conflicts between related procedures stay visible to owner and approver.
    chunk_ids = [finding.target_chunk_id] + [item["chunk_id"] for item in change["impacts"]]
    remediation = new_case(
        db,
        user,
        CaseCreate(
            title=f"Update {impacted_document.title} for {change['section']}"[:200],
            description=statement,
            type="remediation",
            owner_id=value.owner_id,
            chunk_ids=list(dict.fromkeys(chunk_ids)),
        ),
        may_assign=True,
    )
    remediation.revision += 1  # Starting the plan is a recorded mutation of the new Case.
    run = start_workflow(db, user, remediation, install(db, REGULATORY_REMEDIATION))
    task = db.scalar(select(Task).where(Task.workflow_run_id == run.id))
    task.description = "Update the procedure or control so it meets the regulation. " + statement
    # Midday UTC keeps the same calendar date for viewers from UTC-11 to UTC+11.
    task.due_at = datetime.combine(value.due_date, time(12, 0), tzinfo=timezone.utc)
    if not reassign:
        finding.status = FS.CONFIRMED
        finding.reviewer_summary = edited
        finding.decision_reason = value.reason or None
        finding.decided_by, finding.decided_at = user.id, now()
    finding.remediation_owner_id = remediation.owner_id
    finding.remediation_due_date = value.due_date
    finding.remediation_case_id = remediation.id
    log(
        db,
        user,
        case,
        "remediation_reassigned" if reassign else "finding_confirmed",
        finding_id=finding.id,
        remediation_case_id=remediation.id,
        owner_id=remediation.owner_id,
        due_date=value.due_date.isoformat(),
        edited=edited is not None,
        reason=value.reason or None,
    )
    log(
        db,
        user,
        remediation,
        "remediation_assigned",
        review_case_id=case.id,
        finding_id=finding.id,
        due_date=value.due_date.isoformat(),
    )


def reject_finding(db, user, case, finding, value):
    if finding.status != FS.PROPOSED:
        raise HTTPException(409, "This finding has already been decided.")
    if not value.reason:
        raise HTTPException(422, "Record why this proposed gap does not apply.")
    finding.status = FS.REJECTED
    finding.decision_reason = value.reason
    finding.decided_by, finding.decided_at = user.id, now()
    log(db, user, case, "finding_rejected", finding_id=finding.id, reason=value.reason)


def complete_review(db, user, case):
    findings = findings_for(db, case.id)
    current = phase(db, case, findings)
    if current == ReviewPhase.GAP_REVIEW:
        raise HTTPException(409, "Decide every proposed gap before closing the review.")
    if current == ReviewPhase.REMEDIATION:
        raise HTTPException(
            409, "Every confirmed remediation must be completed and approved before closing."
        )
    case.status = CaseStatus.COMPLETED
    log(
        db,
        user,
        case,
        "regulatory_review_completed",
        confirmed_count=sum(finding.status == FS.CONFIRMED for finding in findings),
        rejected_count=sum(finding.status == FS.REJECTED for finding in findings),
    )
