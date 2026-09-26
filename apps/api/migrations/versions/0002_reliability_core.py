"""Guard evaluations linked to existing runs and append-only audit foundation."""

import sqlalchemy as sa
from alembic import op

revision = "0002_reliability_core"
down_revision = "0001_knowledge_core"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "guard_results",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column(
            "run_id",
            sa.String(40),
            sa.ForeignKey("question_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('VERIFIED','REVIEW_REQUIRED','BLOCKED','OUTDATED','ACCESS_RESTRICTED')",
            name="ck_guard_status",
        ),
    )
    op.create_index("ix_guard_results_run_id", "guard_results", ["run_id"])
    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("actor_id", sa.String(40), nullable=False),
        sa.Column("actor_type", sa.String(30), nullable=False),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("entity_type", sa.String(40), nullable=False),
        sa.Column("entity_id", sa.String(40), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_events_actor_id", "audit_events", ["actor_id"])
    op.create_index("ix_audit_events_entity_id", "audit_events", ["entity_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("""
            CREATE FUNCTION superflow_protect_audit() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF current_setting('superflow.demo_reset', true) = 'on' THEN
                    RETURN OLD;
                END IF;
                RAISE EXCEPTION 'Audit events are append-only';
            END $$
        """)
        op.execute("""
            CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_events
            FOR EACH ROW EXECUTE FUNCTION superflow_protect_audit()
        """)


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP TRIGGER audit_append_only ON audit_events")
        op.execute("DROP FUNCTION superflow_protect_audit()")
    op.drop_table("audit_events")
    op.drop_table("guard_results")
