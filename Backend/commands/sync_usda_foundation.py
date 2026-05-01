"""Sync global USDA Foundation Foods into the shared ingredient catalog."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

import httpx
from sqlmodel import Session, select

from Backend.db import engine
from Backend.models import (
    CatalogSyncRun,
    Ingredient,
    IngredientSource,
    IngredientUnit,
    Nutrition,
)
from Backend.routes.usda import _trim_food_payload


SOURCE = "usda"


def _load_json_from_zip_bytes(raw: bytes, location: str) -> Any:
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        json_names = [
            name
            for name in archive.namelist()
            if name.lower().endswith(".json") and not name.endswith("/")
        ]
        if not json_names:
            raise ValueError(f"No JSON file found inside {location}.")
        if len(json_names) > 1:
            foundation_names = [
                name for name in json_names if "foundation" in name.lower()
            ]
            if len(foundation_names) == 1:
                json_names = foundation_names
            else:
                raise ValueError(
                    f"Multiple JSON files found inside {location}; provide an unzipped JSON file."
                )
        with archive.open(json_names[0]) as payload_file:
            return json.load(payload_file)


def _load_payload(location: str) -> Any:
    parsed = urlparse(location)
    if parsed.scheme in {"http", "https"}:
        response = httpx.get(location, timeout=120.0)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if location.lower().endswith(".zip") or "zip" in content_type.lower():
            return _load_json_from_zip_bytes(response.content, location)
        return response.json()
    path = Path(location)
    if path.suffix.lower() == ".zip":
        return _load_json_from_zip_bytes(path.read_bytes(), location)
    with path.open("r", encoding="utf-8") as payload_file:
        return json.load(payload_file)


def _iter_foods(payload: Any) -> Iterable[dict[str, Any]]:
    if isinstance(payload, list):
        yield from (item for item in payload if isinstance(item, dict))
        return
    if not isinstance(payload, dict):
        return
    for key in ("FoundationFoods", "Foundation Foods", "foods", "Foods"):
        value = payload.get(key)
        if isinstance(value, list):
            yield from (item for item in value if isinstance(item, dict))
            return


def _hash_payload(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _upsert_nutrition(ingredient: Ingredient, nutrition: dict[str, Any] | None) -> None:
    if not nutrition:
        ingredient.nutrition = None
        return
    if ingredient.nutrition is None:
        ingredient.nutrition = Nutrition(**nutrition)
        return
    for field, value in nutrition.items():
        setattr(ingredient.nutrition, field, value)


def _unit_key(name: Any, grams: Any) -> tuple[str, float] | None:
    if not name or grams is None:
        return None
    try:
        grams_value = round(float(grams), 6)
    except (TypeError, ValueError):
        return None
    return (str(name).strip().lower(), grams_value)


def _sync_units(ingredient: Ingredient, units: list[dict[str, Any]]) -> None:
    existing_units = list(ingredient.units or [])
    existing_by_key = {
        key: unit
        for unit in existing_units
        if (key := _unit_key(unit.name, unit.grams)) is not None
    }

    for unit in units:
        key = _unit_key(unit.get("name"), unit.get("grams"))
        if key is None:
            continue
        existing = existing_by_key.get(key)
        if existing is not None:
            existing.name = unit["name"]
            existing.grams = unit["grams"]
            continue
        new_unit = IngredientUnit(name=unit["name"], grams=unit["grams"])
        ingredient.units.append(new_unit)
        existing_by_key[key] = new_unit

    if not any((unit.name or "").strip().lower() == "g" for unit in ingredient.units):
        ingredient.units.append(IngredientUnit(name="g", grams=1))


def sync_usda_foundation(
    session: Session,
    payload: Any,
    *,
    mark_stale: bool = False,
) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    seen_source_ids: set[str] = set()
    summary = {"seen": 0, "created": 0, "updated": 0, "unchanged": 0, "stale": 0}

    for raw_food in _iter_foods(payload):
        trimmed = _trim_food_payload(raw_food)
        source_id = trimmed.get("id")
        name = trimmed.get("name")
        if source_id is None or not name:
            continue
        source_id = str(source_id)
        seen_source_ids.add(source_id)
        summary["seen"] += 1
        payload_hash = _hash_payload(trimmed)

        source_row = session.exec(
            select(IngredientSource).where(
                IngredientSource.source == SOURCE,
                IngredientSource.source_id == source_id,
            )
        ).one_or_none()

        if source_row is None:
            ingredient = Ingredient(name=name, user_id=None)
            _upsert_nutrition(ingredient, trimmed.get("nutrition"))
            _sync_units(ingredient, trimmed.get("units") or [])
            ingredient.sources.append(
                IngredientSource(
                    source=SOURCE,
                    source_id=source_id,
                    payload_hash=payload_hash,
                    last_synced_at=now,
                    is_stale=False,
                )
            )
            session.add(ingredient)
            summary["created"] += 1
            continue

        ingredient = source_row.ingredient
        if ingredient is None:
            continue
        changed = source_row.payload_hash != payload_hash or ingredient.name != name
        if changed:
            ingredient.name = name
            ingredient.user_id = None
            _upsert_nutrition(ingredient, trimmed.get("nutrition"))
            _sync_units(ingredient, trimmed.get("units") or [])
            source_row.payload_hash = payload_hash
            summary["updated"] += 1
        else:
            summary["unchanged"] += 1
        source_row.last_synced_at = now
        source_row.is_stale = False
        session.add(ingredient)
        session.add(source_row)

    if mark_stale:
        existing_sources = session.exec(
            select(IngredientSource).where(IngredientSource.source == SOURCE)
        ).all()
        for source_row in existing_sources:
            if source_row.source_id not in seen_source_ids and not source_row.is_stale:
                source_row.is_stale = True
                source_row.last_synced_at = now
                session.add(source_row)
                summary["stale"] += 1

    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        default=os.environ.get("USDA_FOUNDATION_FOODS_JSON"),
        help="Path or URL for a USDA Foundation Foods JSON or ZIP download.",
    )
    parser.add_argument(
        "--mark-stale",
        action="store_true",
        help="Mark existing USDA source rows stale when absent from the input.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.input:
        raise SystemExit(
            "Provide --input or USDA_FOUNDATION_FOODS_JSON pointing to FDC Foundation Foods JSON."
        )

    payload = _load_payload(args.input)
    final_summary: dict[str, Any]
    with Session(engine) as session:
        run = CatalogSyncRun(source=SOURCE, status="running", summary={})
        session.add(run)
        session.commit()
        session.refresh(run)
        try:
            summary = sync_usda_foundation(session, payload, mark_stale=args.mark_stale)
            run.status = "completed"
            run.summary = summary
            run.completed_at = datetime.now(timezone.utc)
            session.add(run)
            session.commit()
            final_summary = summary
        except Exception as exc:
            session.rollback()
            final_summary = {"error": str(exc)}
            run.status = "failed"
            run.summary = final_summary
            run.completed_at = datetime.now(timezone.utc)
            session.add(run)
            session.commit()
            raise

    print(json.dumps(final_summary, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
