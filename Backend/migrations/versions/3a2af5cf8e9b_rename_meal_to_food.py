"""rename tables to food"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "3a2af5cf8e9b"
down_revision = "1e93c782c25f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = set(inspector.get_table_names())

    if "meals" in tables and "foods" not in tables:
        op.rename_table("meals", "foods")
        tables.discard("meals")
        tables.add("foods")

    if "meal_ingredients" in tables and "food_ingredients" not in tables:
        op.rename_table("meal_ingredients", "food_ingredients")
        tables.discard("meal_ingredients")
        tables.add("food_ingredients")

    inspector = sa.inspect(connection)
    with op.batch_alter_table("food_ingredients") as batch_op:
        batch_op.alter_column("meal_id", new_column_name="food_id")
        fk_name = None
        for fk in inspector.get_foreign_keys("food_ingredients"):
            if set(fk.get("constrained_columns", [])) == {"food_id"}:
                fk_name = fk.get("name")
                break

        if fk_name:
            batch_op.drop_constraint(fk_name, type_="foreignkey")
            batch_op.create_foreign_key(None, "foods", ["food_id"], ["id"])
    if "meal_tags" in tables and "food_tags" not in tables:
        op.rename_table("meal_tags", "food_tags")
        tables.discard("meal_tags")
        tables.add("food_tags")
    inspector = sa.inspect(connection)
    with op.batch_alter_table("food_tags") as batch_op:
        batch_op.alter_column("meal_id", new_column_name="food_id")
        fk_name = None
        for fk in inspector.get_foreign_keys("food_tags"):
            if set(fk.get("constrained_columns", [])) == {"food_id"}:
                fk_name = fk.get("name")
                break

        if fk_name:
            batch_op.drop_constraint(fk_name, type_="foreignkey")
            batch_op.create_foreign_key(None, "foods", ["food_id"], ["id"])
    if "possible_meal_tags" in tables and "possible_food_tags" not in tables:
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
