"""Deterministic checks for extractive knowledge answers; no autonomous actions."""

import re
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import can_read
from .models import Document, DocumentChunk, DocumentVersion, User
from .reliability_contracts import (
    ActiveReplacement,
    EvidenceItem,
    GuardCheckResult,
    GuardResult,
    ReliabilityStatus,
    SourceReference,
)
from .retrieval import tokens
from .schemas import AskInput


@dataclass(frozen=True)
class CalculationItem:
    """A required calculation input, resolved by a domain service from stored sources."""

    key: str
    label: str
    status: str  # available | missing | conflicting
    chunk_ids: tuple[str, ...]
    details: str


@dataclass(frozen=True)
class CalculationInput:
    items: tuple[CalculationItem, ...]
    details: str


@dataclass(frozen=True)
class GuardInput:
    user: User
    query: AskInput
    sources: list[dict]
    answer: str
    restricted_match: bool = False
    action: str | None = None
    evidence: tuple[EvidenceItem, ...] = ()
    calculation: CalculationInput | None = None


class ConflictDetector(Protocol):
    def detect(self, sources: list[dict]) -> list[EvidenceItem]: ...


def reference(source: dict) -> SourceReference:
    return SourceReference(**{key: source[key] for key in SourceReference.model_fields})


class ExplicitConflictDetector:
    """Only an explicit scoped numeric claim; never compare unrelated free-form numbers."""

    pattern = re.compile(r"review access rights every (\d+) months", re.I)

    def detect(self, sources: list[dict]) -> list[EvidenceItem]:
        claims = [
            (source, match.group(1))
            for source in sources
            if source["status"] == "active" and source["authority_level"] >= 4
            if (match := self.pattern.search(source["excerpt"]))
        ]
        if len({value for _, value in claims}) < 2:
            return []
        return [
            EvidenceItem(
                key="access_review_interval",
                label="Access review interval",
                required=True,
                status="conflicting",
                source_refs=[reference(source) for source, _ in claims],
                details="Current authoritative sources disagree on the access review interval: "
                + "; ".join(f"{source['title']}: {value} months" for source, value in claims)
                + ".",
            )
        ]


def restricted_relevance(db: Session, user: User, query: AskInput) -> bool:
    """Safe metadata-only existence signal; NEVER read denied versions or chunks.

    A source filter alone is not an existence oracle. Require at least two title terms
    and half the title vocabulary. Denied title/ID/owner are never returned.
    """
    question_terms = set(tokens(query.question))
    for document in db.scalars(select(Document)):
        if can_read(user, document):
            continue
        if query.domain and document.domain != query.domain:
            continue
        if query.document_ids and document.id not in query.document_ids:
            continue
        title_terms = set(tokens(document.title))
        overlap = question_terms & title_terms
        if len(overlap) >= 2 and len(overlap) >= len(title_terms) / 2:
            return True
    return False


