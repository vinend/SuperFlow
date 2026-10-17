"""Question-scoped external evidence and local browser search outcomes."""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("question_runs", sa.Column("web_search_result", sa.JSON(), nullable=True))
    with op.batch_alter_table("documents") as batch:
        batch.add_column(sa.Column("context_run_id", sa.String(40), nullable=True))
        batch.create_foreign_key(
            "fk_documents_context_run", "question_runs", ["context_run_id"], ["id"]
        )
    op.create_index("ix_documents_context_run_id", "documents", ["context_run_id"])


def downgrade():
    op.drop_index("ix_documents_context_run_id", table_name="documents")
    with op.batch_alter_table("documents") as batch:
        batch.drop_constraint("fk_documents_context_run", type_="foreignkey")
        batch.drop_column("context_run_id")
    op.drop_column("question_runs", "web_search_result")
