"""add unique constraints to names and tags"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "00a7d3b5f188"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint("uq_ingredients_name", "ingredients", ["name"])
    op.create_unique_constraint("uq_meals_name", "meals", ["name"])
    op.create_unique_constraint(
        "uq_possible_ingredient_tags_tag", "possible_ingredient_tags", ["tag"]
    )
    op.create_unique_constraint(
        "uq_possible_meal_tags_tag", "possible_meal_tags", ["tag"]
    )


def downgrade():
    op.drop_constraint(
        "uq_possible_meal_tags_tag", "possible_meal_tags", type_="unique"
    )
    op.drop_constraint(
        "uq_possible_ingredient_tags_tag", "possible_ingredient_tags", type_="unique"
    )
    op.drop_constraint("uq_meals_name", "meals", type_="unique")
    op.drop_constraint("uq_ingredients_name", "ingredients", type_="unique")
