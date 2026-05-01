"""New-user starter dataset instantiation."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlmodel import Session, select

from Backend.models import (
    Food,
    FoodIngredient,
    Ingredient,
    IngredientSource,
    IngredientUnit,
    Nutrition,
    Plan,
    User,
)


STARTER_MANIFEST_PATH = Path(__file__).resolve().parents[1] / "data" / "starter_dataset.v1.json"


def load_starter_manifest(path: Path = STARTER_MANIFEST_PATH) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as manifest_file:
        return json.load(manifest_file)


def _existing_private_ingredient(
    session: Session, user: User, name: str
) -> Ingredient | None:
    return session.exec(
        select(Ingredient)
        .where(Ingredient.user_id == user.id)
        .where(Ingredient.name == name)
    ).one_or_none()


def _existing_food(session: Session, user: User, name: str) -> Food | None:
    return session.exec(
        select(Food).where(Food.user_id == user.id).where(Food.name == name)
    ).one_or_none()


def _existing_plan(session: Session, user: User, label: str) -> Plan | None:
    return session.exec(
        select(Plan).where(Plan.user_id == user.id).where(Plan.label == label)
    ).one_or_none()


def _resolve_sourced_ingredient(
    session: Session, source: str, source_id: str
) -> Ingredient:
    source_row = session.exec(
        select(IngredientSource).where(
            IngredientSource.source == source,
            IngredientSource.source_id == source_id,
        )
    ).one_or_none()
    if source_row is None or source_row.ingredient is None:
        raise HTTPException(
            status_code=500,
            detail=f"Starter dataset references missing source {source}:{source_id}.",
        )
    return source_row.ingredient


def _create_private_ingredient(
    session: Session, user: User, definition: dict[str, Any]
) -> Ingredient:
    existing = _existing_private_ingredient(session, user, definition["name"])
    if existing is not None:
        return existing

    ingredient = Ingredient(name=definition["name"], user_id=user.id)
    nutrition = definition.get("nutrition")
    if nutrition:
        ingredient.nutrition = Nutrition(**nutrition)
    ingredient.units = [
        IngredientUnit(name=unit["name"], grams=unit["grams"])
        for unit in definition.get("units", [])
    ]
    if not any(unit.name == "g" for unit in ingredient.units):
        ingredient.units.append(IngredientUnit(name="g", grams=1))
    session.add(ingredient)
    session.flush()
    return ingredient


def _unit_id_for_ingredient(ingredient: Ingredient, unit_name: str | None) -> int | None:
    units = list(ingredient.units or [])
    if unit_name:
        normalized = unit_name.strip().lower()
        for unit in units:
            if (unit.name or "").strip().lower() == normalized:
                return unit.id
    for unit in units:
        if unit.name == "g":
            return unit.id
    return units[0].id if units else None


def seed_user_starter_data(
    session: Session,
    user: User,
    *,
    manifest: dict[str, Any] | None = None,
) -> dict[str, int]:
    """Create starter private ingredients, foods, and plans for ``user``."""

    manifest = manifest or load_starter_manifest()
    ingredients_by_slug: dict[str, Ingredient] = {}
    foods_by_slug: dict[str, Food] = {}
    summary = {"ingredients": 0, "foods": 0, "plans": 0}

    for definition in manifest.get("ingredients", []):
        source = definition.get("source")
        source_id = definition.get("source_id")
        if source and source_id:
            ingredient = _resolve_sourced_ingredient(session, source, str(source_id))
        else:
            before = _existing_private_ingredient(session, user, definition["name"])
            ingredient = _create_private_ingredient(session, user, definition)
            if before is None:
                summary["ingredients"] += 1
        ingredients_by_slug[definition["slug"]] = ingredient

    for definition in manifest.get("foods", []):
        existing_food = _existing_food(session, user, definition["name"])
        if existing_food is not None:
            foods_by_slug[definition["slug"]] = existing_food
            continue

        food = Food(name=definition["name"], user_id=user.id)
        for item in definition.get("ingredients", []):
            ingredient = ingredients_by_slug.get(item.get("ingredient_slug"))
            if ingredient is None and item.get("source") and item.get("source_id"):
                ingredient = _resolve_sourced_ingredient(
                    session, item["source"], str(item["source_id"])
                )
            if ingredient is None or ingredient.id is None:
                raise HTTPException(
                    status_code=500,
                    detail="Starter food references an unknown ingredient.",
                )
            food.ingredients.append(
                FoodIngredient(
                    ingredient_id=ingredient.id,
                    unit_id=_unit_id_for_ingredient(ingredient, item.get("unit_name")),
                    unit_quantity=item.get("unit_quantity"),
                )
            )
        session.add(food)
        session.flush()
        foods_by_slug[definition["slug"]] = food
        summary["foods"] += 1

    for definition in manifest.get("plans", []):
        if _existing_plan(session, user, definition["label"]) is not None:
            continue
        plan_items: list[dict[str, Any]] = []
        for item in definition.get("items", []):
            food = foods_by_slug.get(item.get("food_slug"))
            if food is None or food.id is None:
                raise HTTPException(
                    status_code=500,
                    detail="Starter plan references an unknown food.",
                )
            plan_items.append(
                {
                    "type": item.get("type", "food"),
                    "foodId": str(food.id),
                    "portions": item.get("portions", 1),
                    "overrides": item.get("overrides", {}),
                }
            )
        session.add(
            Plan(
                user_id=user.id,
                label=definition["label"],
                payload={
                    "days": definition.get("days", 1),
                    "targetMacros": definition.get("targetMacros", {}),
                    "plan": plan_items,
                },
            )
        )
        summary["plans"] += 1

    return summary
