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
    """Convert an Ingredient to IngredientRead and ensure base 'g' unit is visible.

    - Do not mutate the database here.
    - If the ingredient has no 'g' unit yet, include a synthetic 'g' (grams == 1)
      in the response so the UI always sees it on initial load.
    """
    read = IngredientRead.model_validate(ingredient)
    has_g = any((getattr(u, "name", None) == "g") for u in (read.units or []))
    if not has_g:
        # Append a synthetic base unit; id is None since it may not exist yet in DB
        read.units.append(IngredientUnit(name="g", grams=1))
    return read


def ensure_g_unit_present(ingredient_obj: Ingredient) -> None:
    """Ensure a 'g' unit with grams == 1 exists on the Ingredient's units.

    Checks both name and grams to satisfy the strict requirement.
    """
    units = list(ingredient_obj.units or [])
    for u in units:
        if u.name == "g":
            # If a 'g' unit exists but grams != 1, correct it to 1
            if getattr(u, "grams", None) != 1:
                u.grams = 1
            return
    # No 'g' unit found; append one with grams == 1
    units.append(IngredientUnit(name="g", grams=1))
    ingredient_obj.units = units


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
    # Force inclusion of base unit 'g' with grams == 1
    ensure_g_unit_present(ingredient_obj)
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
    """Update an existing ingredient.

    Important: Avoid deleting existing units on update to preserve referential
    integrity for rows in food_ingredients that reference them. Instead,
    upsert provided units (update by id or insert new). Existing units not in
    the payload are left unchanged.
    """
    # Load ingredient with related collections for safe updates
    statement = (
        select(Ingredient)
        .options(
            selectinload(Ingredient.nutrition),
            selectinload(Ingredient.units),
            selectinload(Ingredient.tags),
        )
        .where(Ingredient.id == ingredient_id)
    )
    ingredient = db.exec(statement).one_or_none()
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    ingredient.name = ingredient_data.name

    # Upsert nutrition
    if ingredient_data.nutrition:
        ingredient.nutrition = Nutrition.model_validate(
            ingredient_data.nutrition.model_dump()
        )
    else:
        ingredient.nutrition = None

    # Upsert units without deleting existing ones
    existing_units = list(ingredient.units or [])
    existing_by_id = {u.id: u for u in existing_units if u.id is not None}
    existing_by_name = {u.name.lower(): u for u in existing_units if u.name}

    for u_in in ingredient_data.units:
        # Materialize to ORM model (may include id if provided by schema)
        incoming = IngredientUnit.model_validate(u_in.model_dump())

        # Prefer ID-based update when present
        if getattr(incoming, "id", None) and incoming.id in existing_by_id:
            ex = existing_by_id[incoming.id]
            ex.name = incoming.name
            ex.grams = incoming.grams
            continue

        # Otherwise try name-based update (case-insensitive) to avoid duplicates
        key = (incoming.name or "").lower()
        if key in existing_by_name:
            ex = existing_by_name[key]
            # Update grams; keep existing name casing
            ex.grams = incoming.grams
        else:
            # New unit
            ingredient.units.append(
                IngredientUnit(name=incoming.name, grams=incoming.grams)
            )

    # Ensure base 'g' unit exists and is correct
    ensure_g_unit_present(ingredient)

    # Update tags
    with db.no_autoflush:
        if ingredient_data.tags:
            ingredient.tags = [
                db.get(PossibleIngredientTag, t.id)
                for t in ingredient_data.tags
                if t.id
            ]
        else:
            ingredient.tags = []

    try:
        db.add(ingredient)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))

    # Re-load to include related fields
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
