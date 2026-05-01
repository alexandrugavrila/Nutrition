from typing import List, Optional, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..db import get_db
from ..auth.dependencies import get_current_user
from ..models import (
    Ingredient,
    IngredientShoppingUnit,
    IngredientUnit,
    IngredientSource,
    Nutrition,
    PossibleIngredientTag,
    User,
)
from ..models.schemas import (
    IngredientCreate,
    IngredientRead,
    IngredientUpdate,
    IngredientShoppingUnitSelection,
)
from sqlmodel import SQLModel


class TagCreate(SQLModel):
    """Schema for creating a new possible tag by name."""

    name: str

router = APIRouter(prefix="/ingredients", tags=["ingredients"])

INGREDIENT_LOAD_OPTIONS = [
    selectinload(Ingredient.nutrition),
    selectinload(Ingredient.units),
    selectinload(Ingredient.sources),
    selectinload(Ingredient.tags),
    selectinload(Ingredient.shopping_unit).selectinload(IngredientShoppingUnit.unit),
]


def _normalize_source_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned if cleaned else None
    cleaned = str(value).strip()
    return cleaned if cleaned else None


def _normalize_source_fields(
    source: Optional[str], source_id: Optional[str]
) -> tuple[Optional[str], Optional[str]]:
    normalized_source = _normalize_source_value(source)
    normalized_source_id = _normalize_source_value(source_id)
    if normalized_source == "manual":
        return None, None
    if not normalized_source or not normalized_source_id:
        return None, None
    return normalized_source, normalized_source_id


def _resolve_primary_source(ingredient: Ingredient) -> tuple[Optional[str], Optional[str]]:
    sources = list(ingredient.sources or [])
    if not sources:
        return None, None
    usda = next((source for source in sources if source.source == "usda"), None)
    if usda:
        return usda.source, usda.source_id
    sources.sort(
        key=lambda source: (
            source.source or "",
            source.source_id or "",
            source.id or 0,
        )
    )
    primary = sources[0]
    return primary.source, primary.source_id


def _find_source_mapping(
    db: Session, source: str, source_id: str
) -> Optional[IngredientSource]:
    statement = select(IngredientSource).where(
        IngredientSource.source == source,
        IngredientSource.source_id == source_id,
    )
    return db.exec(statement).one_or_none()


def _visible_ingredient_clause(current_user: User):
    return or_(Ingredient.user_id.is_(None), Ingredient.user_id == current_user.id)


def _load_visible_ingredient(
    db: Session, ingredient_id: int, current_user: User
) -> Optional[Ingredient]:
    statement = (
        select(Ingredient)
        .options(*INGREDIENT_LOAD_OPTIONS)
        .where(Ingredient.id == ingredient_id)
        .where(_visible_ingredient_clause(current_user))
    )
    return db.exec(statement).one_or_none()


def _ensure_can_modify_ingredient(ingredient: Ingredient, current_user: User) -> None:
    if ingredient.user_id is None:
        if current_user.is_admin:
            return
        raise HTTPException(
            status_code=403,
            detail="Global sourced ingredients can only be changed by an admin or catalog sync.",
        )
    if ingredient.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Ingredient not found")


def ingredient_to_read(ingredient: Ingredient) -> IngredientRead:
    """Convert an Ingredient to IngredientRead and ensure base 'g' unit is visible."""

    source, source_id = _resolve_primary_source(ingredient)
    resolved_unit = None
    resolved_unit_id = None
    if ingredient.shopping_unit:
        resolved_unit = ingredient.shopping_unit.unit
        resolved_unit_id = ingredient.shopping_unit.unit_id
        if resolved_unit is None and resolved_unit_id is not None:
            resolved_unit = next(
                (
                    unit
                    for unit in (ingredient.units or [])
                    if unit.id == resolved_unit_id
                ),
                None,
            )

    payload = {
        "id": ingredient.id,
        "name": ingredient.name,
        "source": source,
        "source_id": source_id,
        "nutrition": ingredient.nutrition,
        "units": list(ingredient.units or []),
        "tags": list(ingredient.tags or []),
        "shopping_unit": resolved_unit if resolved_unit is not None else None,
        "shopping_unit_id": None,
    }

    if resolved_unit is not None and getattr(resolved_unit, "id", None) is not None:
        payload["shopping_unit_id"] = resolved_unit.id
    elif resolved_unit_id is not None:
        payload["shopping_unit_id"] = resolved_unit_id

    read = IngredientRead.model_validate(payload)

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


