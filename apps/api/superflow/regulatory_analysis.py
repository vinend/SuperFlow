"""Deterministic regulation comparison, impact mapping and gap proposals.

Every output points to stored chunk IDs. Proposals are suggestions for a human reviewer,
never a compliance conclusion. Replaceable through the Protocols below (e.g. an LLM
provider with structured output) without changing persistence or authorization.
"""

import re
from dataclasses import dataclass, field
from typing import Protocol

from .retrieval import tokens

NUMBER_WORDS = {
    word: value
    for value, word in enumerate(
        "zero one two three four five six seven eight nine ten eleven twelve".split()
    )
}
UNIT_DAYS = {"hour": 1 / 24, "day": 1, "week": 7, "month": 30, "year": 365}
QUANTITY = re.compile(
    r"\b(every|within|for)\s+(\d+|"
    + "|".join(NUMBER_WORDS)
    + r")\s+(hour|day|week|month|year)s?\b",
    re.I,
)
# "every"/"within" set an upper bound; "for" (retained for) sets a lower bound.
KINDS = {"every": "frequency", "within": "deadline", "for": "duration"}
QUANTITY_TERMS = set(NUMBER_WORDS) | {f"{unit}s" for unit in UNIT_DAYS} | set(UNIT_DAYS)
COVERAGE_THRESHOLD = 0.5


@dataclass(frozen=True)
class Quantity:
    phrase: str
    value: int
    unit: str

    @property
    def kind(self) -> str:
        return KINDS[self.phrase]

    @property
    def days(self) -> float:
        return self.value * UNIT_DAYS[self.unit]

    @property
    def label(self) -> str:
        prefix = "" if self.phrase == "for" else self.phrase + " "
        return f"{prefix}{self.value} {self.unit}{'' if self.value == 1 else 's'}"

    def satisfies(self, required: "Quantity") -> bool:
        if self.phrase == "for":
            return self.days >= required.days
        return self.days <= required.days


@dataclass(frozen=True)
class Section:
    chunk_id: str
    section: str
    text: str


@dataclass
class Change:
    key: str
    section: str
    change_type: str
    base: Section | None
    target: Section | None
    requirement_changes: list[dict] = field(default_factory=list)
    obligations: list[tuple[str, frozenset[str]]] = field(default_factory=list)

    @property
    def material(self) -> bool:
        return self.change_type in {"ADDED", "REMOVED"} or bool(
            self.requirement_changes or self.obligations
        )

    @property
    def summary(self) -> str:
        if self.change_type == "UNCHANGED":
            return "No change."
        if self.change_type == "ADDED":
            return "New section in the current version."
        if self.change_type == "REMOVED":
            return "Section removed from the current version."
        parts = [
            f"{item['kind'].capitalize()}: {item['before'] or 'not stated'} → "
            f"{item['after'] or 'not stated'}"
            for item in self.requirement_changes
        ]
        if self.obligations:
            count = len(self.obligations)
            parts.append(f"{count} new obligation{'s' if count > 1 else ''}")
        return " · ".join(parts) or "Wording changed; no requirement change detected."


def quantities(text: str) -> list[Quantity]:
    result = []
    for phrase, value, unit in QUANTITY.findall(text):
        number = int(value) if value.isdigit() else NUMBER_WORDS[value.lower()]
        result.append(Quantity(phrase.lower(), number, unit.lower()))
    return result


def sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text.strip()) if part.strip()]


def content_terms(text: str) -> set[str]:
    return {term for term in tokens(text) if term not in QUANTITY_TERMS and not term.isdigit()}


def section_key(section: str, index: int) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", section.lower()).strip("-")[:80] or "section"
    return slug if index == 0 else f"{slug}-{index + 1}"


def article_number(section: str) -> str | None:
    match = re.search(r"\barticle\s+(\d+)\b", section, re.I)
    return match.group(1) if match else None


def topic_terms(section: str) -> set[str]:
    return {
        term for term in tokens(section) if term != "article" and not term.isdigit()
    } - QUANTITY_TERMS


class RegulationComparator(Protocol):
    name: str

    def compare(self, base: list[Section], target: list[Section]) -> list[Change]: ...


