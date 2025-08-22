from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from db import get_db
from models import Meal, PossibleMealTag

router = APIRouter(prefix="/meals", tags=["meals"])


@router.get("", response_model=List[Meal])
def get_all_meals(db: Session = Depends(get_db)) -> List[Meal]:
    """Return all meals."""
    return db.exec(select(Meal)).all()


@router.get("/{meal_id}", response_model=Meal)
def get_meal(meal_id: int, db: Session = Depends(get_db)) -> Meal:
    """Retrieve a single meal by ID."""
    meal = db.get(Meal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    return meal


@router.get("/possible_tags", response_model=List[PossibleMealTag])
def get_possible_meal_tags(db: Session = Depends(get_db)) -> List[PossibleMealTag]:
    """Return all possible meal tags ordered by name."""
    statement = select(PossibleMealTag).order_by(PossibleMealTag.name)
    return db.exec(statement).all()


@router.post("", response_model=Meal, status_code=201)
def add_meal(meal: Meal, db: Session = Depends(get_db)) -> Meal:
    """Create a new meal."""
    if meal.tags:
        meal.tags = [db.get(PossibleMealTag, t.id) for t in meal.tags if t.id]
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal


@router.put("/{meal_id}", response_model=Meal)
def update_meal(meal_id: int, meal_data: Meal, db: Session = Depends(get_db)) -> Meal:
    """Update an existing meal."""
    meal = db.get(Meal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    meal.name = meal_data.name
    meal.ingredients = meal_data.ingredients
    if meal_data.tags:
        meal.tags = [db.get(PossibleMealTag, t.id) for t in meal_data.tags if t.id]
    else:
        meal.tags = []

    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal


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
