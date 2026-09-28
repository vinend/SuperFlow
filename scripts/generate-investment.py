"""Generate Investment Intelligence types using the existing Pydantic-to-TypeScript converter."""

import argparse
import re
import runpy
from pathlib import Path

from superflow.investment_contracts import InvestmentContracts
from superflow.reliability_contracts import GuardResult

ROOT = Path(__file__).resolve().parents[1]
convert = runpy.run_path(str(ROOT / "scripts/generate-reliability.py"))["ts"]
SHARED = {"ActivityView", "CaseStatus", "WorkflowStatus"}


def generated():
    schema = InvestmentContracts.model_json_schema()
    skip = set(GuardResult.model_json_schema()["$defs"]) | {"GuardResult", "Citation"} | SHARED
    output = "// Generated from superflow.investment_contracts. Do not edit.\n"
    output += 'import type { GuardResult } from "./reliability-contracts";\n'
    output += 'import type { Source as Citation } from "./api";\n'
    output += (
        "import type { " + ", ".join(sorted(SHARED)) + ' } from "./workflow-contracts";\n'
    )
    for name, node in schema["$defs"].items():
        if name not in skip:
            output += f"export type {name} = {convert(node)};\n"
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = ROOT / "apps/web/lib/investment-contracts.ts"
    if args.check:

        def normalize(value):
            value = re.sub(r"([=<:(])\s*\|", r"\1", value)
            return "".join(re.sub(r",(?=\s*[\]}>])", "", value).split())

        assert normalize(target.read_text()) == normalize(generated()), (
            "Regenerate investment types."
        )
    else:
        target.write_text(generated(), encoding="utf-8")


if __name__ == "__main__":
    main()
