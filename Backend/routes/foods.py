from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload

from sqlalchemy import delete
from ..db import get_db
from ..models import Food, PossibleFoodTag, Ingredient, FoodIngredient
from ..models.schemas import FoodCreate, FoodRead, FoodUpdate

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
    food_obj = Food.from_create(food)
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
        fi_obj = FoodIngredient.model_validate(fi_data.model_dump())
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

