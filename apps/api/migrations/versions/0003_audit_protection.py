"""Strengthen the applied audit foundation without dropping persisted data."""

from alembic import op

revision = "0003_audit_protection"
down_revision = "0002_reliability_core"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("DROP TRIGGER IF EXISTS audit_no_truncate ON audit_events")
    op.execute("""
        CREATE OR REPLACE FUNCTION superflow_protect_audit() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'DELETE' AND current_setting('superflow.demo_reset', true) = 'on' THEN
                RETURN OLD;
            END IF;
            RAISE EXCEPTION 'Audit events are append-only';
        END $$
    """)
    op.execute("""
        CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit_events
        FOR EACH STATEMENT EXECUTE FUNCTION superflow_protect_audit()
    """)


def downgrade():
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("DROP TRIGGER audit_no_truncate ON audit_events")
    op.execute("""
        CREATE OR REPLACE FUNCTION superflow_protect_audit() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF current_setting('superflow.demo_reset', true) = 'on' THEN
                RETURN OLD;
            END IF;
            RAISE EXCEPTION 'Audit events are append-only';
        END $$
    """)
