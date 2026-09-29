"""Permission-aware QCD analytics and controlled generative UI composition.

Observed metrics come from persisted questions, Guard evaluations, work, approvals and
audit events. Capacity values are explicitly illustrative simulations. The composer may
select and order approved component schemas, but it cannot emit markup or invent data.
"""

from collections import Counter
from datetime import datetime, timezone
from statistics import mean
from typing import Protocol

from fastapi import HTTPException
from sqlalchemy import select

from .analytics_contracts import (
    ActionLink,
    BreakdownItem,
    CapacitySimulationComponent,
    CapacitySimulationData,
    DistributionChartComponent,
    DistributionData,
    ImpactBriefComponent,
    ImpactBriefData,
    ImpactFocus,
    ImpactMetric,
    ImpactWorkspace,
    MetricGroupComponent,
    MetricGroupData,
    MetricKind,
    NextActionsComponent,
    NextActionsData,
)
from .cases import can_access_case
from .models import Approval, AuditEvent, Case, GuardEvaluation, QuestionRun, User
from .reliability_contracts import ReliabilityStatus
from .workflow_contracts import CaseStatus

IMPACT_ROLES = {"manager", "sme", "compliance", "finance", "governance"}
PROVIDER = "deterministic-impact-composer-v1"

# Prototype simulation assumptions. They are always returned with the mandatory
# "Illustrative simulation" disclosure and never described as realized profit.
LOOKUP_BASELINE_MINUTES = 15
LOOKUP_WITH_SUPERFLOW_MINUTES = 3
WORK_BASELINE_MINUTES = 90
WORK_WITH_SUPERFLOW_MINUTES = 45
ILLUSTRATIVE_HOURLY_COST_IDR = 150_000

STATUS_LABELS = {
    ReliabilityStatus.VERIFIED: "Verified",
    ReliabilityStatus.REVIEW_REQUIRED: "Review required",
    ReliabilityStatus.BLOCKED: "Blocked",
    ReliabilityStatus.OUTDATED: "Historical source",
    ReliabilityStatus.ACCESS_RESTRICTED: "Access restricted",
}
CASE_LABELS = {
    CaseStatus.OPEN: "Ready to submit",
    CaseStatus.IN_PROGRESS: "In progress",
    CaseStatus.WAITING_FOR_EVIDENCE: "Waiting for information",
    CaseStatus.WAITING_FOR_REVIEW: "Waiting for review",
    CaseStatus.COMPLETED: "Completed",
    CaseStatus.CANCELLED: "Closed",
}


def require_impact(user: User) -> None:
    if user.role_id not in IMPACT_ROLES:
        raise HTTPException(403, "Impact is available to review and control roles.")


def utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)


def percentage(numerator: int, denominator: int) -> float:
    return round(numerator * 100 / denominator, 1) if denominator else 0.0


def observed(
    key: str,
    label: str,
    value: float | None,
    unit: str,
    detail: str,
    method: str,
    *,
    numerator: int | None = None,
    denominator: int | None = None,
) -> ImpactMetric:
    return ImpactMetric(
        key=key,
        label=label,
        value=value,
        unit=unit,
        kind=MetricKind.OBSERVED,
        detail=detail,
        method=method,
        numerator=numerator,
        denominator=denominator,
    )


def simulated(
    key: str, label: str, value: float, unit: str, detail: str, method: str
) -> ImpactMetric:
    return ImpactMetric(
        key=key,
        label=label,
        value=round(value, 2),
        unit=unit,
        kind=MetricKind.ILLUSTRATIVE_SIMULATION,
        detail=detail,
        method=method,
    )


def tone_for_reliability(status: str) -> str:
    return {
        ReliabilityStatus.VERIFIED: "positive",
        ReliabilityStatus.REVIEW_REQUIRED: "attention",
        ReliabilityStatus.BLOCKED: "blocked",
        ReliabilityStatus.OUTDATED: "attention",
        ReliabilityStatus.ACCESS_RESTRICTED: "blocked",
    }.get(status, "neutral")


def breakdown(counter: Counter, labels: dict) -> list[BreakdownItem]:
    total = sum(counter.values())
    return [
        BreakdownItem(
            key=str(key),
            label=label,
            count=counter.get(key, 0),
            percent=percentage(counter.get(key, 0), total),
            tone=(
                tone_for_reliability(key)
                if labels is STATUS_LABELS
                else "positive"
                if key == CaseStatus.COMPLETED
                else "attention"
                if key in {CaseStatus.WAITING_FOR_EVIDENCE, CaseStatus.WAITING_FOR_REVIEW}
                else "neutral"
            ),
        )
        for key, label in labels.items()
        if counter.get(key, 0)
    ]


