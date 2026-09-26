"""Generate workflow types using the existing Pydantic-to-TypeScript converter."""

import argparse
import re
import runpy
from pathlib import Path

from superflow.reliability_contracts import GuardResult
from superflow.workflow_contracts import WorkflowContracts

ROOT = Path(__file__).resolve().parents[1]
convert = runpy.run_path(str(ROOT / "scripts/generate-reliability.py"))["ts"]


def generated():
    schema = WorkflowContracts.model_json_schema()
    skip = set(GuardResult.model_json_schema()["$defs"]) | {"GuardResult", "Citation"}
    output = "// Generated from superflow.workflow_contracts. Do not edit.\n"
    output += 'import type { GuardResult, EvidenceItem, ReliabilityStatus } from "./reliability-contracts";\n'
    output += 'import type { Source as Citation } from "./api";\n'
    for name, node in schema["$defs"].items():
        if name not in skip:
            output += f"export type {name} = {convert(node)};\n"
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = ROOT / "apps/web/lib/workflow-contracts.ts"
    if args.check:

        def normalize(value):
            value = re.sub(r"([=<:(])\s*\|", r"\1", value)
            return "".join(re.sub(r",(?=\s*[\]}>])", "", value).split())

        assert normalize(target.read_text()) == normalize(generated()), (
            "Regenerate workflow types."
        )
    else:
        target.write_text(generated(), encoding="utf-8")


if __name__ == "__main__":
    main()
