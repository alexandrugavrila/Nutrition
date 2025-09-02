"""rename tables to food"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "3a2af5cf8e9b"
down_revision = "1e93c782c25f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.rename_table("meals", "foods")
    op.rename_table("meal_ingredients", "food_ingredients")
    with op.batch_alter_table("food_ingredients") as batch_op:
        batch_op.alter_column("meal_id", new_column_name="food_id")
        batch_op.drop_constraint("meal_ingredients_meal_id_fkey", type_="foreignkey")
        batch_op.create_foreign_key(None, "foods", ["food_id"], ["id"])
    op.rename_table("meal_tags", "food_tags")
    with op.batch_alter_table("food_tags") as batch_op:
        batch_op.alter_column("meal_id", new_column_name="food_id")
        batch_op.drop_constraint("meal_tags_meal_id_fkey", type_="foreignkey")
        batch_op.create_foreign_key(None, "foods", ["food_id"], ["id"])
    op.rename_table("possible_meal_tags", "possible_food_tags")


def downgrade() -> None:
    op.rename_table("possible_food_tags", "possible_meal_tags")
    with op.batch_alter_table("food_tags") as batch_op:
        batch_op.drop_constraint(None, type_="foreignkey")
        batch_op.alter_column("food_id", new_column_name="meal_id")
        batch_op.create_foreign_key("meal_tags_meal_id_fkey", "meals", ["meal_id"], ["id"])
    op.rename_table("food_tags", "meal_tags")
    with op.batch_alter_table("food_ingredients") as batch_op:
        batch_op.drop_constraint(None, type_="foreignkey")
        batch_op.alter_column("food_id", new_column_name="meal_id")
        batch_op.create_foreign_key("meal_ingredients_meal_id_fkey", "meals", ["meal_id"], ["id"])
    op.rename_table("food_ingredients", "meal_ingredients")
    op.rename_table("foods", "meals")