class SuperFlowGuard:
    def __init__(self, conflict_detector: ConflictDetector | None = None):
        self.conflicts = conflict_detector or ExplicitConflictDetector()

    def evaluate(self, db: Session, value: GuardInput) -> GuardResult:
        checks = {}
        reasons = []
        evidence = []
        sources = value.sources
        refs = [reference(source) for source in sources]

        def check(name, passed, details, applicable=True):
            checks[name] = GuardCheckResult(passed=passed, details=details, applicable=applicable)
            if passed is False and applicable:
                reasons.append(details)

        valid, permission = bool(sources), not value.restricted_match
        for source in sources:
            # Read only relationship IDs first, then authorize BEFORE reading text.
            identity = db.execute(
                select(DocumentChunk.version_id, DocumentVersion.document_id)
                .join(DocumentVersion, DocumentVersion.id == DocumentChunk.version_id)
                .where(DocumentChunk.id == source["chunk_id"])
            ).first()
            document = db.get(Document, identity.document_id) if identity else None
            if not document or not can_read(value.user, document):
                permission = False
                valid = False
                continue
            chunk = db.get(DocumentChunk, source["chunk_id"])
            version = db.get(DocumentVersion, identity.version_id)
            valid = valid and (
                identity.version_id == source["version_id"]
                and identity.document_id == source["document_id"]
                and chunk.text == source["excerpt"]
                and version.status == source["status"]
                and version.effective_date.isoformat() == str(source["effective_date"])
                and document.authority_level == source["authority_level"]
            )

        check(
            "permission_validity",
            permission,
            "All supporting sources are authorized."
            if permission
            else "Relevant knowledge is unavailable to your role. Consult a knowledge owner.",
        )
        check(
            "source_validity",
            valid,
            "Citations resolve to exact stored chunks."
            if valid
            else "Supporting source content is missing or no longer matches the citation.",
        )

        # Every material paragraph MUST equal a complete retrieved chunk plus its marker.
        # No fuzzy similarity, claims scoring, or confidence percentages.
        expected = {f"{s['excerpt']} [{s['citation_id']}]" for s in sources}
        remaining = value.answer.strip()
        used = set()
        while remaining:
            match = next(
                (
                    part
                    for part in expected
                    if remaining.startswith(part)
                    and (len(remaining) == len(part) or remaining[len(part) :].startswith("\n\n"))
                ),
                None,
            )
            if match is None:
                break
            used.add(match)
            remaining = remaining[len(match) :].strip()
        covered = bool(expected) and not remaining and used == expected
        check(
            "citation_coverage",
            covered,
            "Every answer extract exactly matches its cited retrieved chunk."
            if covered
            else "A material answer extract is missing a matching source and citation.",
        )

        authority = bool(sources) and all(s["authority_level"] >= 4 for s in sources)
        check(
            "source_authority",
            authority,
            "Sources meet the approved-authority threshold (4 or 5)."
            if authority
            else "Source authority is below the approved threshold or no approved source exists.",
        )
        outdated = any(s["status"] == "outdated" for s in sources)
        current = bool(sources) and all(
            s["status"] == "active" and date.fromisoformat(str(s["effective_date"])) <= date.today()
            for s in sources
        )
        draft = any(s["status"] == "draft" for s in sources)
        check(
            "version_validity",
            current,
            "All supporting versions are active and effective."
            if current
            else "Historical sources are included; they are not current authority."
            if outdated
            else "An active, effective source version is required; "
            "draft sources cannot support an answer.",
        )

        for source in sources:
            evidence.append(
                EvidenceItem(
                    key=source["chunk_id"],
                    label=source["title"],
                    required=False,
                    status="available",
                    source_refs=[reference(source)],
                    details=f"v{source['version']} · {source['section_path']}",
                )
            )
        words = set(tokens(value.query.question))
        # Public code-defined requirement, independent from inaccessible document metadata.
        receipt_exception = "receipt" in words and bool(words & {"without", "missing", "lost"})
        if receipt_exception:
            supporting = [
                s
                for s in sources
                if set(tokens(s["title"])) == {"receipt", "exception", "authority", "policy"}
                and s["status"] == "active"
                and s["authority_level"] >= 4
            ]
            evidence.append(
                EvidenceItem(
                    key="receipt_exception_authority",
                    label="Receipt exception authority",
                    required=True,
                    status="available" if supporting else "missing",
                    source_refs=[reference(s) for s in supporting],
                    details="An approved receipt exception policy is required "
                    "to conclude an exception.",
                )
            )
        if not sources:
            evidence.append(
                EvidenceItem(
                    key="supporting_source",
                    label="Supporting knowledge source",
                    required=True,
                    status="missing",
                    details="No permitted supporting evidence was retrieved.",
                )
            )
        conflicts = self.conflicts.detect(sources)
        evidence.extend(conflicts)
        # The access-review rule needs both current sources; filtering one cannot imply agreement.
        if {"access", "review"} <= words:
            for doc_id, label in [
                ("access-sop", "Access review procedure"),
                ("access-review-policy", "Access review control policy"),
            ]:
                matching = [
                    s for s in sources if s["document_id"] == doc_id and s["status"] == "active"
                ]
                evidence.append(
                    EvidenceItem(
                        key=doc_id,
                        label=label,
                        required=True,
                        status="available" if matching else "missing",
                        source_refs=[reference(s) for s in matching],
                        details="Both current references are needed "
                        "to assess access review guidance.",
                    )
                )
        # Case requirements reuse the evidence contract. Available evidence must point
        # to an actual authorized, current, approved source in this evaluated context.
        for item in value.evidence:
            supporting = [
                s
                for s in sources
                if any(reference(s) == ref for ref in item.source_refs)
                and s["status"] == "active"
                and s["authority_level"] >= 4
            ]
            evidence.append(
                item.model_copy(
                    update={
                        "status": "available" if supporting else "missing",
                        "source_refs": [reference(s) for s in supporting],
                    }
                )
            )
        # Calculation inputs reuse the evidence contract; references must be in this context.
        calculation = value.calculation
        for item in calculation.items if calculation else ():
            evidence.append(
                EvidenceItem(
                    key="calculation:" + item.key,
                    label=item.label,
                    required=True,
                    status=item.status,
                    source_refs=[reference(s) for s in sources if s["chunk_id"] in item.chunk_ids],
                    details=item.details,
                )
            )
        conflicts = conflicts + [
            e for e in evidence if e.key.startswith("calculation:") and e.status == "conflicting"
        ]
        complete = not any(item.required and item.status == "missing" for item in evidence)
        missing = [item.label for item in evidence if item.required and item.status == "missing"]
        check(
            "evidence_completeness",
            complete,
            "Required evidence is available."
            if complete
            else "Missing required evidence: " + ", ".join(missing) + ".",
        )
        check(
            "conflict_detection",
            not conflicts,
            conflicts[0].details
            if conflicts
            else "No conflict found by the configured access-review claim rule; "
            "semantic detection is not performed.",
        )
        if calculation:
            ready = all(item.status == "available" for item in calculation.items)
            check("calculation_validity", ready, calculation.details)
        else:
            check(
                "calculation_validity",
                None,
                "Not applicable: this context involves no calculation.",
                False,
            )
        review = bool(conflicts) or (bool(sources) and not authority)
        check(
            "human_review_requirement",
            not review and value.action is None,
            "Human judgment is required before applying this guidance."
            if review
            else "Actions are outside Phase 2; this request cannot continue."
            if value.action
            else "No review requirement was found by the configured knowledge rules.",
        )

        if not permission:
            status = ReliabilityStatus.ACCESS_RESTRICTED
        elif not valid or not covered or not complete or draft or value.action:
            status = ReliabilityStatus.BLOCKED
        elif conflicts:
            status = ReliabilityStatus.REVIEW_REQUIRED
        elif outdated:
            status = ReliabilityStatus.OUTDATED
        elif not current:
            status = ReliabilityStatus.BLOCKED
        elif review:
            status = ReliabilityStatus.REVIEW_REQUIRED
        else:
            status = ReliabilityStatus.VERIFIED
        summaries = {
            ReliabilityStatus.VERIFIED: "Supported by current approved sources.",
            ReliabilityStatus.REVIEW_REQUIRED: "Conflicting guidance or source authority "
            "requires human review.",
            ReliabilityStatus.BLOCKED: "Required evidence or a safety prerequisite is missing.",
            ReliabilityStatus.OUTDATED: "Historical source content; "
            "inspect the active replacement.",
            ReliabilityStatus.ACCESS_RESTRICTED: "Relevant knowledge is unavailable to your role.",
        }
        next_steps = {
            ReliabilityStatus.VERIFIED: "Inspect the cited source before applying this guidance.",
            ReliabilityStatus.REVIEW_REQUIRED: "Inspect the evidence and consult a knowledge "
            "owner; no automatic resolution is made.",
            ReliabilityStatus.BLOCKED: "Obtain the missing evidence or ask a knowledge owner; "
            "do not conclude an exception.",
            ReliabilityStatus.OUTDATED: "Open the active version; "
            "historical extracts are not current guidance.",
            ReliabilityStatus.ACCESS_RESTRICTED: "Contact a knowledge owner through "
            "your normal access-request process.",
        }
        replacements = []
        if permission:
            for doc_id in {s["document_id"] for s in sources if s["status"] == "outdated"}:
                document = db.get(Document, doc_id)
                if not document or not can_read(value.user, document):
                    continue
                for version in document.versions:
                    if version.status == "active" and version.effective_date <= date.today():
                        replacements.append(
                            ActiveReplacement(
                                document_id=doc_id,
                                version_id=version.id,
                                title=document.title,
                                version=version.version,
                            )
                        )
        if not permission:
            # A failed defense-in-depth check cannot emit ANY restricted source metadata.
            refs, evidence, replacements = [], [], []
            reasons = [summaries[status]]
            calculation = checks["calculation_validity"]
            checks = {
                name: GuardCheckResult(
                    passed=False if name == "permission_validity" else None,
                    applicable=name == "permission_validity",
                    details=summaries[status]
                    if name == "permission_validity"
                    else "Not returned because access is restricted.",
                )
                for name in checks
            }
            checks["calculation_validity"] = calculation
        actions = (
            ["consult_owner"]
            if status == ReliabilityStatus.ACCESS_RESTRICTED
            else (
                (["inspect_sources"] if refs else [])
                + (["inspect_active_version"] if replacements else [])
                + ([] if status == ReliabilityStatus.VERIFIED else ["consult_owner"])
            )
        )
        return GuardResult(
            status=status,
            checks=checks,
            reasons=list(dict.fromkeys(reasons)),
            evidence=evidence,
            source_refs=refs,
            active_replacements=replacements,
            allowed_actions=actions,
            summary=summaries[status],
            next_step=next_steps[status],
        )
