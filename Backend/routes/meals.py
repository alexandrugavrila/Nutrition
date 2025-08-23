from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload

from sqlalchemy import delete
from ..db import get_db
from ..models import Meal, PossibleMealTag, Ingredient, MealIngredient
from ..models.schemas import MealCreate, MealRead, MealUpdate

router = APIRouter(prefix="/meals", tags=["meals"])


@router.get("/", response_model=List[MealRead])
def get_all_meals(db: Session = Depends(get_db)) -> List[MealRead]:
    """Return all meals."""
    meals = db.exec(select(Meal)).all()
    return [MealRead.model_validate(m) for m in meals]


@router.get("/possible_tags", response_model=List[PossibleMealTag])
def get_possible_meal_tags(db: Session = Depends(get_db)) -> List[PossibleMealTag]:
    """Return all possible meal tags ordered by name."""
    statement = select(PossibleMealTag).order_by(PossibleMealTag.name)
    return db.exec(statement).all()


@router.get("/{meal_id}", response_model=MealRead)
def get_meal(meal_id: int, db: Session = Depends(get_db)) -> MealRead:
    """Retrieve a single meal by ID."""
    meal = db.get(Meal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    return MealRead.model_validate(meal)


@router.post("/", response_model=MealRead, status_code=201)
def add_meal(meal: MealCreate, db: Session = Depends(get_db)) -> MealRead:
    """Create a new meal."""
    meal_obj = Meal.from_create(meal)
    if meal.tags:
        meal_obj.tags = [db.get(PossibleMealTag, t.id) for t in meal.tags if t.id]
    db.add(meal_obj)
    db.commit()

    statement = (
        select(Meal)
        .options(
            selectinload(Meal.ingredients)
            .selectinload(MealIngredient.ingredient)
            .selectinload(Ingredient.nutrition),
            selectinload(Meal.ingredients)
            .selectinload(MealIngredient.ingredient)
            .selectinload(Ingredient.units),
            selectinload(Meal.ingredients).selectinload(MealIngredient.unit),
            selectinload(Meal.tags),
        )
        .where(Meal.id == meal_obj.id)
    )
    meal_obj = db.exec(statement).one()
    return MealRead.model_validate(meal_obj)


@router.put("/{meal_id}", response_model=MealRead)
def update_meal(
    meal_id: int, meal_data: MealUpdate, db: Session = Depends(get_db)
) -> MealRead:
    """Update an existing meal."""
    meal = db.get(Meal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    meal.name = meal_data.name
    db.exec(delete(MealIngredient).where(MealIngredient.meal_id == meal_id))
    meal.ingredients = []
    for mi_data in meal_data.ingredients:
        mi_obj = MealIngredient.model_validate(mi_data.model_dump())
        mi_obj.meal_id = meal_id
        meal.ingredients.append(mi_obj)

    with db.no_autoflush:
        if meal_data.tags:
            meal.tags = [
                db.get(PossibleMealTag, t.id) for t in meal_data.tags if t.id
            ]
        else:
            meal.tags = []

    db.add(meal)
    db.commit()

    statement = (
        select(Meal)
        .options(
            selectinload(Meal.ingredients)
            .selectinload(MealIngredient.ingredient)
            .selectinload(Ingredient.nutrition),
            selectinload(Meal.ingredients)
            .selectinload(MealIngredient.ingredient)
            .selectinload(Ingredient.units),
            selectinload(Meal.ingredients).selectinload(MealIngredient.unit),
            selectinload(Meal.tags),
        )
        .where(Meal.id == meal.id)
    )
    meal = db.exec(statement).one()
    return MealRead.model_validate(meal)


@router.delete("/{meal_id}")
def delete_meal(meal_id: int, db: Session = Depends(get_db)) -> dict:
    """Delete a meal."""
    meal = db.get(Meal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()
    return {"message": "Meal deleted successfully"}


__all__ = ["router"]

