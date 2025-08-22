"""Meal API routes implemented with FastAPI."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from db_models.meal import Meal as db_Meal
from db_models.meal_ingredient import MealIngredient as db_MealIngredient
from db_models.possible_meal_tag import (
    PossibleMealTag as db_PossibleMealTag,
)
from models import MealModel, PossibleMealTagModel

router = APIRouter()


@router.get("/meals", response_model=List[MealModel])
def get_all_meals(db: Session = Depends(get_db)) -> List[MealModel]:
    """Return all meals."""
    meals = db.query(db_Meal).all()
    return [MealModel.model_validate(m) for m in meals]


@router.get("/meals/{meal_id}", response_model=MealModel)
def get_meal(meal_id: int, db: Session = Depends(get_db)) -> MealModel:
    """Retrieve a single meal by ID."""
    meal = db.get(db_Meal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    return MealModel.model_validate(meal)


@router.get("/meals/possible_tags", response_model=List[PossibleMealTagModel])
def get_possible_meal_tags(db: Session = Depends(get_db)) -> List[PossibleMealTagModel]:
    """Return all possible meal tags."""
    tags = db.query(db_PossibleMealTag).all()
    return [PossibleMealTagModel.model_validate(t) for t in tags]


@router.post("/meals", response_model=MealModel, status_code=201)
def add_meal(meal_data: MealModel, db: Session = Depends(get_db)) -> MealModel:
    """Create a new meal."""
    meal = db_Meal(name=meal_data.name)

    for mi in meal_data.ingredients:
        meal.ingredients.append(
            db_MealIngredient(
                ingredient_id=mi.ingredient_id,
                unit_id=mi.unit_id,
                unit_quantity=mi.unit_quantity,
            )
        )

    for tag in meal_data.tags:
        if tag.id:
            db_tag = db.get(db_PossibleMealTag, tag.id)
            if db_tag:
                meal.tags.append(db_tag)

    db.add(meal)
    db.commit()
    db.refresh(meal)

    return MealModel.model_validate(meal)


@router.put("/meals/{meal_id}", response_model=MealModel)
def update_meal(
    meal_id: int, meal_data: MealModel, db: Session = Depends(get_db)
) -> MealModel:
    """Update an existing meal."""
    meal = db.get(db_Meal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    meal.name = meal_data.name

    meal.ingredients = []
    for mi in meal_data.ingredients:
        meal.ingredients.append(
            db_MealIngredient(
                ingredient_id=mi.ingredient_id,
                unit_id=mi.unit_id,
                unit_quantity=mi.unit_quantity,
            )
        )

    meal.tags = []
    for tag in meal_data.tags:
        if tag.id:
            db_tag = db.get(db_PossibleMealTag, tag.id)
            if db_tag:
                meal.tags.append(db_tag)

    db.commit()

    return MealModel.model_validate(meal)


@router.delete("/meals/{meal_id}")
def delete_meal(meal_id: int, db: Session = Depends(get_db)) -> dict:
    """Delete a meal."""
    meal = db.get(db_Meal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()
    return {"message": "Meal deleted successfully"}


__all__ = ["router"]

