"""Read-only, bounded routing from natural language to existing workspaces."""

import re
from enum import StrEnum
from typing import Literal, Protocol

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import current_user
from .cases import can_access_case
from .config import settings
from .db import get_db
from .models import Case, Investigation, User


class WorkspaceKind(StrEnum):
    KNOWLEDGE_QA = "knowledge_answer"
    REGULATORY_REVIEW = "regulatory_review"
    INVESTMENT_ANALYSIS = "investment_analysis"
    INVESTIGATION_REVIEW = "investigation_review"
    IMPACT = "impact"
    MY_WORK = "my_work"
    REVIEWS = "reviews"


class WorkspacePrompt(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    prompt: str = Field(min_length=3, max_length=2000)


class IntentChoice(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: WorkspaceKind
    view: (
        Literal[
            "overview",
            "quality",
            "capacity",
            "delivery",
            "latest_changes",
            "remediation",
            "assumptions",
            "evidence",
            "source_answer",
            "regulation_brief",
        ]
        | None
    ) = None

    @model_validator(mode="after")
    def validate_view(self):
        allowed = {
            WorkspaceKind.KNOWLEDGE_QA: {None, "source_answer", "regulation_brief"},
            WorkspaceKind.REGULATORY_REVIEW: {None, "latest_changes", "remediation"},
            WorkspaceKind.INVESTMENT_ANALYSIS: {None, "overview", "assumptions"},
            WorkspaceKind.INVESTIGATION_REVIEW: {None, "overview", "evidence"},
            WorkspaceKind.IMPACT: {None, "overview", "quality", "capacity", "delivery"},
            WorkspaceKind.MY_WORK: {None},
            WorkspaceKind.REVIEWS: {None},
        }
        if self.view not in allowed[self.intent]:
            raise ValueError("View is not approved for this workspace.")
        return self


class WorkspaceResolution(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ready", "denied"]
    intent: WorkspaceKind | None = None
    view: str | None = None
    investigation_id: str | None = None
    alert_reference: str | None = None
    message: str


class IntentProvider(Protocol):
    def choose(self, prompt: str) -> IntentChoice | None: ...


class OllamaIntentProvider:
    """The model proposes a catalog entry; the backend still validates authority."""

    def __init__(self, transport: httpx.BaseTransport | None = None):
        self.transport = transport

    def choose(self, prompt: str) -> IntentChoice | None:
        payload = {
            "model": settings.ollama_model,
            "stream": False,
            "think": False,
            "format": IntentChoice.model_json_schema(),
            "options": {
                "temperature": 0,
                "num_ctx": settings.ollama_num_ctx,
                "num_predict": min(128, settings.ollama_num_predict),
            },
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Classify the user's intent into exactly one approved SuperFlow workspace. "
                        "Return only the schema. Do not invent identifiers, facts, permissions, "
                        "calculations, reliability, or business decisions."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        }
        try:
            with httpx.Client(
                timeout=min(settings.ollama_timeout_seconds, 15),
                transport=self.transport,
            ) as client:
                response = client.post(
                    f"{settings.ollama_base_url.rstrip('/')}/api/chat", json=payload
                )
                response.raise_for_status()
            return IntentChoice.model_validate_json(response.json()["message"]["content"])
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            return None


def deterministic_intent(prompt: str) -> IntentChoice:
    text = prompt.lower()
    review_pattern = (
        r"\b(approve\b|approvals\b|review queue|needs my review|"
        r"needs my approval|pending review)"
    )
    if re.search(review_pattern, text):
        return IntentChoice(intent=WorkspaceKind.REVIEWS)
    if re.search(r"\b(aml|fiu|investigat\w*|alert)\b", text):
        return IntentChoice(
            intent=WorkspaceKind.INVESTIGATION_REVIEW,
            view="evidence" if "evidence" in text else "overview",
        )
    if re.search(r"\b(ojk|pojk|padk)\b", text) and not re.search(
        r"remediat|what changed|compare|bandingkan|perubahan|review regulasi", text
    ):
        return IntentChoice(intent=WorkspaceKind.KNOWLEDGE_QA, view="regulation_brief")
    if re.search(r"\b(remediat\w*|regulat\w*|sop impact|policy changes)\b", text):
        return IntentChoice(
            intent=WorkspaceKind.REGULATORY_REVIEW,
            view="remediation" if "remediat" in text else "latest_changes",
        )
    if re.search(r"\b(analyz\w*|analysis|proposal|npv|irr|sensitivity|assumptions)\b", text):
        return IntentChoice(
            intent=WorkspaceKind.INVESTMENT_ANALYSIS,
            view="assumptions" if "assumption" in text else "overview",
        )
    if re.search(r"\b(impact|reliability.*attention|capacity|delivery|backlog)\b", text):
        view = (
            "quality"
            if "reliability" in text or "quality" in text
            else "capacity"
            if "capacity" in text
            else "delivery"
            if "delivery" in text or "slowing" in text
            else "overview"
        )
        return IntentChoice(intent=WorkspaceKind.IMPACT, view=view)
    if re.search(r"\b(my work|need to do|my tasks|my requests)\b", text):
        return IntentChoice(intent=WorkspaceKind.MY_WORK)
    return IntentChoice(intent=WorkspaceKind.KNOWLEDGE_QA)


def allowed_for_role(kind: WorkspaceKind, user: User) -> bool:
    if kind == WorkspaceKind.REGULATORY_REVIEW:
        return user.role_id == "compliance" and user.id != "compliance_checker"
    if kind == WorkspaceKind.INVESTMENT_ANALYSIS:
        return user.role_id == "finance"
    if kind == WorkspaceKind.INVESTIGATION_REVIEW:
        return user.role_id == "compliance"
    if kind == WorkspaceKind.IMPACT:
        return user.role_id in {"manager", "sme", "compliance", "finance", "governance"}
    if kind == WorkspaceKind.REVIEWS:
        return user.role_id in {"manager", "sme", "compliance", "finance", "governance"}
    return True


def resolve_workspace(
    db: Session, user: User, prompt: str, provider: IntentProvider | None = None
) -> WorkspaceResolution:
    deterministic = deterministic_intent(prompt)
    choice = deterministic
    # Explicit, backend-validated workspace requests may switch intent. The LLM
    # may only refine a view unless deterministic language identified the intent.
    if provider and deterministic.intent == WorkspaceKind.KNOWLEDGE_QA and not deterministic.view:
        suggested = provider.choose(prompt)
        if suggested and (
            not isinstance(provider, OllamaIntentProvider)
            or suggested.intent == deterministic.intent
        ):
            choice = suggested
    if not allowed_for_role(choice.intent, user):
        return WorkspaceResolution(
            status="denied",
            message="This workspace is not available to your current role.",
        )
    if choice.intent == WorkspaceKind.INVESTIGATION_REVIEW:
        match = re.search(r"\bAML-\d{4}-\d{3}\b", prompt, re.IGNORECASE)
        if match:
            alert = match.group(0).upper()
            row = db.scalar(select(Investigation).where(Investigation.alert_reference == alert))
            case = db.get(Case, row.case_id) if row else None
            if not case or not can_access_case(db, user, case):
                return WorkspaceResolution(
                    status="denied",
                    message="This workspace is not available to your current role.",
                )
            return WorkspaceResolution(
                status="ready",
                intent=choice.intent,
                view=choice.view,
                investigation_id=case.id,
                alert_reference=alert,
                message=(
                    "Investigation Review is ready. Evidence and decisions come from "
                    "the existing review workspace."
                ),
            )
    return WorkspaceResolution(
        status="ready",
        intent=choice.intent,
        view=choice.view,
        message={
            WorkspaceKind.KNOWLEDGE_QA: "Searching the sources available to your role.",
            WorkspaceKind.REGULATORY_REVIEW: (
                "Opening Regulatory Review with current source versions."
            ),
            WorkspaceKind.INVESTMENT_ANALYSIS: "Opening source-backed Investment Analysis.",
            WorkspaceKind.INVESTIGATION_REVIEW: (
                "Opening your accessible Investigation Review work."
            ),
            WorkspaceKind.IMPACT: "Composing the permitted Impact view.",
            WorkspaceKind.MY_WORK: "Opening your current work.",
            WorkspaceKind.REVIEWS: "Opening reviews assigned to you.",
        }[choice.intent],
    )


router = APIRouter(prefix="/api/workspace-intent")


@router.post("", response_model=WorkspaceResolution)
def classify(
    value: WorkspacePrompt,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    provider = OllamaIntentProvider() if settings.llm_provider == "ollama" else None
    return resolve_workspace(db, user, value.prompt, provider)
