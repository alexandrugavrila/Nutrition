"""Import CSV files into the PostgreSQL nutrition database.

The script determines table dependency order using foreign key relationships,
clears existing data, and loads table contents from CSV files located in either
the ``production_data`` or ``test_data`` directory.
"""

import os
import psycopg2
import argparse
import csv
from collections import defaultdict, deque

from db_config import DB_CONFIG, BASE_DIR

def get_table_order(cur):
    # Get all public tables
    cur.execute("""
        SELECT tablename
        FROM pg_tables
        WHERE schemaname='public';
    """)
    tables = [r[0] for r in cur.fetchall()]

    # Build dependency graph
    cur.execute("""
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
    """)
    deps = defaultdict(set)
    reverse_deps = defaultdict(set)
    for child, parent in cur.fetchall():
        deps[child].add(parent)
        reverse_deps[parent].add(child)

    # Topological sort (Kahn's algorithm)
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

def wipe_data(cur, ordered_tables):
    print("🧹 Wiping existing data...")
    cur.execute(f"TRUNCATE TABLE {', '.join(reversed(ordered_tables))} RESTART IDENTITY CASCADE;")
    
def import_csv(cur, folder, ordered_tables):
    for table in ordered_tables:
        file_path = os.path.join(folder, f"{table}.csv")
        if os.path.exists(file_path):
            print(f"Importing {file_path}...")
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                headers = next(reader)
                for row in reader:
                    placeholders = ", ".join(["%s"] * len(row))
                    cur.execute(
                        f"INSERT INTO {table} ({', '.join(headers)}) VALUES ({placeholders})",
                        row
                    )
        else:
            print(f"No CSV found for {table}")

def main():
    parser = argparse.ArgumentParser(description="Import CSVs into PostgreSQL.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--production", action="store_true", help="Use production CSV files")
    group.add_argument("--test", action="store_true", help="Use test CSV files (e.g., table_test.csv)")
    args = parser.parse_args()

    data_dir = os.path.join(BASE_DIR, "production_data" if args.production else "test_data")

    mode = "PRODUCTION" if args.production else "TEST"
    print(f"Running in {mode} mode — reading from: {data_dir}")

    if not os.path.exists(data_dir):
        print(f"Error: directory {data_dir} does not exist.")
        return

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        ordered_tables = get_table_order(cursor)
        print(f"Load order: {ordered_tables}")

        wipe_data(cursor, ordered_tables)
        import_csv(cursor, data_dir, ordered_tables)

        conn.commit()
        cursor.close()
        conn.close()
        print("All CSVs imported successfully.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