def latest_guards(db, run_ids: set[str]) -> dict[str, GuardEvaluation]:
    latest = {}
    if not run_ids:
        return latest
    evaluations = db.scalars(
        select(GuardEvaluation)
        .where(GuardEvaluation.run_id.in_(run_ids))
        .order_by(GuardEvaluation.created_at, GuardEvaluation.id)
    )
    for evaluation in evaluations:
        latest[evaluation.run_id] = evaluation
    return latest


def event_latency(events: list[AuditEvent], run_ids: set[str]) -> list[float]:
    starts: dict[str, datetime] = {}
    durations = []
    for event in sorted(events, key=lambda item: (item.created_at, item.id)):
        if event.entity_id not in run_ids:
            continue
        if event.event_type == "question_submitted":
            starts[event.entity_id] = utc(event.created_at)
        elif event.event_type == "result_returned" and event.entity_id in starts:
            duration = (utc(event.created_at) - starts[event.entity_id]).total_seconds() / 60
            if duration >= 0:
                durations.append(duration)
                starts.pop(event.entity_id, None)
    return durations


def activity_breakdown(events: list[AuditEvent]) -> list[BreakdownItem]:
    groups = {
        "knowledge": ("Answers and retrieval", {"answer_generated", "retrieval_completed"}),
        "reliability": (
            "Reliability controls",
            {"guard_evaluated", "conflict_detected", "outdated_source_detected"},
        ),
        "review": (
            "Human review decisions",
            {
                "approval_approved",
                "approval_rejected",
                "evidence_requested",
                "override_performed",
            },
        ),
        "domain": (
            "Regulatory and investment actions",
            {
                "finding_confirmed",
                "finding_rejected",
                "regulatory_review_completed",
                "investment_analysis_started",
                "investment_assumption_selected",
                "investment_submitted",
            },
        ),
    }
    counts = Counter(event.event_type for event in events)
    grouped = Counter(
        {key: sum(counts[item] for item in names) for key, (_, names) in groups.items()}
    )
    total = sum(grouped.values())
    return [
        BreakdownItem(
            key=key,
            label=label,
            count=grouped[key],
            percent=percentage(grouped[key], total),
            tone="neutral",
        )
        for key, (label, _) in groups.items()
        if grouped[key]
    ]


