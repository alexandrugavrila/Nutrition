"""Routes for managing daily consumption logs."""

from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..db import get_db
from ..models import (
    DailyLogEntry,
    DailyLogEntryCreate,
    DailyLogEntryRead,
    Food,
    Ingredient,
    StoredFood,
)

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/{log_date}", response_model=List[DailyLogEntryRead])
def list_daily_logs(
    log_date: date,
    db: Session = Depends(get_db),
    user_id: Optional[str] = Query(default=None),
) -> List[DailyLogEntryRead]:
    """Return all log entries for a specific day."""

    statement = select(DailyLogEntry).where(DailyLogEntry.log_date == log_date)
    if user_id:
        statement = statement.where(DailyLogEntry.user_id == user_id)
    statement = statement.order_by(DailyLogEntry.created_at, DailyLogEntry.id)
    results = db.exec(statement).all()
    return [DailyLogEntryRead.model_validate(entry) for entry in results]


@router.post("/", response_model=DailyLogEntryRead, status_code=201)
def create_daily_log(
    payload: DailyLogEntryCreate,
    db: Session = Depends(get_db),
) -> DailyLogEntryRead:
    """Persist a new daily log entry."""

    if payload.stored_food_id is not None:
        if db.get(StoredFood, payload.stored_food_id) is None:
            raise HTTPException(status_code=404, detail="Stored food not found")
    if payload.ingredient_id is not None:
        if db.get(Ingredient, payload.ingredient_id) is None:
            raise HTTPException(status_code=404, detail="Ingredient not found")
    if payload.food_id is not None:
        if db.get(Food, payload.food_id) is None:
            raise HTTPException(status_code=404, detail="Food not found")

    entry = DailyLogEntry(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return DailyLogEntryRead.model_validate(entry)
