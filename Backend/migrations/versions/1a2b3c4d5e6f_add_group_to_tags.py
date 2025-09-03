"""Add group column to possible tags and enforce uniqueness."""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "1a2b3c4d5e6f"
down_revision = "2ea617f76053"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "possible_ingredient_tags",
        sa.Column("group", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "possible_meal_tags",
        sa.Column("group", sa.String(length=50), nullable=True),
    )

    op.drop_constraint(
        "uq_possible_ingredient_tags_name",
        "possible_ingredient_tags",
        type_="unique",
    )
    op.drop_constraint(
        "uq_possible_meal_tags_name",
        "possible_meal_tags",
        type_="unique",
    )

    ingredient_processing = [
        "Whole Food",
        "Lightly Processed",
        "Highly Processed",
    ]
    ingredient_groups = ["Vegetable", "Fruit", "Meat", "Dairy", "Grain"]
    meal_diet = ["Vegetarian", "Vegan", "Carnivore"]
    meal_type = ["Breakfast", "Lunch", "Dinner", "Snack"]

    op.execute(
        sa.text("UPDATE possible_ingredient_tags SET \"group\"='Processing' WHERE name IN :names"),
        {"names": tuple(ingredient_processing)},
    )
    op.execute(
        sa.text("UPDATE possible_ingredient_tags SET \"group\"='Group' WHERE name IN :names"),
        {"names": tuple(ingredient_groups)},
    )
    op.execute(
        sa.text("UPDATE possible_ingredient_tags SET \"group\"='Other' WHERE \"group\" IS NULL")
    )

    op.execute(
        sa.text("UPDATE possible_meal_tags SET \"group\"='Diet' WHERE name IN :names"),
        {"names": tuple(meal_diet)},
    )
    op.execute(
        sa.text("UPDATE possible_meal_tags SET \"group\"='Type' WHERE name IN :names"),
        {"names": tuple(meal_type)},
    )
    op.execute(sa.text("UPDATE possible_meal_tags SET \"group\"='Other' WHERE \"group\" IS NULL"))

    op.alter_column(
        "possible_ingredient_tags",
        "group",
        existing_type=sa.String(length=50),
        nullable=False,
    )
    op.alter_column(
        "possible_meal_tags",
        "group",
        existing_type=sa.String(length=50),
        nullable=False,
    )

    op.create_unique_constraint(
        "uq_possible_ingredient_tags_name_group",
        "possible_ingredient_tags",
        ["name", "group"],
    )
    op.create_unique_constraint(
        "uq_possible_meal_tags_name_group",
        "possible_meal_tags",
        ["name", "group"],
    )


def downgrade():
    op.drop_constraint(
        "uq_possible_ingredient_tags_name_group",
        "possible_ingredient_tags",
        type_="unique",
    )
    op.drop_constraint(
        "uq_possible_meal_tags_name_group",
        "possible_meal_tags",
        type_="unique",
    )

    op.create_unique_constraint(
        "uq_possible_ingredient_tags_name",
        "possible_ingredient_tags",
        ["name"],
    )
    op.create_unique_constraint(
        "uq_possible_meal_tags_name",
        "possible_meal_tags",
        ["name"],
    )

    op.drop_column("possible_ingredient_tags", "group")
    op.drop_column("possible_meal_tags", "group")
