from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..db import get_db
from ..models import Ingredient, IngredientUnit, Nutrition, PossibleIngredientTag
from ..models.schemas import (
    IngredientCreate,
    IngredientRead,
    IngredientUpdate,
)
from sqlmodel import SQLModel


class TagCreate(SQLModel):
    """Schema for creating a new possible tag by name."""

    name: str

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


def ingredient_to_read(ingredient: Ingredient) -> IngredientRead:
    """Convert an Ingredient to IngredientRead ensuring a 1 g unit exists."""
    ingredient_read = IngredientRead.model_validate(ingredient)
    if not any(unit.name == "1g" for unit in ingredient_read.units):
        ingredient_read.units.append(
            IngredientUnit(id=0, ingredient_id=ingredient.id, name="1g", grams=1)
        )
    return ingredient_read


@router.get("/", response_model=List[IngredientRead])
def get_all_ingredients(db: Session = Depends(get_db)) -> List[IngredientRead]:
    """Return all ingredients."""
    ingredients = db.exec(select(Ingredient)).all()
    return [ingredient_to_read(ing) for ing in ingredients]


@router.get("/possible_tags", response_model=List[PossibleIngredientTag])
def get_all_possible_tags(
    db: Session = Depends(get_db),
) -> List[PossibleIngredientTag]:
    """Return all possible ingredient tags ordered by name."""
    statement = select(PossibleIngredientTag).order_by(PossibleIngredientTag.name)
    return db.exec(statement).all()


@router.post("/possible_tags", response_model=PossibleIngredientTag, status_code=201)
def add_possible_tag(tag: TagCreate, db: Session = Depends(get_db)) -> PossibleIngredientTag:
    """Create a new possible ingredient tag, or return existing on duplicate name."""
    obj = PossibleIngredientTag(name=tag.name.strip())
    db.add(obj)
    try:
        db.commit()
        db.refresh(obj)
        return obj
    except IntegrityError:
        db.rollback()
        # Return the existing tag with the same name
        statement = select(PossibleIngredientTag).where(
            PossibleIngredientTag.name == tag.name.strip()
        )
        existing = db.exec(statement).one()
        return existing


@router.get("/{ingredient_id}", response_model=IngredientRead)
def get_ingredient(ingredient_id: int, db: Session = Depends(get_db)) -> IngredientRead:
    """Retrieve a single ingredient by ID."""
    ingredient = db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return ingredient_to_read(ingredient)


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

    try:
        db.commit()
    except IntegrityError:
        # Likely a unique constraint violation on name; return the existing record
        db.rollback()
        statement = (
            select(Ingredient)
            .options(
                selectinload(Ingredient.nutrition),
                selectinload(Ingredient.units),
                selectinload(Ingredient.tags),
            )
            .where(Ingredient.name == ingredient_obj.name)
        )
        existing = db.exec(statement).one()
        return ingredient_to_read(existing)

    statement = (
        select(Ingredient)
        .options(
            selectinload(Ingredient.nutrition),
            selectinload(Ingredient.units),
            selectinload(Ingredient.tags),
        )
        .where(Ingredient.id == ingredient_obj.id)
    )
    ingredient_obj = db.exec(statement).one()
    return ingredient_to_read(ingredient_obj)


@router.put("/{ingredient_id}", response_model=IngredientRead)
def update_ingredient(
    ingredient_id: int,
    ingredient_data: IngredientUpdate,
    db: Session = Depends(get_db),
) -> IngredientRead:
    """Update an existing ingredient."""
    ingredient = db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    ingredient.name = ingredient_data.name

    if ingredient_data.nutrition:
        ingredient.nutrition = Nutrition.model_validate(
            ingredient_data.nutrition.model_dump()
        )
    else:
        ingredient.nutrition = None

    ingredient.units = [
        IngredientUnit.model_validate(u.model_dump()) for u in ingredient_data.units
    ]

    with db.no_autoflush:
        if ingredient_data.tags:
            ingredient.tags = [
                db.get(PossibleIngredientTag, t.id)
                for t in ingredient_data.tags
                if t.id
            ]
        else:
            ingredient.tags = []

    db.add(ingredient)
    db.commit()

    statement = (
        select(Ingredient)
        .options(
            selectinload(Ingredient.nutrition),
            selectinload(Ingredient.units),
            selectinload(Ingredient.tags),
        )
        .where(Ingredient.id == ingredient.id)
    )
    ingredient = db.exec(statement).one()
    return ingredient_to_read(ingredient)


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
