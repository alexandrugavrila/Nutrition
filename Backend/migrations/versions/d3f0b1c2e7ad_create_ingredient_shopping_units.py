"""Create table for preferred ingredient shopping units."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d3f0b1c2e7ad"
down_revision = "1a2b3c4d5e66"
branch_labels = None
depends_on = None


def upgrade():
    """Create ingredient_shopping_units table."""
    op.create_unique_constraint(
        "uq_ingredient_units_ingredient_id_id",
        "ingredient_units",
        ["ingredient_id", "id"],
    )
    op.create_table(
        "ingredient_shopping_units",
        sa.Column("ingredient_id", sa.Integer(), nullable=False),
        sa.Column("unit_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["ingredient_id"],
            ["ingredients.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["unit_id"],
            ["ingredient_units.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["ingredient_id", "unit_id"],
            ["ingredient_units.ingredient_id", "ingredient_units.id"],
            name="fk_shopping_unit_matches_ingredient",
        ),
        sa.PrimaryKeyConstraint("ingredient_id"),
    )


def downgrade():
    """Drop ingredient_shopping_units table."""
    op.drop_table("ingredient_shopping_units")
    op.drop_constraint(
        "uq_ingredient_units_ingredient_id_id",
        "ingredient_units",
        type_="unique",
    )
