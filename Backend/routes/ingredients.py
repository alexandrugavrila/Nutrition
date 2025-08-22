"""Ingredient API routes implemented with FastAPI."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from db_models.ingredient import Ingredient as db_Ingredient
from db_models.nutrition import Nutrition as db_Nutrition
from db_models.ingredient_unit import IngredientUnit as db_IngredientUnit
from db_models.possible_ingredient_tag import (
    PossibleIngredientTag as db_PossibleIngredientTag,
)
from models import IngredientModel, PossibleIngredientTagModel

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.get("/", response_model=List[IngredientModel])
def get_all_ingredients(db: Session = Depends(get_db)) -> List[IngredientModel]:
    """Return all ingredients."""
    ingredients = db.query(db_Ingredient).all()
    return [IngredientModel.model_validate(i) for i in ingredients]


@router.get("/{ingredient_id}", response_model=IngredientModel)
def get_ingredient(ingredient_id: int, db: Session = Depends(get_db)) -> IngredientModel:
    """Retrieve a single ingredient by ID."""
    ingredient = db.get(db_Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return IngredientModel.model_validate(ingredient)


@router.post("/", response_model=IngredientModel, status_code=201)
def add_ingredient(
    ingredient_data: IngredientModel, db: Session = Depends(get_db)
) -> IngredientModel:
    """Create a new ingredient."""
    ingredient = db_Ingredient(name=ingredient_data.name)

    if ingredient_data.nutrition:
        n = ingredient_data.nutrition
        ingredient.nutrition = db_Nutrition(
            calories=n.calories,
            fat=n.fat,
            carbohydrates=n.carbohydrates,
            protein=n.protein,
            fiber=n.fiber,
        )

    for unit in ingredient_data.units:
        ingredient.units.append(db_IngredientUnit(name=unit.name, grams=unit.grams))

    for tag in ingredient_data.tags:
        if tag.id:
            db_tag = db.get(db_PossibleIngredientTag, tag.id)
            if db_tag:
                ingredient.tags.append(db_tag)

    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)

    return IngredientModel.model_validate(ingredient)


@router.put("/{ingredient_id}", response_model=IngredientModel)
def update_ingredient(
    ingredient_id: int,
    ingredient_data: IngredientModel,
    db: Session = Depends(get_db),
) -> IngredientModel:
    """Update an existing ingredient."""
    ingredient = db.get(db_Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    ingredient.name = ingredient_data.name

    if ingredient_data.nutrition:
        n = ingredient_data.nutrition
        if ingredient.nutrition:
            ingredient.nutrition.calories = n.calories
            ingredient.nutrition.fat = n.fat
            ingredient.nutrition.carbohydrates = n.carbohydrates
            ingredient.nutrition.protein = n.protein
            ingredient.nutrition.fiber = n.fiber
        else:
            ingredient.nutrition = db_Nutrition(
                calories=n.calories,
                fat=n.fat,
                carbohydrates=n.carbohydrates,
                protein=n.protein,
                fiber=n.fiber,
            )

    ingredient.units = []
    for unit in ingredient_data.units:
        ingredient.units.append(db_IngredientUnit(name=unit.name, grams=unit.grams))

    ingredient.tags = []
    for tag in ingredient_data.tags:
        if tag.id:
            db_tag = db.get(db_PossibleIngredientTag, tag.id)
            if db_tag:
                ingredient.tags.append(db_tag)

    db.commit()

    return IngredientModel.model_validate(ingredient)


@router.delete("/{ingredient_id}")
def delete_ingredient(ingredient_id: int, db: Session = Depends(get_db)) -> dict:
    """Delete an ingredient."""
    ingredient = db.get(db_Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    db.delete(ingredient)
    db.commit()
    return {"message": "Ingredient deleted successfully"}


@router.get(
    "/possible_tags",
    response_model=List[PossibleIngredientTagModel],
)
def get_all_possible_tags(db: Session = Depends(get_db)) -> List[PossibleIngredientTagModel]:
    """Return all possible ingredient tags."""
    tags = db.query(db_PossibleIngredientTag).all()
    return [PossibleIngredientTagModel.model_validate(t) for t in tags]


__all__ = ["router"]

