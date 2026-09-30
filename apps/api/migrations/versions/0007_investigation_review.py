"""Persistent synthetic investigation and allowlisted tool attempts."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "investigations",
        sa.Column("case_id", sa.String(40), sa.ForeignKey("cases.id"), primary_key=True),
        sa.Column("alert_reference", sa.String(80), nullable=False, unique=True),
        sa.Column("template_id", sa.String(80), nullable=False),
        sa.Column("scenario", sa.String(30), nullable=False),
        sa.Column("subject_reference", sa.String(80), nullable=False),
        sa.Column("context_data", sa.JSON(), nullable=False),
        sa.Column("provenance", sa.JSON(), nullable=False),
        sa.Column("analyst_notes", sa.Text(), nullable=False),
        sa.Column("analyst_recommendation", sa.Text(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "investigation_tool_runs",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column(
            "investigation_id",
            sa.String(40),
            sa.ForeignKey("investigations.case_id"),
            nullable=False,
        ),
        sa.Column("tool_name", sa.String(80), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("request_metadata", sa.JSON(), nullable=False),
        sa.Column("result_metadata", sa.JSON(), nullable=False),
        sa.Column("error_code", sa.String(80)),
        sa.Column("error_summary", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("investigation_id", "tool_name", "attempt_number"),
    )
    op.create_index(
        "ix_investigation_tool_runs_investigation_id",
        "investigation_tool_runs",
        ["investigation_id"],
    )


def downgrade():
    op.drop_index("ix_investigation_tool_runs_investigation_id", "investigation_tool_runs")
    op.drop_table("investigation_tool_runs")
    op.drop_table("investigations")