class DeterministicComparator:
    """Aligns sections by heading; detects quantity changes and new obligation sentences."""

    name = "deterministic-regulation-compare-v1"

    def compare(self, base: list[Section], target: list[Section]) -> list[Change]:
        def keyed(sections):
            seen: dict[str, int] = {}
            result = {}
            for item in sections:
                index = seen.get(item.section, 0)
                seen[item.section] = index + 1
                result[section_key(item.section, index)] = item
            return result

        old, new = keyed(base), keyed(target)
        changes = []
        for key in list(new) + [key for key in old if key not in new]:
            before, after = old.get(key), new.get(key)
            if before and after:
                kind = "UNCHANGED" if before.text.strip() == after.text.strip() else "MODIFIED"
            else:
                kind = "ADDED" if after else "REMOVED"
            change = Change(key, (after or before).section, kind, before, after)
            if kind == "MODIFIED":
                change.requirement_changes = requirement_changes(before.text, after.text)
                base_terms = content_terms(before.text)
                change.obligations = [
                    (sentence, frozenset(terms))
                    for sentence in sentences(after.text)
                    if (terms := content_terms(sentence) - base_terms)
                ]
            elif kind == "ADDED":
                change.requirement_changes = requirement_changes("", after.text)
                change.obligations = [
                    (sentence, frozenset(content_terms(sentence)))
                    for sentence in sentences(after.text)
                    if content_terms(sentence)
                ]
            changes.append(change)
        return changes


def requirement_changes(before: str, after: str) -> list[dict]:
    old = {item.phrase: item for item in quantities(before)}
    new = {item.phrase: item for item in quantities(after)}
    result = []
    for phrase in list(new) + [phrase for phrase in old if phrase not in new]:
        previous, current = old.get(phrase), new.get(phrase)
        if previous and current and previous.days == current.days:
            continue
        result.append(
            {
                "kind": KINDS[phrase],
                "before": previous.label if previous else None,
                "after": current.label if current else None,
            }
        )
    return result


@dataclass(frozen=True)
class Candidate:
    """An authorized, current procedure/control section. Built only after can_read passed."""

    document_id: str
    chunk_id: str
    section: str
    text: str
    related: bool


class ImpactMapper(Protocol):
    def map(self, change: Change, candidates: list[Candidate]) -> list[tuple[Candidate, str]]: ...


class ReferenceTopicMapper:
    """Explicit article references from related sources, then exact topic-term matches."""

    def map(self, change: Change, candidates: list[Candidate]) -> list[tuple[Candidate, str]]:
        number = article_number(change.section)
        topic = topic_terms(change.section)
        result = []
        for candidate in candidates:
            body = set(tokens(candidate.section + " " + candidate.text))
            if (
                number
                and candidate.related
                and re.search(rf"\barticle\s+{number}\b", candidate.text, re.I)
            ):
                result.append((candidate, "explicit_reference"))
            elif topic and topic <= body:
                result.append((candidate, "topic_match"))
        return result


class GapAnalyzer(Protocol):
    def issues(self, change: Change, candidate: Candidate) -> list[dict]: ...


class DeterministicGapAnalyzer:
    """Flags changed requirements the section no longer meets and uncovered new obligations."""

    def issues(self, change: Change, candidate: Candidate) -> list[dict]:
        if change.target is None:
            return []
        result = []
        required = {item.phrase: item for item in quantities(change.target.text)}
        stated = {item.phrase: item for item in quantities(candidate.text)}
        for item in change.requirement_changes:
            phrase = next(key for key, kind in KINDS.items() if kind == item["kind"])
            need, have = required.get(phrase), stated.get(phrase)
            if need and have and not have.satisfies(need):
                result.append(
                    {
                        "kind": "requirement_mismatch",
                        "detail": f"The section states {have.label}; the regulation now "
                        f"requires {need.label}.",
                        "current": have.label,
                        "required": need.label,
                    }
                )
        section_terms = set(tokens(candidate.section + " " + candidate.text))
        for sentence, terms in change.obligations:
            if len(terms & section_terms) / len(terms) < COVERAGE_THRESHOLD:
                result.append(
                    {
                        "kind": "missing_obligation",
                        "detail": f"New obligation not reflected: “{sentence}”",
                        "current": None,
                        "required": sentence,
                    }
                )
        return result


def proposed_summary(document_title: str, section: str, change: Change, issues: list[dict]) -> str:
    details = "; ".join(
        f"{issue['current']} instead of {issue['required']}"
        if issue["kind"] == "requirement_mismatch"
        else "a new obligation is not covered"
        for issue in issues
    )
    return f"{document_title} ({section}) does not yet reflect {change.section}: {details}."
