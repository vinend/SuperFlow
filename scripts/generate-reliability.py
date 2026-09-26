"""Generate TypeScript from the canonical Pydantic schema (no new dependency)."""

import argparse
import json
import re
from pathlib import Path

from typing import get_args

from superflow.reliability_contracts import CheckName, GuardResult, ReliabilityStatus

ROOT = Path(__file__).resolve().parents[1]


def ts(node):
    if node is True:
        return "unknown"
    if "const" in node:
        return json.dumps(node["const"])
    if "$ref" in node:
        return node["$ref"].split("/")[-1]
    if "anyOf" in node:
        return " | ".join(ts(item) for item in node["anyOf"])
    if "enum" in node:
        return " | ".join(json.dumps(value) for value in node["enum"])
    kind = node.get("type")
    if kind == "array":
        return f"Array<{ts(node['items'])}>"
    if kind == "object":
        if "properties" not in node:
            keys = node.get("propertyNames", {})
            return f"Record<{ts(keys) if keys else 'string'}, {ts(node['additionalProperties'])}>"
        required = node.get("required", [])
        return (
            "{\n"
            + "\n".join(
                f"  {key}{'' if key in required else '?'}: {ts(value)};"
                for key, value in node["properties"].items()
            )
            + "\n}"
        )
    return {
        "string": "string",
        "integer": "number",
        "number": "number",
        "boolean": "boolean",
        "null": "null",
    }[kind]


def generated():
    schema = GuardResult.model_json_schema()
    result = "// Generated from superflow.reliability_contracts. Do not edit status vocabulary.\n"
    result += (
        "export const RELIABILITY_STATUSES = "
        + json.dumps([item.value for item in ReliabilityStatus])
        + " as const;\n"
    )
    result += (
        "export const GUARD_CHECK_NAMES = "
        + json.dumps(list(get_args(CheckName)))
        + " as const;\n"
    )
    result += (
        "export const GUARD_ACTIONS = "
        + json.dumps(schema["properties"]["allowed_actions"]["items"]["enum"])
        + " as const;\n"
    )
    for name, definition in schema["$defs"].items():
        result += f"export type {name} = {ts(definition)};\n"
    result += f"export type GuardResult = {ts(schema)};\n"
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = ROOT / "apps/web/lib/reliability-contracts.ts"
    # Formatting is delegated to repository Prettier; compare tokens, not whitespace.
    if args.check:

        def normalize(value):
            value = re.sub(r"([=<:(])\s*\|", r"\1", value)
            return "".join(re.sub(r",(?=\s*[\]}>])", "", value).split())

        assert normalize(target.read_text()) == normalize(generated()), (
            "Regenerate reliability types."
        )
    else:
        target.write_text(generated(), encoding="utf-8")


if __name__ == "__main__":
    main()