def _coerce_optional_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return None
        try:
            return int(candidate)
        except ValueError:
            return None
    return None


def _resolve_shopping_unit(
    ingredient: Ingredient,
    requested_id: Optional[Any],
    payload: Optional[IngredientShoppingUnitSelection],
) -> Optional[IngredientUnit]:
    units = list(ingredient.units or [])
    if not units:
        if requested_id is not None:
            raise HTTPException(
                status_code=400,
                detail="Preferred shopping unit must reference an existing unit.",
            )
        return None

    def match_by_id(raw_id: Any) -> Optional[IngredientUnit]:
        normalized = _coerce_optional_int(raw_id)
        if normalized is None:
            return None
        match = next((unit for unit in units if unit.id == normalized), None)
        if match is None:
            raise HTTPException(
                status_code=400,
                detail="Preferred shopping unit must belong to the ingredient.",
            )
        return match

    unit = match_by_id(requested_id)
    if unit is not None:
        return unit

    payload_obj: Optional[IngredientShoppingUnitSelection]
    if payload is not None and not isinstance(payload, IngredientShoppingUnitSelection):
        payload_obj = IngredientShoppingUnitSelection.model_validate(payload)
    else:
        payload_obj = payload

    if payload_obj is not None:
        candidate = match_by_id(
            getattr(payload_obj, "unit_id", None) or getattr(payload_obj, "id", None)
        )
        if candidate is not None:
            return candidate

        name = getattr(payload_obj, "name", None)
        grams = getattr(payload_obj, "grams", None)
        normalized_name = name.strip().lower() if isinstance(name, str) else None
        grams_value: Optional[float] = None
        if grams is not None:
            try:
                grams_value = float(grams)
            except (TypeError, ValueError):
                grams_value = None

        if normalized_name:
            matching = [
                unit
                for unit in units
                if (unit.name or "").strip().lower() == normalized_name
            ]
            if grams_value is not None:
                matching = [
                    unit
                    for unit in matching
                    if unit.grams is not None
                    and abs(float(unit.grams) - grams_value) < 1e-9
                ]
            if matching:
                return matching[0]

    return None


def apply_shopping_unit_selection(
    ingredient: Ingredient,
    requested_id: Optional[Any],
    payload: Optional[IngredientShoppingUnitSelection],
) -> None:
    unit = _resolve_shopping_unit(ingredient, requested_id, payload)
    if unit is None:
        ingredient.shopping_unit = None
        return

    if ingredient.shopping_unit is None:
        ingredient.shopping_unit = IngredientShoppingUnit(unit=unit)
    else:
        ingredient.shopping_unit.unit = unit
        ingredient.shopping_unit.unit_id = unit.id


