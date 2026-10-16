"""Page extraction provenance and persistent model-specific chunk embeddings."""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "document_chunks",
        sa.Column("extraction_method", sa.String(20), nullable=False, server_default="native"),
    )
    op.add_column("document_chunks", sa.Column("page_number", sa.Integer(), nullable=True))
    op.add_column("document_chunks", sa.Column("ocr_confidence", sa.Float(), nullable=True))
    op.create_table(
        "chunk_embeddings",
        sa.Column(
            "chunk_id",
            sa.String(40),
            sa.ForeignKey("document_chunks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("model", sa.String(200), primary_key=True),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("vector", sa.JSON(), nullable=False),
    )


def downgrade():
    op.drop_table("chunk_embeddings")
    op.drop_column("document_chunks", "ocr_confidence")
    op.drop_column("document_chunks", "page_number")
    op.drop_column("document_chunks", "extraction_method")
