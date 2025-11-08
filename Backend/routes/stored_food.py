"""Routes for managing stored food entries."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session, select
from sqlalchemy import delete, func, inspect
from sqlalchemy.exc import SQLAlchemyError

from ..db import get_db
from ..models import (
    DailyLogEntry,
    Food,
    Ingredient,
    StoredFood,
    StoredFoodConsume,
    StoredFoodCreate,
    StoredFoodRead,
)

router = APIRouter(prefix="/stored_food", tags=["stored_food"])


_UNAVAILABLE_DETAIL = (
    "Stored food storage is unavailable because the database schema is out of date. "
    "Run the latest database migrations and try again."
)


def _apply_filters(
    statement,
    user_id: Optional[str],
    only_available: bool,
    day: Optional[date],
):
    """Apply list filters to the stored food select statement."""

    if user_id:
        statement = statement.where(StoredFood.user_id == user_id)
    if only_available:
        statement = statement.where(StoredFood.remaining_portions > 0)
    if day:
        statement = statement.where(func.date(StoredFood.prepared_at) == day)
    return statement


def _stored_food_table_available(db: Session) -> bool:
    """Return ``True`` when the stored_food table exists in the database."""

    try:
        bind = db.get_bind()
    except SQLAlchemyError:
        return False

    try:
        inspector = inspect(bind)
    except SQLAlchemyError:
        return False

    try:
        return inspector.has_table(StoredFood.__tablename__)
    except SQLAlchemyError:
        return False


@router.post("/", response_model=StoredFoodRead, status_code=201)
def create_stored_food(
    payload: StoredFoodCreate, db: Session = Depends(get_db)
) -> StoredFoodRead:
    """Persist a new stored food entry."""

    if not _stored_food_table_available(db):
        raise HTTPException(
            status_code=503,
            detail=_UNAVAILABLE_DETAIL,
        )

    data = payload.model_dump(exclude_unset=True)
    remaining = data.pop("remaining_portions", None)
    prepared_at = data.pop("prepared_at", None)

    if data.get("food_id") is not None and db.get(Food, data["food_id"]) is None:
        raise HTTPException(status_code=404, detail="Food not found")
    if data.get("ingredient_id") is not None and db.get(Ingredient, data["ingredient_id"]) is None:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    if prepared_at is None:
        prepared_at = datetime.now(timezone.utc)

    if remaining is None:
        remaining = data["prepared_portions"]

    stored_food = StoredFood(
        **data,
        prepared_at=prepared_at,
        remaining_portions=max(0.0, float(remaining)),
    )
    stored_food.is_finished = stored_food.remaining_portions <= 0
    if stored_food.is_finished:
        stored_food.completed_at = datetime.now(timezone.utc)

    db.add(stored_food)
    db.commit()
    db.refresh(stored_food)
    return StoredFoodRead.model_validate(stored_food)


@router.get("/", response_model=List[StoredFoodRead])
def list_stored_food(
    db: Session = Depends(get_db),
    user_id: Optional[str] = Query(default=None),
    only_available: bool = Query(default=False),
    day: Optional[date] = Query(default=None),
) -> List[StoredFoodRead]:
    """Retrieve stored food entries with optional filters."""

    if not _stored_food_table_available(db):
        return []

    statement = select(StoredFood).order_by(StoredFood.prepared_at.desc())
    statement = _apply_filters(statement, user_id, only_available, day)
    results = db.exec(statement).all()
    return [StoredFoodRead.model_validate(item) for item in results]


@router.post("/{stored_food_id}/consume", response_model=StoredFoodRead)
def consume_stored_food(
    stored_food_id: int,
    payload: StoredFoodConsume,
    db: Session = Depends(get_db),
) -> StoredFoodRead:
    """Consume portions from a stored food entry."""

    if not _stored_food_table_available(db):
        raise HTTPException(
            status_code=503,
            detail=_UNAVAILABLE_DETAIL,
        )

    stored_food = db.get(StoredFood, stored_food_id)
    if not stored_food:
        raise HTTPException(status_code=404, detail="Stored food not found")

    if payload.portions <= 0:
        raise HTTPException(status_code=400, detail="Portions must be greater than zero")

    if stored_food.remaining_portions <= 0:
        raise HTTPException(status_code=400, detail="No portions remaining")

    if payload.portions > stored_food.remaining_portions:
        raise HTTPException(
            status_code=400, detail="Cannot consume more portions than remain"
        )

    stored_food.remaining_portions = max(0.0, stored_food.remaining_portions - payload.portions)
    stored_food.is_finished = stored_food.remaining_portions <= 0
    if stored_food.is_finished:
        stored_food.completed_at = datetime.now(timezone.utc)
    db.add(stored_food)
    db.commit()
    db.refresh(stored_food)
    return StoredFoodRead.model_validate(stored_food)


@router.delete(
    "/{stored_food_id}",
    status_code=204,
    response_class=Response,
    response_model=None,
)
def delete_stored_food(stored_food_id: int, db: Session = Depends(get_db)) -> None:
    """Remove a stored food entry."""

    if not _stored_food_table_available(db):
        raise HTTPException(status_code=503, detail=_UNAVAILABLE_DETAIL)

    stored_food = db.get(StoredFood, stored_food_id)
    if stored_food is None:
        raise HTTPException(status_code=404, detail="Stored food not found")

    entries = db.exec(
        select(DailyLogEntry).where(DailyLogEntry.stored_food_id == stored_food_id)
    ).all()
    for entry in entries:
        entry.stored_food_id = None
        if stored_food.food_id is not None:
            entry.food_id = stored_food.food_id
            entry.ingredient_id = None
        elif stored_food.ingredient_id is not None:
            entry.ingredient_id = stored_food.ingredient_id
            entry.food_id = None

    db.delete(stored_food)
    db.commit()


@router.delete(
    "/",
    status_code=204,
    response_class=Response,
    response_model=None,
)
def clear_stored_food(user_id: str = Query(...), db: Session = Depends(get_db)) -> None:
    """Remove all stored food entries for a user."""

    if not _stored_food_table_available(db):
        return

    statement = delete(StoredFood).where(StoredFood.user_id == user_id)
    db.exec(statement)
    db.commit()
