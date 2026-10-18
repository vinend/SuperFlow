"""Owner-scoped conversations, turns and durable process timelines."""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("user_id", sa.String(40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chat_sessions_user_id", "chat_sessions", ["user_id"])
    op.create_table(
        "chat_turns",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("session_id", sa.String(40), sa.ForeignKey("chat_sessions.id"), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("query", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("resolution", sa.JSON()),
        sa.Column("run_id", sa.String(40), sa.ForeignKey("question_runs.id")),
        sa.Column("events", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("session_id", "ordinal", name="uq_chat_turn_ordinal"),
    )
    op.create_index("ix_chat_turns_session_id", "chat_turns", ["session_id"])


def downgrade():
    op.drop_table("chat_turns")
    op.drop_table("chat_sessions")