@router.get("/", response_model=List[IngredientRead])
def get_all_ingredients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[IngredientRead]:
    """Return all ingredients."""
    statement = (
        select(Ingredient)
        .options(*INGREDIENT_LOAD_OPTIONS)
        .where(_visible_ingredient_clause(current_user))
    )
    ingredients = db.exec(statement).all()
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
def get_ingredient(
    ingredient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IngredientRead:
    """Retrieve a single ingredient by ID."""
    ingredient = _load_visible_ingredient(db, ingredient_id, current_user)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return ingredient_to_read(ingredient)


@router.post("/", response_model=IngredientRead, status_code=201)
def add_ingredient(
    ingredient: IngredientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IngredientRead:
    """Create a new ingredient."""
    source, source_id = _normalize_source_fields(
        ingredient.source, ingredient.source_id
    )
    if source and source_id:
        existing_source = _find_source_mapping(db, source, source_id)
        if existing_source:
            statement = (
                select(Ingredient)
                .options(*INGREDIENT_LOAD_OPTIONS)
                .where(Ingredient.id == existing_source.ingredient_id)
            )
            existing = db.exec(statement).one_or_none()
            if existing:
                return ingredient_to_read(existing)

    ingredient_obj = Ingredient.from_create(ingredient)
    ingredient_obj.user_id = None if source and source_id else current_user.id
    # Force inclusion of base unit 'g' with grams == 1
    ensure_g_unit_present(ingredient_obj)
    if ingredient.tags:
        ingredient_obj.tags = [
            db.get(PossibleIngredientTag, t.id) for t in ingredient.tags if t.id
        ]
    if source and source_id:
        ingredient_obj.sources.append(
            IngredientSource(source=source, source_id=source_id)
        )
    db.add(ingredient_obj)

    try:
        db.flush()
        apply_shopping_unit_selection(
            ingredient_obj,
            ingredient.shopping_unit_id,
            ingredient.shopping_unit,
        )
        db.commit()
    except IntegrityError:
        # Likely a unique constraint violation on name; return the existing record
        db.rollback()
        statement = (
            select(Ingredient)
            .options(*INGREDIENT_LOAD_OPTIONS)
            .where(Ingredient.name == ingredient_obj.name)
            .where(Ingredient.user_id == ingredient_obj.user_id)
        )
        existing = db.exec(statement).one_or_none()
        if existing is None:
            raise HTTPException(status_code=400, detail="Unable to create ingredient.")
        if source and source_id:
            existing_source = _find_source_mapping(db, source, source_id)
            if existing_source and existing_source.ingredient_id != existing.id:
                statement = (
                    select(Ingredient)
                    .options(*INGREDIENT_LOAD_OPTIONS)
                    .where(Ingredient.id == existing_source.ingredient_id)
                )
                existing = db.exec(statement).one()
                return ingredient_to_read(existing)
            if not existing_source:
                existing.sources.append(
                    IngredientSource(source=source, source_id=source_id)
                )
                db.add(existing)
                db.commit()
                db.refresh(existing)
        return ingredient_to_read(existing)

    statement = (
        select(Ingredient)
        .options(*INGREDIENT_LOAD_OPTIONS)
        .where(Ingredient.id == ingredient_obj.id)
    )
    ingredient_obj = db.exec(statement).one()
    return ingredient_to_read(ingredient_obj)


@router.put("/{ingredient_id}", response_model=IngredientRead)
def update_ingredient(
    ingredient_id: int,
    ingredient_data: IngredientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IngredientRead:
    """Update an existing ingredient.

    Important: Avoid deleting existing units on update to preserve referential
    integrity for rows in food_ingredients that reference them. Instead,
    upsert provided units (update by id or insert new). Existing units not in
    the payload are left unchanged.
    """
    # Load ingredient with related collections for safe updates
    ingredient = _load_visible_ingredient(db, ingredient_id, current_user)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    _ensure_can_modify_ingredient(ingredient, current_user)

    payload_fields = ingredient_data.model_dump(exclude_unset=True)

    ingredient.name = ingredient_data.name
    source_provided = "source" in payload_fields
    source_id_provided = "source_id" in payload_fields
    if source_provided or source_id_provided:
        current_source, current_source_id = _resolve_primary_source(ingredient)
        desired_source = (
            ingredient_data.source if source_provided else current_source
        )
        desired_source_id = (
            ingredient_data.source_id if source_id_provided else current_source_id
        )
        desired_source, desired_source_id = _normalize_source_fields(
            desired_source, desired_source_id
        )
        if ingredient.user_id is not None and desired_source and desired_source_id:
            raise HTTPException(
                status_code=400,
                detail="Private ingredients cannot be linked to sourced catalog records.",
            )
        if desired_source and desired_source_id:
            conflict = _find_source_mapping(db, desired_source, desired_source_id)
            if conflict and conflict.ingredient_id != ingredient.id:
                raise HTTPException(
                    status_code=400,
                    detail="Source mapping already belongs to another ingredient.",
                )
            existing_match = next(
                (
                    source
                    for source in (ingredient.sources or [])
                    if source.source == desired_source
                ),
                None,
            )
            ingredient.sources = [existing_match] if existing_match else []
            if existing_match:
                existing_match.source_id = desired_source_id
            else:
                ingredient.sources.append(
                    IngredientSource(
                        source=desired_source, source_id=desired_source_id
                    )
                )
        else:
            ingredient.sources = []

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
        db.flush()
        if "shopping_unit_id" in payload_fields or "shopping_unit" in payload_fields:
            apply_shopping_unit_selection(
                ingredient,
                ingredient_data.shopping_unit_id,
                ingredient_data.shopping_unit,
            )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))

    # Re-load to include related fields
    statement = select(Ingredient).options(*INGREDIENT_LOAD_OPTIONS).where(
        Ingredient.id == ingredient.id
    )
    ingredient = db.exec(statement).one()
    return ingredient_to_read(ingredient)


@router.delete("/{ingredient_id}")
def delete_ingredient(
    ingredient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete an ingredient."""
    ingredient = _load_visible_ingredient(db, ingredient_id, current_user)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    _ensure_can_modify_ingredient(ingredient, current_user)
    db.delete(ingredient)
    db.commit()
    return {"message": "Ingredient deleted successfully"}


__all__ = ["router"]
