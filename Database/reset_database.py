"""Recreate the PostgreSQL nutrition database schema and import CSV data.

This utility drops all existing tables, rebuilds them using the schema SQL file,
and then populates the tables from CSV files in the ``production_data`` or
``test_data`` directory.
"""

import os
import argparse
import psycopg2
from import_from_csv import get_table_order, import_csv
from db_config import DB_CONFIG, BASE_DIR

SQL_FILE = os.path.join(BASE_DIR, "01-createtables.sql")

def drop_all_tables(cur):
    ordered = get_table_order(cur)
    for table in reversed(ordered):
        cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")


def create_schema(cur):
    with open(SQL_FILE, "r", encoding="utf-8") as f:
        cur.execute(f.read())


def main():
    parser = argparse.ArgumentParser(description="Recreate tables and import CSV data.")
    parser.add_argument("--test", action="store_true", help="Use test CSV files")
    args = parser.parse_args()

    data_dir = os.path.join(BASE_DIR, "test_data" if args.test else "production_data")
    mode = "TEST" if args.test else "PRODUCTION"
    print(f"Running in {mode} mode — reading from: {data_dir}")

    if not os.path.exists(data_dir):
        print(f"Error: directory {data_dir} does not exist.")
        return

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        drop_all_tables(cur)
        create_schema(cur)
        conn.commit()

        ordered_tables = get_table_order(cur)
        print(f"Load order: {ordered_tables}")
        import_csv(cur, data_dir, ordered_tables)

        conn.commit()
        cur.close()
        conn.close()
        print("Database reset and data imported successfully.")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
