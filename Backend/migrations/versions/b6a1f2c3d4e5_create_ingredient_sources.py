"""create_ingredient_sources

Revision ID: b6a1f2c3d4e5
Revises: aada2c15678d
Create Date: 2026-01-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b6a1f2c3d4e5"
down_revision = "aada2c15678d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ingredient_sources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ingredient_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(["ingredient_id"], ["ingredients.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source",
            "source_id",
            name="uq_ingredient_sources_source_source_id",
        ),
    )
    op.execute(
        """
        INSERT INTO ingredient_sources (ingredient_id, source, source_id)
        SELECT id, source, source_id
        FROM ingredients
        WHERE source IS NOT NULL AND source_id IS NOT NULL
        """
    )
    op.drop_column("ingredients", "source_id")
    op.drop_column("ingredients", "source")


def downgrade():
    op.add_column(
        "ingredients",
        sa.Column("source", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "ingredients",
        sa.Column("source_id", sa.String(length=100), nullable=True),
    )
    op.execute(
        """
        UPDATE ingredients
        SET source = src.source,
            source_id = src.source_id
        FROM (
            SELECT DISTINCT ON (ingredient_id)
                ingredient_id,
                source,
                source_id
            FROM ingredient_sources
            ORDER BY ingredient_id, id
        ) AS src
        WHERE ingredients.id = src.ingredient_id
        """
    )
    op.drop_table("ingredient_sources")
