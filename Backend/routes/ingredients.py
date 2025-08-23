from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_db
from ..models import Ingredient, PossibleIngredientTag
from ..models.schemas import IngredientCreate, IngredientRead

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.get("/", response_model=List[IngredientRead])
def get_all_ingredients(db: Session = Depends(get_db)) -> List[IngredientRead]:
    """Return all ingredients."""
    ingredients = db.exec(select(Ingredient)).all()
    return [IngredientRead.model_validate(ing) for ing in ingredients]


@router.get("/possible_tags", response_model=List[PossibleIngredientTag])
def get_all_possible_tags(
    db: Session = Depends(get_db),
) -> List[PossibleIngredientTag]:
    """Return all possible ingredient tags ordered by name."""
    statement = select(PossibleIngredientTag).order_by(PossibleIngredientTag.name)
    return db.exec(statement).all()


@router.get("/{ingredient_id}", response_model=IngredientRead)
def get_ingredient(ingredient_id: int, db: Session = Depends(get_db)) -> IngredientRead:
    """Retrieve a single ingredient by ID."""
    ingredient = db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return IngredientRead.model_validate(ingredient)


@router.post("/", response_model=IngredientRead, status_code=201)
def add_ingredient(
    ingredient: IngredientCreate, db: Session = Depends(get_db)
) -> IngredientRead:
    """Create a new ingredient."""
    ingredient_obj = Ingredient.from_create(ingredient)
    if ingredient.tags:
        ingredient_obj.tags = [
            db.get(PossibleIngredientTag, t.id) for t in ingredient.tags if t.id
        ]
    db.add(ingredient_obj)
    db.commit()
    db.refresh(ingredient_obj)
    return IngredientRead.model_validate(ingredient_obj)


@router.put("/{ingredient_id}", response_model=IngredientRead)
def update_ingredient(
    ingredient_id: int,
    ingredient_data: IngredientCreate,
    db: Session = Depends(get_db),
) -> IngredientRead:
    """Update an existing ingredient."""
    ingredient = db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    new_data = Ingredient.from_create(ingredient_data)

    ingredient.name = new_data.name
    ingredient.nutrition = new_data.nutrition
    ingredient.units = new_data.units
    if ingredient_data.tags:
        ingredient.tags = [
            db.get(PossibleIngredientTag, t.id) for t in ingredient_data.tags if t.id
        ]
    else:
        ingredient.tags = []

    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)
    return IngredientRead.model_validate(ingredient)


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

