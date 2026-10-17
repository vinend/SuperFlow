"""Official PDF source provenance, separate from source/version lifecycle."""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("document_versions", sa.Column("source_provenance", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("document_versions", "source_provenance")
