"""Generate Phase 6 analytics types using the existing Pydantic converter."""

import argparse
import re
import runpy
from pathlib import Path

from superflow.analytics_contracts import AnalyticsContracts

ROOT = Path(__file__).resolve().parents[1]
convert = runpy.run_path(str(ROOT / "scripts/generate-reliability.py"))["ts"]


def compatible(node):
    """The shared converter supports anyOf; normalize discriminated oneOf to it."""
    if isinstance(node, list):
        return [compatible(item) for item in node]
    if not isinstance(node, dict):
        return node
    result = {
        key: compatible(value) for key, value in node.items() if key != "discriminator"
    }
    if "oneOf" in result:
        result["anyOf"] = result.pop("oneOf")
    return result


def generated():
    schema = AnalyticsContracts.model_json_schema()
    output = "// Generated from superflow.analytics_contracts. Do not edit.\n"
    for name, node in schema["$defs"].items():
        output += f"export type {name} = {convert(compatible(node))};\n"
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = ROOT / "apps/web/lib/analytics-contracts.ts"
    if args.check:

        def normalize(value):
            value = re.sub(r"([=<:(])\s*\|", r"\1", value)
            return "".join(re.sub(r",(?=\s*[\]}>])", "", value).split())

        assert normalize(target.read_text()) == normalize(generated()), (
            "Regenerate analytics types."
        )
    else:
        target.write_text(generated(), encoding="utf-8")


if __name__ == "__main__":
    main()
