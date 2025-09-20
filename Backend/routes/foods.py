from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, SQLModel
from sqlalchemy.orm import selectinload

from sqlalchemy import delete
from ..db import get_db
from ..models import (
    Food,
    PossibleFoodTag,
    Ingredient,
    FoodIngredient,
    IngredientUnit,
)
from ..models.schemas import FoodCreate, FoodRead, FoodUpdate
from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix="/foods", tags=["foods"])


def _lookup_base_unit_id(db: Session, ingredient_id: int) -> Optional[int]:
    """Resolve the canonical unit id for synthetic "1g" selections."""

    statement = select(IngredientUnit).where(
        IngredientUnit.ingredient_id == ingredient_id
    )
    units = [u for u in db.exec(statement).all() if getattr(u, "id", None) is not None]
    if not units:
        return None

    def _grams_value(unit: IngredientUnit) -> Optional[float]:
        grams = getattr(unit, "grams", None)
        if grams is None:
            return None
        try:
            return float(grams)
        except (TypeError, ValueError):  # pragma: no cover - defensive
            return None

    def _is_exact_gram(unit: IngredientUnit) -> bool:
        grams_value = _grams_value(unit)
        name = (getattr(unit, "name", "") or "").strip().lower()
        return (
            name == "g"
            and grams_value is not None
            and abs(grams_value - 1.0) < 1e-9
        )

    for unit in units:
        if _is_exact_gram(unit):
            return unit.id

    for unit in units:
        grams_value = _grams_value(unit)
        if grams_value is not None and abs(grams_value - 1.0) < 1e-9:
            return unit.id

    return units[0].id


def _normalize_unit_id(
    db: Session,
    cache: Dict[int, Optional[int]],
    ingredient_id: Optional[int],
    raw_unit_id: Optional[int],
) -> Optional[int]:
    """Translate synthetic unit identifiers (0) to real database ids."""

    if isinstance(raw_unit_id, str):
        stripped = raw_unit_id.strip()
        if not stripped:
            return None
        try:
            raw_unit_id = int(stripped)
        except ValueError:
            return None

    if raw_unit_id is None:
        return None

    if raw_unit_id != 0:
        return raw_unit_id

    if ingredient_id is None:
        return None

    if ingredient_id not in cache:
        cache[ingredient_id] = _lookup_base_unit_id(db, ingredient_id)

    return cache[ingredient_id]


@router.get("/", response_model=List[FoodRead])
def get_all_foods(db: Session = Depends(get_db)) -> List[FoodRead]:
    """Return all foods."""
    foods = db.exec(select(Food)).all()
    return [FoodRead.model_validate(f) for f in foods]


@router.get("/possible_tags", response_model=List[PossibleFoodTag])
def get_possible_food_tags(db: Session = Depends(get_db)) -> List[PossibleFoodTag]:
    """Return all possible food tags ordered by name."""
    statement = select(PossibleFoodTag).order_by(PossibleFoodTag.name)
    return db.exec(statement).all()


class TagCreate(SQLModel):
    """Schema for creating a new possible tag by name."""

    name: str


@router.post("/possible_tags", response_model=PossibleFoodTag, status_code=201)
def add_possible_food_tag(
    tag: TagCreate, db: Session = Depends(get_db)
) -> PossibleFoodTag:
    """Create a new possible food tag, or return existing on duplicate name."""
    obj = PossibleFoodTag(name=tag.name.strip())
    db.add(obj)
    try:
        db.commit()
        db.refresh(obj)
        return obj
    except IntegrityError:
        db.rollback()
        statement = select(PossibleFoodTag).where(
            PossibleFoodTag.name == tag.name.strip()
        )
        existing = db.exec(statement).one()
        return existing


@router.get("/{food_id}", response_model=FoodRead)
def get_food(food_id: int, db: Session = Depends(get_db)) -> FoodRead:
    """Retrieve a single food by ID."""
    food = db.get(Food, food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    return FoodRead.model_validate(food)


@router.post("/", response_model=FoodRead, status_code=201)
def add_food(food: FoodCreate, db: Session = Depends(get_db)) -> FoodRead:
    """Create a new food."""
    # Normalize unit_id values: map the synthetic 0 placeholder to a real DB unit id
    normalized_ingredients = []
    unit_cache: Dict[int, Optional[int]] = {}
    for fi in food.ingredients:
        fi_dict = fi.model_dump()
        fi_dict["unit_id"] = _normalize_unit_id(
            db,
            unit_cache,
            fi_dict.get("ingredient_id"),
            fi_dict.get("unit_id"),
        )
        normalized_ingredients.append(fi_dict)

    food_obj = Food.from_create(
        FoodCreate(name=food.name, ingredients=normalized_ingredients, tags=food.tags)
    )
    if food.tags:
        food_obj.tags = [db.get(PossibleFoodTag, t.id) for t in food.tags if t.id]
    db.add(food_obj)
    db.commit()

    statement = (
        select(Food)
        .options(
            selectinload(Food.ingredients)
            .selectinload(FoodIngredient.ingredient)
            .selectinload(Ingredient.nutrition),
            selectinload(Food.ingredients)
            .selectinload(FoodIngredient.ingredient)
            .selectinload(Ingredient.units),
            selectinload(Food.ingredients).selectinload(FoodIngredient.unit),
            selectinload(Food.tags),
        )
        .where(Food.id == food_obj.id)
    )
    food_obj = db.exec(statement).one()
    return FoodRead.model_validate(food_obj)


@router.put("/{food_id}", response_model=FoodRead)
def update_food(
    food_id: int, food_data: FoodUpdate, db: Session = Depends(get_db)
) -> FoodRead:
    """Update an existing food."""
    food = db.get(Food, food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    food.name = food_data.name
    db.exec(delete(FoodIngredient).where(FoodIngredient.food_id == food_id))
    food.ingredients = []
    unit_cache: Dict[int, Optional[int]] = {}
    for fi_data in food_data.ingredients:
        fi_payload = fi_data.model_dump()
        fi_payload["unit_id"] = _normalize_unit_id(
            db,
            unit_cache,
            fi_payload.get("ingredient_id"),
            fi_payload.get("unit_id"),
        )
        fi_obj = FoodIngredient.model_validate(fi_payload)
        fi_obj.food_id = food_id
        food.ingredients.append(fi_obj)

    with db.no_autoflush:
        if food_data.tags:
            food.tags = [
                db.get(PossibleFoodTag, t.id) for t in food_data.tags if t.id
            ]
        else:
            food.tags = []

    db.add(food)
    db.commit()

    statement = (
        select(Food)
        .options(
            selectinload(Food.ingredients)
            .selectinload(FoodIngredient.ingredient)
            .selectinload(Ingredient.nutrition),
            selectinload(Food.ingredients)
            .selectinload(FoodIngredient.ingredient)
            .selectinload(Ingredient.units),
            selectinload(Food.ingredients).selectinload(FoodIngredient.unit),
            selectinload(Food.tags),
        )
        .where(Food.id == food.id)
    )
    food = db.exec(statement).one()
    return FoodRead.model_validate(food)


@router.delete("/{food_id}")
def delete_food(food_id: int, db: Session = Depends(get_db)) -> dict:
    """Delete a food."""
    food = db.get(Food, food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    db.delete(food)
    db.commit()
    return {"message": "Food deleted successfully"}


__all__ = ["router"]