def snapshot(db, user: User) -> dict:
    require_impact(user)
    cases = [case for case in db.scalars(select(Case)) if can_access_case(db, user, case)]
    case_ids = {case.id for case in cases}

    if user.role_id == "governance":
        question_runs = list(db.scalars(select(QuestionRun)))
    else:
        question_runs = list(db.scalars(select(QuestionRun).where(QuestionRun.user_id == user.id)))
    run_ids = {run.id for run in question_runs}
    events = (
        list(
            db.scalars(
                select(AuditEvent).where(
                    (AuditEvent.entity_type == "case") & (AuditEvent.entity_id.in_(case_ids))
                    | (AuditEvent.entity_type == "question_run")
                    & (AuditEvent.entity_id.in_(run_ids))
                )
            )
        )
        if case_ids or run_ids
        else []
    )

    # Only explicit Ask submissions count as knowledge answers; cloned Case context runs do not.
    asked_ids = {event.entity_id for event in events if event.event_type == "question_submitted"}
    guards = latest_guards(db, asked_ids)
    citation_ok = sum(
        evaluation.result.get("checks", {}).get("citation_coverage", {}).get("passed") is True
        for evaluation in guards.values()
    )
    verified = sum(
        evaluation.status == ReliabilityStatus.VERIFIED for evaluation in guards.values()
    )
    conflicts = sum(
        evaluation.result.get("checks", {}).get("conflict_detection", {}).get("passed") is False
        for evaluation in guards.values()
    )
    outdated = sum(
        evaluation.status == ReliabilityStatus.OUTDATED for evaluation in guards.values()
    )
    rework = sum(event.event_type == "evidence_requested" for event in events)
    latencies = event_latency(events, asked_ids)

    completed = [case for case in cases if case.status == CaseStatus.COMPLETED]
    active = [
        case for case in cases if case.status not in {CaseStatus.COMPLETED, CaseStatus.CANCELLED}
    ]
    cycle_days = [
        max((utc(case.updated_at) - utc(case.created_at)).total_seconds() / 86_400, 0)
        for case in completed
    ]
    approvals = (
        list(db.scalars(select(Approval).where(Approval.case_id.in_(case_ids)))) if case_ids else []
    )
    decided = [item for item in approvals if item.decided_at]
    review_hours = [
        max((utc(item.decided_at) - utc(item.requested_at)).total_seconds() / 3_600, 0)
        for item in decided
    ]
    escalations = sum(event.event_type == "escalation_created" for event in events)
    reliability_counts = Counter(evaluation.status for evaluation in guards.values())
    case_counts = Counter(case.status for case in cases)

    question_count = len(asked_ids)
    completed_count = len(completed)
    released_hours = (
        question_count * (LOOKUP_BASELINE_MINUTES - LOOKUP_WITH_SUPERFLOW_MINUTES) / 60
        + completed_count * (WORK_BASELINE_MINUTES - WORK_WITH_SUPERFLOW_MINUTES) / 60
    )

    quality = [
        observed(
            "citation_coverage",
            "Citation coverage",
            percentage(citation_ok, len(guards)),
            "percent",
            "Answers whose latest reliability check confirms exact citation coverage.",
            "Latest Guard result per submitted question.",
            numerator=citation_ok,
            denominator=len(guards),
        ),
        observed(
            "verified_rate",
            "Verified result rate",
            percentage(verified, len(guards)),
            "percent",
            "Submitted questions whose latest canonical reliability state is VERIFIED.",
            "VERIFIED latest results divided by evaluated submitted questions.",
            numerator=verified,
            denominator=len(guards),
        ),
        observed(
            "conflicts_detected",
            "Conflicts detected",
            conflicts,
            "count",
            "Results where the conflict-detection check stopped an unqualified conclusion.",
            "Latest Guard conflict_detection checks with passed = false.",
        ),
        observed(
            "rework_requests",
            "Information requested",
            rework,
            "count",
            "Human review decisions that returned work for more information.",
            "Append-only evidence_requested audit events in the accessible scope.",
        ),
        observed(
            "outdated_flagged",
            "Historical-source results flagged",
            outdated,
            "count",
            "Results explicitly marked OUTDATED instead of treated as current authority.",
            "Latest canonical OUTDATED Guard results.",
        ),
    ]
    capacity_observed = [
        observed(
            "questions_answered",
            "Questions answered",
            question_count,
            "count",
            "Natural-language questions submitted in this accessible scope.",
            "Distinct question_submitted audit records.",
        ),
        observed(
            "completed_work",
            "Work completed",
            completed_count,
            "count",
            "Requests, remediations, or analyses completed through controlled work.",
            "Accessible Cases in COMPLETED state.",
        ),
    ]
    capacity_simulated = [
        simulated(
            "hours_released",
            "Capacity released",
            released_hours,
            "hours",
            "Illustrative time available for other work; not recorded payroll savings.",
            f"Questions × {LOOKUP_BASELINE_MINUTES - LOOKUP_WITH_SUPERFLOW_MINUTES} minutes "
            f"+ completed work × {WORK_BASELINE_MINUTES - WORK_WITH_SUPERFLOW_MINUTES} minutes.",
        ),
        simulated(
            "cost_avoidance",
            "Illustrative cost avoidance",
            released_hours * ILLUSTRATIVE_HOURLY_COST_IDR,
            "IDR",
            "Soft-dollar capacity value only; not realized profit.",
            f"Illustrative released hours × IDR {ILLUSTRATIVE_HOURLY_COST_IDR:,} per hour.",
        ),
        simulated(
            "cost_per_work_item",
            "Capacity value per completed item",
            (WORK_BASELINE_MINUTES - WORK_WITH_SUPERFLOW_MINUTES)
            / 60
            * ILLUSTRATIVE_HOURLY_COST_IDR,
            "IDR",
            "Illustrative capacity value for one completed work item.",
            "45 illustrative minutes released × the illustrative hourly cost.",
        ),
    ]
    delivery = [
        observed(
            "answer_time",
            "Average answer time",
            round(mean(latencies), 2) if latencies else None,
            "minutes",
            "Elapsed time from question submission to the first returned result.",
            "Paired question_submitted and result_returned audit timestamps.",
        ),
        observed(
            "cycle_time",
            "Average work cycle time",
            round(mean(cycle_days), 2) if cycle_days else None,
            "days",
            "Elapsed time for completed work visible to this role.",
            "Case created_at to final updated_at for completed work.",
        ),
        observed(
            "backlog",
            "Active backlog",
            len(active),
            "count",
            "Accessible work that is not completed or closed.",
            "Current non-terminal Case states.",
        ),
        observed(
            "throughput",
            "Completed work",
            completed_count,
            "count",
            "Accessible work completed in the recorded demo dataset.",
            "Current COMPLETED Case count.",
        ),
        observed(
            "completion_rate",
            "Completion rate",
            percentage(completed_count, len(cases)),
            "percent",
            "Share of accessible work currently completed.",
            "COMPLETED Cases divided by all accessible Cases.",
            numerator=completed_count,
            denominator=len(cases),
        ),
        observed(
            "review_time",
            "Average review time",
            round(mean(review_hours), 2) if review_hours else None,
            "hours",
            "Elapsed time for recorded human approval decisions.",
            "Approval requested_at to decided_at for decided approvals.",
        ),
        observed(
            "escalations",
            "Escalations",
            escalations,
            "count",
            "Work explicitly escalated for higher-authority review.",
            "Append-only escalation_created audit events.",
        ),
    ]
    timestamps = [event.created_at for event in events] + [case.updated_at for case in cases]
    return {
        "scope": "Platform-wide synthetic activity"
        if user.role_id == "governance"
        else f"Work visible to {user.name}",
        "data_through": max(
            (utc(value) for value in timestamps), default=datetime.now(timezone.utc)
        ),
        "quality": quality,
        "capacity": capacity_observed,
        "capacity_simulated": capacity_simulated,
        "delivery": delivery,
        "reliability": breakdown(reliability_counts, STATUS_LABELS),
        "work": breakdown(case_counts, CASE_LABELS),
        "activity": activity_breakdown(events),
        "counts": {
            "questions": question_count,
            "work": len(cases),
            "completed": completed_count,
            "verified": verified,
            "evaluated": len(guards),
            "backlog": len(active),
        },
    }


