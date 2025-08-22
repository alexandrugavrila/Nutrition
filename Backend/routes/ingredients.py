"""Ingredient API routes implemented with FastAPI."""

from typing import List

from fastapi import APIRouter, HTTPException

from db import db
from db_models.ingredient import Ingredient as db_Ingredient
from db_models.nutrition import Nutrition as db_Nutrition
from db_models.ingredient_unit import IngredientUnit as db_IngredientUnit
from db_models.possible_ingredient_tag import (
    PossibleIngredientTag as db_PossibleIngredientTag,
)
from models import IngredientModel, PossibleIngredientTagModel

router = APIRouter()


@router.get("/ingredients", response_model=List[IngredientModel])
def get_all_ingredients() -> List[IngredientModel]:
    """Return all ingredients."""
    ingredients = db_Ingredient.query.all()
    return [IngredientModel.model_validate(i) for i in ingredients]


@router.get("/ingredients/{ingredient_id}", response_model=IngredientModel)
def get_ingredient(ingredient_id: int) -> IngredientModel:
    """Retrieve a single ingredient by ID."""
    ingredient = db_Ingredient.query.get(ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return IngredientModel.model_validate(ingredient)


@router.post("/ingredients", response_model=IngredientModel, status_code=201)
def add_ingredient(ingredient_data: IngredientModel) -> IngredientModel:
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
            db_tag = db_PossibleIngredientTag.query.get(tag.id)
            if db_tag:
                ingredient.tags.append(db_tag)

    db.session.add(ingredient)
    db.session.commit()

    return IngredientModel.model_validate(ingredient)


@router.put("/ingredients/{ingredient_id}", response_model=IngredientModel)
def update_ingredient(ingredient_id: int, ingredient_data: IngredientModel) -> IngredientModel:
    """Update an existing ingredient."""
    ingredient = db_Ingredient.query.get(ingredient_id)
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
            db_tag = db_PossibleIngredientTag.query.get(tag.id)
            if db_tag:
                ingredient.tags.append(db_tag)

    db.session.commit()

    return IngredientModel.model_validate(ingredient)


@router.delete("/ingredients/{ingredient_id}")
def delete_ingredient(ingredient_id: int) -> dict:
    """Delete an ingredient."""
    ingredient = db_Ingredient.query.get(ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    db.session.delete(ingredient)
    db.session.commit()
    return {"message": "Ingredient deleted successfully"}


@router.get(
    "/ingredients/possible_tags",
    response_model=List[PossibleIngredientTagModel],
)
def get_all_possible_tags() -> List[PossibleIngredientTagModel]:
    """Return all possible ingredient tags."""
    tags = db_PossibleIngredientTag.query.all()
    return [PossibleIngredientTagModel.model_validate(t) for t in tags]


__all__ = ["router"]

