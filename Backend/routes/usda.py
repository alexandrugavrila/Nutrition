from __future__ import annotations

from typing import Any, Iterable, Literal

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from Backend.settings import settings

router = APIRouter(prefix="/usda", tags=["usda"])

_BASE_URL = "https://api.nal.usda.gov/fdc/v1"
_MACRO_NAMES = {
    "energy": "calories",
    "protein": "protein",
    "total lipid (fat)": "fat",
    "carbohydrate, by difference": "carbohydrates",
    "fiber, total dietary": "fiber",
}
_GRAM_UNITS = {"g", "gram", "grams"}
_MILLILITER_UNITS = {"ml", "milliliter", "milliliters", "mL"}
_DEFAULT_USDA_DATA_TYPES = ["Foundation"]

BasisType = Literal["per_100g", "per_100ml", "per_serving", "unknown"]
NormalizedBasisType = Literal["per_g"]
USDADataType = Literal[
    "Foundation",
    "SR Legacy",
    "Survey (FNDDS)",
    "Branded",
    "Experimental",
]


class UsdaNutrition(BaseModel):
    calories: float | None = None
    protein: float | None = None
    fat: float | None = None
    carbohydrates: float | None = None
    fiber: float | None = None


class UsdaFoodUnit(BaseModel):
    name: str
    grams: float
    is_default: bool = False


class UsdaNormalizationMetadata(BaseModel):
    data_type: str | None = None
    source_basis: BasisType
    normalized_basis: NormalizedBasisType | None = None
    can_normalize: bool
    reason: str | None = None
    serving_size: float | None = None
    serving_size_unit: str | None = None
    household_serving_full_text: str | None = None


class UsdaFoodSummary(BaseModel):
    id: int | None = None
    name: str | None = None
    nutrition: UsdaNutrition | None = None
    normalization: UsdaNormalizationMetadata
    units: list[UsdaFoodUnit] = Field(default_factory=list)


class UsdaSearchResponse(BaseModel):
    foods: list[UsdaFoodSummary]


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


def _normalize_serving_unit(unit: str | None) -> str | None:
    normalized = (unit or "").strip().lower()
    return normalized or None


def _normalize_unit_label(unit: str | None) -> str:
    return " ".join((unit or "").strip().lower().split())


def _is_gram_unit(unit: str | None) -> bool:
    return _normalize_serving_unit(unit) in _GRAM_UNITS


def _format_quantity(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:g}"


def _build_portion_unit_name(portion: dict[str, Any]) -> str | None:
    portion_description = str(portion.get("portionDescription") or "").strip()
    if portion_description:
        return portion_description

    amount = _coerce_float(portion.get("amount"))
    measure_unit = portion.get("measureUnit") or {}
    measure_name = str(
        measure_unit.get("name")
        or portion.get("measureUnitName")
        or portion.get("measureUnitAbbreviation")
        or portion.get("disseminationText")
        or portion.get("description")
        or portion.get("name")
        or ""
    ).strip()
    modifier = str(portion.get("modifier") or "").strip()

    if amount is not None and measure_name:
        amount_and_measure = f"{_format_quantity(amount)} {measure_name}".strip()
        if modifier and _normalize_name(modifier) not in _normalize_name(amount_and_measure):
            return f"{amount_and_measure} {modifier}".strip()
        return amount_and_measure

    if modifier and measure_name:
        if _normalize_name(modifier) in _normalize_name(measure_name):
            return measure_name
        return f"{measure_name} {modifier}".strip()

    return modifier or measure_name or None


def _build_default_unit(food: dict[str, Any]) -> tuple[str, float] | None:
    serving_size = _coerce_float(food.get("servingSize"))
    serving_size_unit = food.get("servingSizeUnit")
    if serving_size is None or serving_size <= 0 or not _is_gram_unit(serving_size_unit):
        return None

    household_serving_full_text = str(food.get("householdServingFullText") or "").strip()
    if household_serving_full_text:
        name = household_serving_full_text
    else:
        name = "serving"
    return name, serving_size


def _add_usda_unit(
    units: list[dict[str, Any]],
    seen: set[tuple[str, float]],
    *,
    name: str | None,
    grams: float | None,
    is_default: bool = False,
) -> None:
    if grams is None or grams <= 0:
        return

    normalized_name = _normalize_unit_label(name)
    if not normalized_name:
        return

    key = (normalized_name, round(grams, 6))
    for unit in units:
        if (_normalize_unit_label(unit["name"]), round(float(unit["grams"]), 6)) == key:
            unit["is_default"] = unit["is_default"] or is_default
            return

    if key in seen:
        return

    units.append(
        {
            "name": str(name).strip(),
            "grams": grams,
            "is_default": is_default,
        }
    )
    seen.add(key)


