"""Sync global USDA Foundation Foods into the shared ingredient catalog."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import zipfile
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

import httpx
from sqlmodel import Session

from Backend.db import engine
from Backend.models import (
    Ingredient,
    IngredientUnit,
    Nutrition,
)


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
    raise ValueError("Foundation synchronization is disabled pending the reference-safe Phase 9 importer.")


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

    raise SystemExit("Foundation synchronization is disabled pending the reference-safe Phase 9 importer.")



if __name__ == "__main__":
    raise SystemExit(main())
