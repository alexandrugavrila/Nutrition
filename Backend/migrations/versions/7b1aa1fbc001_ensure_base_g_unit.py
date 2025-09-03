"""Ensure every ingredient has base 'g' unit (grams==1)

Revision ID: 7b1aa1fbc001
Revises: 4f3a5b7c9d01
Create Date: 2025-09-03 00:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7b1aa1fbc001"
down_revision = "4f3a5b7c9d01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # 1) Correct any existing 'g' units that don't have grams == 1
    bind.execute(
        sa.text(
            """
            UPDATE ingredient_units
            SET grams = 1
            WHERE lower(name) = 'g' AND grams <> 1
            """
        )
    )
    # 2) Insert a base unit 'g' with grams == 1 for every ingredient missing it
    bind.execute(
        sa.text(
            """
            INSERT INTO ingredient_units (ingredient_id, name, grams)
            SELECT i.id, 'g', 1
            FROM ingredients AS i
            WHERE NOT EXISTS (
                SELECT 1 FROM ingredient_units u
                WHERE u.ingredient_id = i.id
                  AND lower(u.name) = 'g'
            )
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    # Best-effort downgrade: no-op to avoid destructive deletes.
    # If strictly necessary, a custom script can remove 'g' units.
    pass