def _extract_food_units(food: dict[str, Any]) -> list[dict[str, Any]]:
    units: list[dict[str, Any]] = []
    seen: set[tuple[str, float]] = set()

    _add_usda_unit(units, seen, name="1 g", grams=1.0, is_default=True)

    default_unit = _build_default_unit(food)
    if default_unit is not None:
        for unit in units:
            unit["is_default"] = False
        _add_usda_unit(
            units,
            seen,
            name=default_unit[0],
            grams=default_unit[1],
            is_default=True,
        )

    for key in ("foodPortions", "foodMeasures"):
        for portion in food.get(key, []) or []:
            grams = _coerce_float(portion.get("gramWeight"))
            name = _build_portion_unit_name(portion)
            _add_usda_unit(units, seen, name=name, grams=grams)

    if not any(unit["is_default"] for unit in units) and units:
        units[0]["is_default"] = True

    return units


def _normalize_data_type(data_type: str | None) -> str:
    return (data_type or "").strip().lower()


def _resolve_source_basis(food: dict[str, Any]) -> UsdaNormalizationMetadata:
    data_type = food.get("dataType")
    normalized_data_type = _normalize_data_type(data_type)
    serving_size = _coerce_float(food.get("servingSize"))
    serving_size_unit = food.get("servingSizeUnit")
    normalized_serving_unit = _normalize_serving_unit(serving_size_unit)
    household_serving_full_text = food.get("householdServingFullText")

    metadata = UsdaNormalizationMetadata(
        data_type=str(data_type) if data_type is not None else None,
        source_basis="unknown",
        normalized_basis=None,
        can_normalize=False,
        serving_size=serving_size,
        serving_size_unit=str(serving_size_unit) if serving_size_unit else None,
        household_serving_full_text=(
            str(household_serving_full_text) if household_serving_full_text else None
        ),
    )

    if any(
        marker in normalized_data_type for marker in ("foundation", "sr legacy", "survey", "fndds")
    ):
        metadata.source_basis = "per_100g"
        metadata.normalized_basis = "per_g"
        metadata.can_normalize = True
        return metadata

    if "branded" in normalized_data_type:
        if normalized_serving_unit in _GRAM_UNITS:
            metadata.source_basis = "per_100g"
            metadata.normalized_basis = "per_g"
            metadata.can_normalize = True
            return metadata
        if normalized_serving_unit in _MILLILITER_UNITS:
            metadata.source_basis = "per_100ml"
            metadata.reason = (
                "USDA branded nutrients are standardized to 100 mL for this item, "
                "so they cannot be converted to per-gram values without density data."
            )
            return metadata
        if serving_size is not None:
            metadata.source_basis = "per_serving"
            metadata.reason = (
                "USDA returned a branded serving size, but the serving unit is not grams, "
                "so per-gram normalization would be unsafe."
            )
            return metadata

        metadata.reason = (
            "USDA branded item did not include enough serving metadata to determine a gram basis."
        )
        return metadata

    if "experimental" in normalized_data_type:
        metadata.reason = (
            "USDA Experimental Foods do not provide a consistent gram basis in this import path, "
            "so the app leaves them unnormalized."
        )
        return metadata

    metadata.reason = (
        "USDA payload did not include a supported basis for safe per-gram normalization."
    )
    return metadata


def _normalize_nutrients_per_gram(
    nutrients: dict[str, float | None], metadata: UsdaNormalizationMetadata
) -> UsdaNutrition | None:
    if not metadata.can_normalize or metadata.source_basis != "per_100g":
        return None

    return UsdaNutrition(
        **{key: (value / 100.0 if value is not None else None) for key, value in nutrients.items()}
    )


def _trim_food_payload(food: dict[str, Any]) -> dict[str, Any]:
    nutrients = _trim_nutrients(food.get("foodNutrients", []))
    normalization = _resolve_source_basis(food)
    nutrition = _normalize_nutrients_per_gram(nutrients, normalization)
    return {
        "id": food.get("fdcId"),
        "name": food.get("description"),
        "nutrition": nutrition.model_dump() if nutrition is not None else None,
        "normalization": normalization.model_dump(),
        "units": _extract_food_units(food),
    }


@router.get("/search", response_model=UsdaSearchResponse)
async def search_foods(
    query: str = Query(..., min_length=1),
    data_types: list[USDADataType] | None = Query(default=None),
) -> dict[str, Any]:
    api_key = _require_api_key()
    selected_data_types = data_types or _DEFAULT_USDA_DATA_TYPES
    params = {
        "query": query,
        "pageSize": 25,
        "dataType": selected_data_types,
        "api_key": api_key,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{_BASE_URL}/foods/search", params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"USDA API request failed: {exc}") from exc

    payload = response.json()
    foods = [_trim_food_payload(food) for food in payload.get("foods", [])]
    return {"foods": foods}


@router.get("/foods/{fdc_id}", response_model=UsdaFoodSummary)
async def get_food_details(fdc_id: int) -> dict[str, Any]:
    api_key = _require_api_key()
    params = {"api_key": api_key}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{_BASE_URL}/food/{fdc_id}", params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"USDA API request failed: {exc}") from exc

    return _trim_food_payload(response.json())
