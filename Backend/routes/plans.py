from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..db import get_db
from ..models import Plan, PlanCreate, PlanRead, PlanUpdate

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("/", response_model=List[PlanRead])
def list_plans(db: Session = Depends(get_db)) -> List[PlanRead]:
    """Return all saved plans ordered by last update descending."""
    statement = select(Plan).order_by(Plan.updated_at.desc())
    plans = db.exec(statement).all()
    return [PlanRead.model_validate(plan) for plan in plans]


@router.get("/{plan_id}", response_model=PlanRead)
def get_plan(plan_id: int, db: Session = Depends(get_db)) -> PlanRead:
    """Retrieve a single plan by ID."""
    plan = db.get(Plan, plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found"
        )
    return PlanRead.model_validate(plan)


@router.post("/", response_model=PlanRead, status_code=status.HTTP_201_CREATED)
def create_plan(payload: PlanCreate, db: Session = Depends(get_db)) -> PlanRead:
    """Persist a new plan payload."""
    plan = Plan(label=payload.label.strip(), payload=payload.payload)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return PlanRead.model_validate(plan)


@router.put("/{plan_id}", response_model=PlanRead)
def update_plan(
    plan_id: int, payload: PlanUpdate, db: Session = Depends(get_db)
) -> PlanRead:
    """Update an existing plan."""
    plan = db.get(Plan, plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found"
        )

    if payload.label is not None:
        plan.label = payload.label.strip()
    if payload.payload is not None:
        plan.payload = payload.payload

    db.add(plan)
    db.commit()
    db.refresh(plan)
    return PlanRead.model_validate(plan)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(plan_id: int, db: Session = Depends(get_db)) -> None:
    """Delete an existing plan."""
    plan = db.get(Plan, plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found"
        )
    db.delete(plan)
    db.commit()
    return None


__all__ = ["router"]
