"""Immutable website capture evidence and preview ownership."""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "website_captures",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("actor_id", sa.String(40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "version_id",
            sa.String(40),
            sa.ForeignKey("document_versions.id", ondelete="CASCADE"),
            unique=True,
        ),
    )


def downgrade():
    op.drop_table("website_captures")
