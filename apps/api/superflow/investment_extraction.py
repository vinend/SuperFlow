"""Deterministic assumption extraction and input resolution for Investment Analysis.

Every extracted value keeps the stored chunk it came from and the sentence it was read
from. Conflicting values are surfaced; only a human selection resolves them.
"""

import re
from dataclasses import asdict, dataclass
from typing import Protocol

NUMBER_WORDS = {
    word: value
    for value, word in enumerate("zero one two three four five six seven eight nine ten".split())
}
AMOUNT = r"IDR\s*([\d][\d,]*)"
# (key, label, unit, period, origin, pattern)
RULES = [
    (
        "initial_investment",
        "Initial investment",
        "IDR",
        "one-time",
        "proposal",
        rf"initial investment of {AMOUNT}",
    ),
    (
        "initial_investment",
        "Quoted implementation cost",
        "IDR",
        "one-time",
        "quotation",
        rf"quotes {AMOUNT}",
    ),
    (
        "annual_inflow",
        "Annual net cash inflow",
        "IDR",
        "annual",
        "proposal",
        rf"annual net cash inflows? of {AMOUNT}",
    ),
    (
        "periods",
        "Investment term",
        "years",
        "term",
        "proposal",
        r"cash inflows?[^.]*?\bfor (\d+|" + "|".join(NUMBER_WORDS) + r") years",
    ),
    (
        "discount_rate",
        "Discount rate",
        "percent",
        "annual",
        "proposal",
        r"discount rate is (\d+(?:\.\d+)?) percent",
    ),
    (
        "approval_threshold",
        "Manager approval limit",
        "IDR",
        "per investment",
        "policy",
        rf"up to {AMOUNT} require",
    ),
]
YEAR = re.compile(r"\bYear (\d+):\s*(-?[\d][\d,]*)")
REQUIRED = [
    ("initial_investment", "Initial investment", "IDR"),
    ("annual_inflow", "Annual net cash inflow", "IDR"),
    ("periods", "Investment term", "years"),
    ("discount_rate", "Discount rate", "percent"),
    ("approval_threshold", "Approval authority limit", "IDR"),
]


@dataclass(frozen=True)
class SourceChunk:
    """An authorized chunk; built only after can_read passed for its document."""

    chunk_id: str
    text: str


@dataclass(frozen=True)
class Extracted:
    id: str
    key: str
    label: str
    value: float
    unit: str
    period: str
    origin: str
    quote: str
    chunk_id: str

    def as_dict(self) -> dict:
        return asdict(self)


def number(value: str) -> float:
    value = value.lower()
    return float(NUMBER_WORDS[value]) if value in NUMBER_WORDS else float(value.replace(",", ""))


def sentence_at(text: str, position: int) -> str:
    start = max(text.rfind(". ", 0, position) + 2, 0) if ". " in text[:position] else 0
    end = text.find(". ", position)
    return text[start : end + 1 if end != -1 else len(text)].strip()


class AssumptionExtractor(Protocol):
    name: str

    def extract(self, chunk: SourceChunk) -> list[Extracted]: ...


class DeterministicExtractor:
    """Pattern rules for proposal, quotation, projection and approval-policy wording."""

    name = "deterministic-assumption-extract-v1"

    def extract(self, chunk: SourceChunk) -> list[Extracted]:
        found: list[Extracted] = []

        def add(key, label, value, unit, period, origin, position):
            found.append(
                Extracted(
                    id=f"{chunk.chunk_id}:{key}:{len(found)}",
                    key=key,
                    label=label,
                    value=value,
                    unit=unit,
                    period=period,
                    origin=origin,
                    quote=sentence_at(chunk.text, position),
                    chunk_id=chunk.chunk_id,
                )
            )

        for key, label, unit, period, origin, pattern in RULES:
            for match in re.finditer(pattern, chunk.text, re.I):
                add(key, label, number(match.group(1)), unit, period, origin, match.start())
        years = [
            (int(year), number(amount), m.start())
            for m in YEAR.finditer(chunk.text)
            for year, amount in [m.groups()]
        ]
        for year, amount, position in years:
            if year == 0 and amount < 0:
                add(
                    "initial_investment",
                    "Projected Year 0 outflow",
                    -amount,
                    "IDR",
                    "one-time",
                    "projection",
                    position,
                )
            elif year > 0:
                add(
                    "annual_inflow",
                    f"Projected Year {year} inflow",
                    amount,
                    "IDR",
                    "annual",
                    "projection",
                    position,
                )
        if any(year > 0 for year, _, _ in years):
            last = max(years, key=lambda item: item[0])
            add(
                "periods", "Projection term", float(last[0]), "years", "term", "projection", last[2]
            )
        return found


def resolve(assumptions: list[dict], selections: dict) -> list[dict]:
    """One input per required key: consistent, conflict, resolved (human) or missing."""
    result = []
    for key, label, unit in REQUIRED:
        group = [item for item in assumptions if item["key"] == key]
        distinct = {item["value"] for item in group}
        selection = selections.get(key)
        chosen = next(
            (item for item in group if selection and item["id"] == selection["assumption_id"]),
            None,
        )
        if not group:
            status, value = "missing", None
        elif len(distinct) == 1:
            status, value = "consistent", group[0]["value"]
        elif chosen:
            status, value = "resolved", chosen["value"]
        else:
            status, value = "conflict", None
        result.append(
            {
                "key": key,
                "label": label,
                "required": True,
                "status": status,
                "value": value,
                "unit": unit,
                "assumptions": group,
                "selection": selection if chosen and status == "resolved" else None,
            }
        )
    return result
