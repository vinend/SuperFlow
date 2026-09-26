"""Immutable, versioned code-defined generic workflows. No domain-specific actions."""

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
GENERIC_REVIEW["config"] = DefinitionConfig.model_validate(GENERIC_REVIEW["config"]).model_dump(
    mode="json"
)
