from __future__ import annotations

from typing import Any, Iterable

import httpx
from fastapi import APIRouter, HTTPException, Query

from Backend.settings import settings

router = APIRouter(prefix="/usda", tags=["usda"])

_BASE_URL = "https://api.nal.usda.gov/fdc/v1"
_MACRO_NAMES = {
    "energy": "calories",
    "protein": "protein_g",
    "total lipid (fat)": "fat_g",
    "carbohydrate, by difference": "carbs_g",
}


def _require_api_key() -> str:
    if not settings.usda_api_key:
        raise HTTPException(
            status_code=503,
            detail="USDA API key is not configured. Set USDA_API_KEY in .env.",
        )
    return settings.usda_api_key


def _coerce_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_name(raw: str | None) -> str:
    return (raw or "").strip().lower()


def _extract_nutrient_name(entry: dict[str, Any]) -> str:
    name = entry.get("nutrientName")
    if name:
        return str(name)
    nutrient = entry.get("nutrient") or {}
    return str(nutrient.get("name") or "")


def _extract_nutrient_value(entry: dict[str, Any]) -> float | None:
    return _coerce_float(entry.get("value", entry.get("amount")))


def _trim_nutrients(food_nutrients: Iterable[dict[str, Any]]) -> dict[str, float | None]:
    macros: dict[str, float | None] = {value: None for value in _MACRO_NAMES.values()}
    for nutrient in food_nutrients:
        name = _normalize_name(_extract_nutrient_name(nutrient))
        if name in _MACRO_NAMES:
            macros[_MACRO_NAMES[name]] = _extract_nutrient_value(nutrient)
    return macros


def _trim_food_payload(food: dict[str, Any]) -> dict[str, Any]:
    nutrients = _trim_nutrients(food.get("foodNutrients", []))
    return {
        "fdc_id": food.get("fdcId"),
        "name": food.get("description"),
        "nutrients": nutrients,
    }


@router.get("/search")
async def search_foods(query: str = Query(..., min_length=1)) -> dict[str, Any]:
    api_key = _require_api_key()
    params = {"query": query, "pageSize": 25, "api_key": api_key}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{_BASE_URL}/foods/search", params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502, detail=f"USDA API request failed: {exc}"
            ) from exc

    payload = response.json()
    foods = [_trim_food_payload(food) for food in payload.get("foods", [])]
    return {"foods": foods}


@router.get("/foods/{fdc_id}")
async def get_food_details(fdc_id: int) -> dict[str, Any]:
    api_key = _require_api_key()
    params = {"api_key": api_key}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{_BASE_URL}/food/{fdc_id}", params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502, detail=f"USDA API request failed: {exc}"
            ) from exc

    return _trim_food_payload(response.json())