class ImpactComposer(Protocol):
    name: str

    def compose(self, question: str, data: dict, user: User) -> ImpactWorkspace: ...


class DeterministicImpactComposer:
    """Select approved components from intent and persisted metric data."""

    name = PROVIDER

    def focus(self, question: str) -> ImpactFocus:
        lowered = question.lower()
        scores = {
            ImpactFocus.QUALITY: sum(
                word in lowered
                for word in ("quality", "reliability", "citation", "verified", "conflict", "source")
            ),
            ImpactFocus.CAPACITY: sum(
                word in lowered
                for word in ("cost", "capacity", "hours", "effort", "saving", "productivity")
            ),
            ImpactFocus.DELIVERY: sum(
                word in lowered
                for word in (
                    "delivery",
                    "backlog",
                    "throughput",
                    "cycle",
                    "time",
                    "completion",
                    "escalation",
                )
            ),
        }
        if sum(score > 0 for score in scores.values()) > 1:
            return ImpactFocus.OVERVIEW
        best = max(scores, key=scores.get)
        return best if scores[best] else ImpactFocus.OVERVIEW

    def actions(self, data: dict, user: User) -> list[ActionLink]:
        metrics = {item.key: item for item in data["quality"] + data["delivery"]}
        actions = []
        if (metrics["citation_coverage"].value or 0) < 95:
            actions.append(
                ActionLink(
                    label="Review source coverage",
                    description="Inspect governed knowledge and improve evidence coverage.",
                    href="/knowledge",
                )
            )
        if data["counts"]["backlog"]:
            actions.append(
                ActionLink(
                    label="Open active work",
                    description="Continue requests that are still waiting for action or review.",
                    href="/cases",
                )
            )
        if user.role_id in IMPACT_ROLES:
            actions.append(
                ActionLink(
                    label="Review pending decisions",
                    description="Inspect evidence and reliability before making a decision.",
                    href="/decisions",
                )
            )
        if not actions:
            actions.append(
                ActionLink(
                    label="Ask SuperFlow",
                    description="Use governed knowledge to begin another measurable journey.",
                    href="/ask",
                )
            )
        return actions[:3]

    def compose(self, question: str, data: dict, user: User) -> ImpactWorkspace:
        focus = self.focus(question)
        counts = data["counts"]
        verified_rate = percentage(counts["verified"], counts["evaluated"])
        summary = (
            f"This view is grounded in {counts['questions']} submitted questions and "
            f"{counts['work']} work items in the permitted scope. "
            f"{verified_rate:g}% of evaluated answers are currently Verified, and "
            f"{counts['backlog']} work items remain active."
        )
        brief = ImpactBriefComponent(
            type="ImpactBrief",
            data=ImpactBriefData(
                eyebrow="SuperFlow generated view",
                title={
                    ImpactFocus.OVERVIEW: "Impact across quality, capacity, and delivery",
                    ImpactFocus.QUALITY: "Where reliability needs attention",
                    ImpactFocus.CAPACITY: "How capacity may be released",
                    ImpactFocus.DELIVERY: "How work is moving",
                }[focus],
                summary=summary,
                highlights=[
                    f"{counts['verified']} Verified results from "
                    f"{counts['evaluated']} evaluated questions",
                    f"{counts['completed']} completed work items",
                    f"{counts['backlog']} active work items",
                ],
            ),
        )
        groups = {
            ImpactFocus.QUALITY: MetricGroupComponent(
                type="MetricGroup",
                data=MetricGroupData(
                    category="quality",
                    title="Quality",
                    description=(
                        "Grounding, reliability, conflict handling, and rework from actual records."
                    ),
                    metrics=data["quality"],
                ),
            ),
            ImpactFocus.CAPACITY: MetricGroupComponent(
                type="MetricGroup",
                data=MetricGroupData(
                    category="capacity",
                    title="Cost / Capacity",
                    description=(
                        "Observed volume is separated from illustrative capacity assumptions."
                    ),
                    metrics=data["capacity"],
                ),
            ),
            ImpactFocus.DELIVERY: MetricGroupComponent(
                type="MetricGroup",
                data=MetricGroupData(
                    category="delivery",
                    title="Delivery",
                    description=(
                        "Cycle, backlog, throughput, completion, review time, and escalation."
                    ),
                    metrics=data["delivery"],
                ),
            ),
        }
        components = [brief]
        selected = (
            [ImpactFocus.QUALITY, ImpactFocus.CAPACITY, ImpactFocus.DELIVERY]
            if focus == ImpactFocus.OVERVIEW
            else [focus]
        )
        components.extend(groups[item] for item in selected)
        if focus in {ImpactFocus.OVERVIEW, ImpactFocus.QUALITY}:
            components.append(
                DistributionChartComponent(
                    type="DistributionChart",
                    data=DistributionData(
                        title="Reliability outcomes",
                        description="Latest canonical state for each evaluated submitted question.",
                        items=data["reliability"],
                    ),
                )
            )
        if focus in {ImpactFocus.OVERVIEW, ImpactFocus.CAPACITY}:
            components.append(
                CapacitySimulationComponent(
                    type="CapacitySimulation",
                    data=CapacitySimulationData(
                        title="Illustrative capacity model",
                        disclosure="Illustrative simulation",
                        description=(
                            "A transparent scenario, not a claim of realized savings or profit."
                        ),
                        metrics=data["capacity_simulated"],
                        assumptions=[
                            f"Knowledge lookup: {LOOKUP_BASELINE_MINUTES} minutes baseline vs "
                            f"{LOOKUP_WITH_SUPERFLOW_MINUTES} minutes with SuperFlow.",
                            f"Controlled work: {WORK_BASELINE_MINUTES} minutes baseline vs "
                            f"{WORK_WITH_SUPERFLOW_MINUTES} minutes with SuperFlow.",
                            "Illustrative loaded capacity cost: "
                            f"IDR {ILLUSTRATIVE_HOURLY_COST_IDR:,} per hour.",
                        ],
                    ),
                )
            )
        if focus in {ImpactFocus.OVERVIEW, ImpactFocus.DELIVERY}:
            components.append(
                DistributionChartComponent(
                    type="DistributionChart",
                    data=DistributionData(
                        title="Work status",
                        description="Current state of work visible to this role.",
                        items=data["work"],
                    ),
                )
            )
        if data["activity"]:
            components.append(
                DistributionChartComponent(
                    type="DistributionChart",
                    data=DistributionData(
                        title="Controlled activity",
                        description="Readable groups derived from append-only audit events.",
                        items=data["activity"],
                    ),
                )
            )
        components.append(
            NextActionsComponent(
                type="NextActions",
                data=NextActionsData(
                    title="Recommended next actions", actions=self.actions(data, user)
                ),
            )
        )
        return ImpactWorkspace(
            focus=focus,
            question=question,
            answer=summary,
            scope=data["scope"],
            data_through=data["data_through"],
            provider=self.name,
            notice=(
                "Controlled generative UI selected approved components from permitted "
                "operational data. Metrics are deterministic; simulated values are "
                "explicitly labelled."
            ),
            components=components,
        )


composer: ImpactComposer = DeterministicImpactComposer()


def impact_workspace(db, user: User, question: str) -> ImpactWorkspace:
    return composer.compose(question, snapshot(db, user), user)
