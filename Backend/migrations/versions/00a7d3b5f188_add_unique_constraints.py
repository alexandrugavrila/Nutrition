"""Initial schema with unique constraints."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "00a7d3b5f188"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Create all tables with the required unique constraints."""
    op.create_table(
        "ingredients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.UniqueConstraint("name", name="uq_ingredients_name"),
    )
    op.create_table(
        "possible_ingredient_tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.UniqueConstraint("name", name="uq_possible_ingredient_tags_name"),
    )
    op.create_table(
        "possible_meal_tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.UniqueConstraint("name", name="uq_possible_meal_tags_name"),
    )
    op.create_table(
        "ingredient_units",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ingredient_id", sa.Integer(), sa.ForeignKey("ingredients.id"), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("grams", sa.Numeric(10, 4), nullable=False),
    )
    op.create_table(
        "nutrition",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ingredient_id", sa.Integer(), sa.ForeignKey("ingredients.id"), nullable=False),
        sa.Column("calories", sa.Numeric(10, 4), nullable=False),
        sa.Column("fat", sa.Numeric(10, 4), nullable=False),
        sa.Column("carbohydrates", sa.Numeric(10, 4), nullable=False),
        sa.Column("protein", sa.Numeric(10, 4), nullable=False),
        sa.Column("fiber", sa.Numeric(10, 4), nullable=False),
    )
    op.create_table(
        "meals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.UniqueConstraint("name", name="uq_meals_name"),
    )
    op.create_table(
        "meal_ingredients",
        sa.Column("ingredient_id", sa.Integer(), sa.ForeignKey("ingredients.id"), primary_key=True),
        sa.Column("meal_id", sa.Integer(), sa.ForeignKey("meals.id"), primary_key=True),
        sa.Column("unit_id", sa.Integer(), sa.ForeignKey("ingredient_units.id"), nullable=True),
        sa.Column("unit_quantity", sa.Numeric(10, 4), nullable=True),
    )
    op.create_table(
        "ingredient_tags",
        sa.Column("ingredient_id", sa.Integer(), sa.ForeignKey("ingredients.id"), primary_key=True),
        sa.Column(
            "tag_id",
            sa.Integer(),
            sa.ForeignKey("possible_ingredient_tags.id"),
            primary_key=True,
        ),
    )
    op.create_table(
        "meal_tags",
        sa.Column("meal_id", sa.Integer(), sa.ForeignKey("meals.id"), primary_key=True),
        sa.Column(
            "tag_id",
            sa.Integer(),
            sa.ForeignKey("possible_meal_tags.id"),
            primary_key=True,
        ),
    )


def downgrade():
    """Drop all tables created in upgrade."""
    op.drop_table("meal_tags")
    op.drop_table("ingredient_tags")
    op.drop_table("meal_ingredients")
    op.drop_table("meals")
    op.drop_table("nutrition")
    op.drop_table("ingredient_units")
    op.drop_table("possible_meal_tags")
    op.drop_table("possible_ingredient_tags")
    op.drop_table("ingredients")
