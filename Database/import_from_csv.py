"""Import CSV data into the database using the application's models."""

import argparse
import csv
import json
import os
import sys
from collections import defaultdict, deque
from pathlib import Path

from sqlalchemy import create_engine, text
import subprocess
from sqlalchemy.orm import Session, sessionmaker

# Ensure repository root is on sys.path for module imports
sys.path.append(str(Path(__file__).resolve().parents[1]))

from Backend.models import (
    Ingredient,
    IngredientTagLink,
    IngredientUnit,
    Food,
    FoodIngredient,
    FoodTagLink,
    Nutrition,
    PossibleIngredientTag,
    PossibleFoodTag,
    Plan,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DEV_DB_PORT = int(os.environ.get("DEV_DB_PORT", 5432))
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"postgresql://nutrition_user:nutrition_pass@localhost:{DEV_DB_PORT}/nutrition",
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
    tables = [r[0] for r in result if r[0] != "alembic_version"]

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
    if not ordered_tables:
        # Nothing to wipe; avoid emitting invalid TRUNCATE SQL
        print("🧹 No tables detected; skipping wipe.")
        return
    print("🧹 Wiping existing data...")
    session.execute(
        text(
            f"TRUNCATE TABLE {', '.join(reversed(ordered_tables))} RESTART IDENTITY CASCADE;"
        )
    )
    session.commit()


JSON_FIELDS = {
    "plans": ["payload"],
}

MODEL_MAP = {
    "ingredients": Ingredient,
    "ingredient_units": IngredientUnit,
    "nutrition": Nutrition,
    "possible_ingredient_tags": PossibleIngredientTag,
    "ingredient_tags": IngredientTagLink,
    "foods": Food,
    "food_ingredients": FoodIngredient,
    "possible_food_tags": PossibleFoodTag,
    "food_tags": FoodTagLink,
    "plans": Plan,
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
                json_fields = JSON_FIELDS.get(table, [])
                for row in rows:
                    # Coerce common scalar types from CSV strings
                    # - Primary keys like "id" must be proper ints, not strings
                    if "id" in row and row["id"] not in (None, ""):
                        try:
                            row["id"] = int(row["id"])
                        except (TypeError, ValueError):
                            # Leave as-is; SQLAlchemy will raise a clearer error if invalid
                            pass
                    for field in json_fields:
                        value = row.get(field)
                        if not value:
                            continue
                        try:
                            row[field] = json.loads(value)
                        except json.JSONDecodeError as exc:
                            raise RuntimeError(
                                f"Failed decoding JSON for {table}.{field}: {exc}"
                            ) from exc
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

        def _apply_migrations(reason: str) -> Session:
            print(f"{reason} Applying Alembic migrations (upgrade head)...")
            env_copy = os.environ.copy()
            # Ensure Alembic uses the same DB URL as this script
            dburl = DATABASE_URL
            try:
                subprocess.run(
                    [
                        sys.executable,
                        "-m",
                        "alembic",
                        "-x",
                        f"dburl={dburl}",
                        "upgrade",
                        "head",
                    ],
                    check=True,
                    env=env_copy,
                    cwd=str(Path(__file__).resolve().parents[1]),
                )
            except Exception as e:
                raise RuntimeError(
                    f"Failed to apply Alembic migrations against {dburl}: {e}"
                ) from e

            # Recreate session on a fresh connection after migrations
            try:
                session.close()
            except Exception:
                pass
            try:
                engine.dispose()
            except Exception:
                pass
            return SessionLocal()

        session = _apply_migrations("Ensuring schema is current before import.")
        ordered_tables = get_table_order(session)
        if not ordered_tables:
            session = _apply_migrations(
                "No tables detected after introspection."
            )
            ordered_tables = get_table_order(session)

        # Fallback: if introspection still fails, attempt a conservative static order
        if not ordered_tables:
            static_order = [
                "ingredients",
                "foods",
                "possible_ingredient_tags",
                "possible_food_tags",
                "ingredient_units",
                "nutrition",
                "ingredient_tags",
                "food_tags",
                "food_ingredients",
            ]
            # Verify tables actually exist before proceeding
            existing = []
            for tbl in static_order:
                exists = session.execute(
                    text(
                        "SELECT to_regclass(:reg) IS NOT NULL"
                    ),
                    {"reg": f"public.{tbl}"},
                ).scalar()
                if exists:
                    existing.append(tbl)

            if not existing:
                raise RuntimeError(
                    "No tables detected even after migrations. "
                    "Check DATABASE_URL and migration logs."
                )

            ordered_tables = existing

        print(f"Load order: {ordered_tables}")

        wipe_data(session, ordered_tables)
        import_csv(session, data_dir, ordered_tables)

        # Reset sequences only for tables that actually have an `id` column
        for table in ordered_tables:
            try:
                has_id = session.execute(
                    text(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM information_schema.columns
                            WHERE table_schema = 'public'
                              AND table_name = :tbl
                              AND column_name = 'id'
                        )
                        """
                    ),
                    {"tbl": table},
                ).scalar()

                if not has_id:
                    # Skip join tables or any table without an `id` column
                    continue

                seq = session.execute(
                    text("SELECT pg_get_serial_sequence(:tbl, 'id')"),
                    {"tbl": table},
                ).scalar()

                # If the column isn't backed by a sequence (unlikely), skip
                if not seq:
                    continue

                session.execute(
                    text(
                        "SELECT setval(:seq, (SELECT COALESCE(MAX(id), 0) + 1 FROM "
                        + table
                        + "), false)"
                    ),
                    {"seq": seq},
                )
            except Exception as e:
                # Don't fail the entire import due to a sequence reset issue on a single table
                print(f"Skipping sequence reset for {table}: {e}")
        session.commit()
        session.close()
        print("All CSVs imported successfully.")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
