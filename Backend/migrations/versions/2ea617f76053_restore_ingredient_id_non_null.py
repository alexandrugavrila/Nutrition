"""restore ingredient_id non-null

Revision ID: 2ea617f76053
Revises: cc1a9ac14d24
Create Date: 2025-08-24 19:40:56.219151
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2ea617f76053'
down_revision = 'cc1a9ac14d24'
branch_labels = None
depends_on = None


def upgrade():
    # Re-apply NOT NULL constraint to ingredient_id columns
    op.alter_column(
        "ingredient_units",
        "ingredient_id",
        existing_type=sa.INTEGER(),
        nullable=False,
    )
    op.alter_column(
        "nutrition",
        "ingredient_id",
        existing_type=sa.INTEGER(),
        nullable=False,
    )


def downgrade():
    # Allow NULL values again if reverting
    op.alter_column(
        "nutrition",
        "ingredient_id",
        existing_type=sa.INTEGER(),
        nullable=True,
    )
    op.alter_column(
        "ingredient_units",
        "ingredient_id",
        existing_type=sa.INTEGER(),
        nullable=True,
    )
