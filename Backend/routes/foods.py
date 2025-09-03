from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, SQLModel
from sqlalchemy.orm import selectinload

from sqlalchemy import delete
from ..db import get_db
from ..models import Food, PossibleFoodTag, Ingredient, FoodIngredient
from ..models.schemas import FoodCreate, FoodRead, FoodUpdate
from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix="/foods", tags=["foods"])


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
    # Normalize unit_id values: treat 0 (synthetic 1g) as None for DB FK integrity
    normalized_ingredients = []
    for fi in food.ingredients:
        fi_dict = fi.model_dump()
        if fi_dict.get("unit_id") == 0:
            fi_dict["unit_id"] = None
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
    for fi_data in food_data.ingredients:
        fi_payload = fi_data.model_dump()
        # Normalize synthetic unit id 0 to None
        if fi_payload.get("unit_id") == 0:
            fi_payload["unit_id"] = None
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

