from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_db
from ..models import Ingredient, PossibleIngredientTag

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.get("/", response_model=List[Ingredient])
def get_all_ingredients(db: Session = Depends(get_db)) -> List[Ingredient]:
    """Return all ingredients."""
    return db.exec(select(Ingredient)).all()


@router.get("/possible_tags", response_model=List[PossibleIngredientTag])
def get_all_possible_tags(
    db: Session = Depends(get_db),
) -> List[PossibleIngredientTag]:
    """Return all possible ingredient tags ordered by name."""
    statement = select(PossibleIngredientTag).order_by(PossibleIngredientTag.name)
    return db.exec(statement).all()


@router.get("/{ingredient_id}", response_model=Ingredient)
def get_ingredient(ingredient_id: int, db: Session = Depends(get_db)) -> Ingredient:
    """Retrieve a single ingredient by ID."""
    ingredient = db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return ingredient


@router.post("/", response_model=Ingredient, status_code=201)
def add_ingredient(ingredient: Ingredient, db: Session = Depends(get_db)) -> Ingredient:
    """Create a new ingredient."""
    if ingredient.tags:
        ingredient.tags = [
            db.get(PossibleIngredientTag, t.id) for t in ingredient.tags if t.id
        ]
    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)
    return ingredient


@router.put("/{ingredient_id}", response_model=Ingredient)
def update_ingredient(
    ingredient_id: int,
    ingredient_data: Ingredient,
    db: Session = Depends(get_db),
) -> Ingredient:
    """Update an existing ingredient."""
    ingredient = db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    ingredient.name = ingredient_data.name
    ingredient.nutrition = ingredient_data.nutrition
    ingredient.units = ingredient_data.units
    if ingredient_data.tags:
        ingredient.tags = [
            db.get(PossibleIngredientTag, t.id) for t in ingredient_data.tags if t.id
        ]
    else:
        ingredient.tags = []

    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)
    return ingredient


@router.delete("/{ingredient_id}")
def delete_ingredient(ingredient_id: int, db: Session = Depends(get_db)) -> dict:
    """Delete an ingredient."""
    ingredient = db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    db.delete(ingredient)
    db.commit()
    return {"message": "Ingredient deleted successfully"}


__all__ = ["router"]

