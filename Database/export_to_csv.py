"""Export database tables to CSV files."""

import argparse
import csv
import json
import os
import sys
from pathlib import Path
from typing import Iterable, List

from sqlalchemy import inspect, text

# Ensure repository root is on sys.path for module imports
sys.path.append(str(Path(__file__).resolve().parents[1]))

import import_from_csv as importer

SessionLocal = importer.SessionLocal
MODEL_MAP = importer.MODEL_MAP
JSON_FIELDS = importer.JSON_FIELDS
get_table_order = importer.get_table_order

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def ensure_directory(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def serialise_value(table: str, column: str, value):
    if value is None:
        return ""
    if column in JSON_FIELDS.get(table, []):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def export_table(session, folder: str, table: str, columns: List[str]) -> None:
    order_clause = " ORDER BY id" if "id" in columns else ""
    stmt = text(f"SELECT * FROM {table}{order_clause}")
    rows = session.execute(stmt).mappings()
    file_path = os.path.join(folder, f"{table}.csv")
    with open(file_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({col: serialise_value(table, col, row.get(col)) for col in columns})
    print(f"Exported {table} -> {file_path}")


def filter_tables(ordered: Iterable[str]) -> List[str]:
    allowed = set(MODEL_MAP.keys())
    filtered = []
    skipped = []
    for table in ordered:
        if table in allowed:
            filtered.append(table)
        else:
            skipped.append(table)
    if skipped:
        print(
            "Skipping tables without import mapping: "
            + ", ".join(sorted(skipped))
        )
    return filtered


def main() -> int:
    parser = argparse.ArgumentParser(description="Export database tables to CSV files.")
    group = parser.add_mutually_exclusive_group(required=False)
    group.add_argument("--production", action="store_true", help="Write to production_data")
    group.add_argument("--test", action="store_true", help="Write to test_data")
    parser.add_argument("--output-dir", help="Custom output directory (overrides --production/--test)")
    args = parser.parse_args()

    if args.output_dir:
        target_dir = os.path.abspath(args.output_dir)
    elif args.test:
        target_dir = os.path.join(BASE_DIR, "test_data")
    else:
        # Default to production exports when no flags are supplied.
        target_dir = os.path.join(BASE_DIR, "production_data")

    ensure_directory(target_dir)

    session = SessionLocal()
    try:
        ordered_tables = get_table_order(session)
        if not ordered_tables:
            raise RuntimeError("No tables found to export. Have migrations been applied?")

        tables = filter_tables(ordered_tables)
        if not tables:
            raise RuntimeError("No exportable tables discovered.")

        inspector = inspect(session.bind)
        for table in tables:
            columns = [col["name"] for col in inspector.get_columns(table)]
            if not columns:
                print(f"No columns reported for {table}; skipping")
                continue
            export_table(session, target_dir, table, columns)
    finally:
        session.close()

    print(f"CSV export complete. Files written to {target_dir}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
