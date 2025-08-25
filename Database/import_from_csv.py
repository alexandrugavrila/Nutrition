"""Import CSV data into the database using the application's models."""

import argparse
import csv
import os
import sys
from collections import defaultdict, deque
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Ensure repository root is on sys.path for module imports
sys.path.append(str(Path(__file__).resolve().parents[1]))

from Backend.models import (
    Ingredient,
    IngredientTagLink,
    IngredientUnit,
    Meal,
    MealIngredient,
    MealTagLink,
    Nutrition,
    PossibleIngredientTag,
    PossibleMealTag,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PORT = int(os.environ.get("DB_PORT", 5432))
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"postgresql://nutrition_user:nutrition_pass@localhost:{DB_PORT}/nutrition",
)
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def get_table_order(session):
    result = session.execute(
        text(
            """
        SELECT tablename
        FROM pg_tables
        WHERE schemaname='public';
    """
        )
    )
    tables = [r[0] for r in result]

    result = session.execute(
        text(
            """
        SELECT
            tc.table_name AS child,
            ccu.table_name AS parent
        FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY';
    """
        )
    )
    deps = defaultdict(set)
    reverse_deps = defaultdict(set)
    for child, parent in result:
        deps[child].add(parent)
        reverse_deps[parent].add(child)

    no_deps = deque([t for t in tables if t not in deps])
    ordered = []
    while no_deps:
        table = no_deps.popleft()
        ordered.append(table)
        for child in reverse_deps[table]:
            deps[child].remove(table)
            if not deps[child]:
                no_deps.append(child)

    return ordered


def wipe_data(session, ordered_tables):
    print("🧹 Wiping existing data...")
    session.execute(
        text(
            f"TRUNCATE TABLE {', '.join(reversed(ordered_tables))} RESTART IDENTITY CASCADE;"
        )
    )


MODEL_MAP = {
    "ingredients": Ingredient,
    "ingredient_units": IngredientUnit,
    "nutrition": Nutrition,
    "possible_ingredient_tags": PossibleIngredientTag,
    "ingredient_tags": IngredientTagLink,
    "meals": Meal,
    "meal_ingredients": MealIngredient,
    "possible_meal_tags": PossibleMealTag,
    "meal_tags": MealTagLink,
}


def import_csv(session, folder, ordered_tables):
    for table in ordered_tables:
        file_path = os.path.join(folder, f"{table}.csv")
        if os.path.exists(file_path):
            print(f"Importing {file_path}...")
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                model = MODEL_MAP.get(table)
                if model is None:
                    print(f"No model found for {table}")
                    continue
                rows = list(reader)
                objects = [model(**row) for row in rows]
                session.add_all(objects)
                try:
                    session.commit()
                except Exception as e:
                    session.rollback()
                    raise RuntimeError(f"Failed importing {table}: {e}") from e
        else:
            print(f"No CSV found for {table}")


def main():
    parser = argparse.ArgumentParser(description="Import CSVs into PostgreSQL.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--production", action="store_true", help="Use production CSV files"
    )
    group.add_argument(
        "--test", action="store_true", help="Use test CSV files (e.g., table_test.csv)"
    )
    args = parser.parse_args()

    data_dir = os.path.join(
        BASE_DIR, "production_data" if args.production else "test_data"
    )

    mode = "PRODUCTION" if args.production else "TEST"
    print(f"Running in {mode} mode — reading from: {data_dir}")

    if not os.path.exists(data_dir):
        print(f"Error: directory {data_dir} does not exist.")
        return

    try:
        session = SessionLocal()

        ordered_tables = get_table_order(session)
        print(f"Load order: {ordered_tables}")

        wipe_data(session, ordered_tables)
        import_csv(session, data_dir, ordered_tables)

        session.commit()
        session.close()
        print("All CSVs imported successfully.")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
