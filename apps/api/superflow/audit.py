from sqlalchemy import text
from sqlalchemy.orm import Session

from .models import AuditEvent, User


def record(
    db: Session, user: User, run_id: str, event_type: str, *, entity_type="question_run", **payload
) -> None:
    # Digests, relationship IDs and control outcomes only; never copy source text here.
    db.add(
        AuditEvent(
            actor_id=user.id,
            entity_id=run_id,
            entity_type=entity_type,
            event_type=event_type,
            payload=payload,
        )
    )


def demo_reset_mode(db: Session, enabled: bool) -> None:
    """Maintenance escape hatch for the explicit local synthetic reset, not an API action."""
    if db.bind.dialect.name == "postgresql":
        db.execute(
            text("SELECT set_config('superflow.demo_reset', :value, true)"),
            {"value": "on" if enabled else "off"},
        )
