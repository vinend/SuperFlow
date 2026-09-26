"""Phase 0/1 knowledge foundation. No later-phase tables."""

import sqlalchemy as sa
from alembic import op

revision = "0001_knowledge_core"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "roles",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("permissions", sa.JSON(), nullable=False),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(200), nullable=False, unique=True),
        sa.Column("department", sa.String(100), nullable=False),
        sa.Column("role_id", sa.String(40), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("domain", sa.String(50), nullable=False),
        sa.Column("owner_id", sa.String(40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("authority_level", sa.Integer(), nullable=False),
        sa.Column("access_roles", sa.JSON(), nullable=False),
        sa.Column("related_document_ids", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("authority_level BETWEEN 1 AND 5"),
    )
    op.create_table(
        "document_versions",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column(
            "document_id",
            sa.String(40),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.String(30), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("filename", sa.String(200), nullable=False),
        sa.Column("media_type", sa.String(100), nullable=False),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("file_content", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("document_id", "version", name="uq_document_version"),
        sa.CheckConstraint("status IN ('active', 'outdated', 'draft')"),
    )
    op.create_index(
        "uq_active_version",
        "document_versions",
        ["document_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
        sqlite_where=sa.text("status = 'active'"),
    )
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column(
            "version_id",
            sa.String(40),
            sa.ForeignKey("document_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("section_path", sa.String(300), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.UniqueConstraint("version_id", "ordinal"),
    )
    op.create_table(
        "question_runs",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("user_id", sa.String(40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("outcome", sa.String(30), nullable=False),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("source_refs", sa.JSON(), nullable=False),
        sa.Column("provider", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    for table in [
        "question_runs",
        "document_chunks",
        "document_versions",
        "documents",
        "users",
        "roles",
    ]:
        op.drop_table(table)
