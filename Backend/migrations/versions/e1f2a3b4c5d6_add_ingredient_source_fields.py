"""add_ingredient_source_fields

Revision ID: e1f2a3b4c5d6
Revises: c9271ea398b2
Create Date: 2025-09-19 17:45:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e1f2a3b4c5d6"
down_revision = "c9271ea398b2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "ingredients",
        sa.Column("source", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "ingredients",
        sa.Column("source_id", sa.String(length=100), nullable=True),
    )


def downgrade():
    op.drop_column("ingredients", "source_id")
    op.drop_column("ingredients", "source")
