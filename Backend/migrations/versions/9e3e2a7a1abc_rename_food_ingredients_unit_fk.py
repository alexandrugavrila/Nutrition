"""Rename unit_id foreign key constraint on food_ingredients

Revision ID: 9e3e2a7a1abc
Revises: 7b1aa1fbc001
Create Date: 2025-09-03 00:05:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9e3e2a7a1abc"
down_revision = "7b1aa1fbc001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # Postgres-safe rename if the legacy constraint name exists
    bind.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM pg_constraint con
                    JOIN pg_class rel ON rel.oid = con.conrelid
                    WHERE rel.relname = 'food_ingredients'
                      AND con.conname = 'meal_ingredients_unit_id_fkey'
                ) THEN
                    ALTER TABLE food_ingredients
                    RENAME CONSTRAINT meal_ingredients_unit_id_fkey
                    TO food_ingredients_unit_id_fkey;
                END IF;
            END$$;
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    # Reverse rename if the new name exists
    bind.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM pg_constraint con
                    JOIN pg_class rel ON rel.oid = con.conrelid
                    WHERE rel.relname = 'food_ingredients'
                      AND con.conname = 'food_ingredients_unit_id_fkey'
                ) THEN
                    ALTER TABLE food_ingredients
                    RENAME CONSTRAINT food_ingredients_unit_id_fkey
                    TO meal_ingredients_unit_id_fkey;
                END IF;
            END$$;
            """
        )
    )

