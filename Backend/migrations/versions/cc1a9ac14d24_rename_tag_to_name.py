"""rename tag column to name in possible tag tables"""
# Rename tag column to name in possible tag tables

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "cc1a9ac14d24"
down_revision = "1e93c782c25f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("possible_ingredient_tags", "tag", new_column_name="name")
    op.alter_column("possible_meal_tags", "tag", new_column_name="name")


def downgrade() -> None:
    op.alter_column("possible_ingredient_tags", "name", new_column_name="tag")
    op.alter_column("possible_meal_tags", "name", new_column_name="tag")
