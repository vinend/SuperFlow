"""Immutable, versioned code-defined workflows. Domain logic stays outside the engine."""

from .models import WorkflowDefinition
from .workflow_contracts import DefinitionConfig

GENERIC_REVIEW = {
    "id": "generic-review-v1",
    "name": "Generic knowledge review",
    "version": "1.0",
    "domain": "general",
    "config": {
        "steps": [
            {
                "id": "collect_evidence",
                "title": "Inspect and collect evidence",
                "type": "TASK",
                "next": "validate",
            },
            {
                "id": "validate",
                "title": "Evaluate supporting knowledge",
                "type": "GUARD",
                "next": "route_review",
                "max_retries": 2,
                "fallback": "manual_review",
            },
            {
                "id": "route_review",
                "title": "Select human authority",
                "type": "CONDITION",
                "next": "human_review",
                "review_next": "expert_review",
            },
            {
                "id": "human_review",
                "title": "Manager decision",
                "type": "APPROVAL",
                "reviewer_role": "manager",
                "next": "complete",
            },
            {
                "id": "expert_review",
                "title": "Subject matter expert decision",
                "type": "APPROVAL",
                "reviewer_role": "sme",
                "next": "complete",
            },
            {
                "id": "manual_review",
                "title": "Manual fallback review",
                "type": "APPROVAL",
                "reviewer_role": "sme",
                "next": "complete",
            },
            {"id": "complete", "title": "Review completed", "type": "TERMINAL"},
        ]
    },
}
# Confirmed regulatory gaps: the owner updates the procedure/control, Guard re-checks the
# current sources, and an independent approver accepts the remediation.
REGULATORY_REMEDIATION = {
    "id": "regulatory-remediation-v1",
    "name": "Regulatory remediation",
    "version": "1.0",
    "domain": "Compliance",
    "config": {
        "steps": [
            {
                "id": "remediate",
                "title": "Update the procedure or control",
                "type": "TASK",
                "next": "verify_sources",
            },
            {
                "id": "verify_sources",
                "title": "Check supporting sources",
                "type": "GUARD",
                "next": "approve_remediation",
                "max_retries": 2,
                "fallback": "approve_remediation",
            },
            {
                "id": "approve_remediation",
                "title": "Remediation approval",
                "type": "APPROVAL",
                "reviewer_role": "manager",
                "next": "remediation_complete",
            },
            {"id": "remediation_complete", "title": "Remediation complete", "type": "TERMINAL"},
        ]
    },
}


# Investment approval: Guard re-checks sources and calculation inputs, then the authority
# named by the approval-policy source decides. The committee route uses Governance as the
# demo stand-in for an investment committee.
def _investment(definition_id, name, role, title):
    return {
        "id": definition_id,
        "name": name,
        "version": "1.0",
        "domain": "Finance",
        "config": {
            "steps": [
                {
                    "id": "verify_analysis",
                    "title": "Check sources and calculation",
                    "type": "GUARD",
                    "next": "approve_investment",
                    "max_retries": 2,
                    "fallback": "approve_investment",
                },
                {
                    "id": "approve_investment",
                    "title": title,
                    "type": "APPROVAL",
                    "reviewer_role": role,
                    "next": "investment_decided",
                },
                {"id": "investment_decided", "title": "Investment approved", "type": "TERMINAL"},
            ]
        },
    }


INVESTMENT_APPROVAL = _investment(
    "investment-approval-v1", "Investment approval", "manager", "Manager approval"
)
INVESTMENT_COMMITTEE = _investment(
    "investment-committee-v1", "Investment committee approval", "governance", "Committee approval"
)
DEFINITIONS = [GENERIC_REVIEW, REGULATORY_REMEDIATION, INVESTMENT_APPROVAL, INVESTMENT_COMMITTEE]
for _definition in DEFINITIONS:
    _definition["config"] = DefinitionConfig.model_validate(_definition["config"]).model_dump(
        mode="json"
    )


def install(db, definition: dict):
    """Idempotently store a code-defined definition; existing rows are never modified."""
    row = db.get(WorkflowDefinition, definition["id"])
    if row is None:
        row = WorkflowDefinition(**definition)
        db.add(row)
        db.flush()
    return row
