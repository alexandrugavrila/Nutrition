from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import CheckConstraint, Column, Date, DateTime, Float, ForeignKey, Index, String, func
from sqlmodel import Field, SQLModel


class DailyLogEntry(SQLModel, table=True):
    """Record of consumed portions for a given day."""

    __tablename__ = "daily_log_entries"
    __table_args__ = (
        CheckConstraint(
            "((stored_food_id IS NOT NULL AND ingredient_id IS NULL AND food_id IS NULL) "
            "OR (stored_food_id IS NULL AND ingredient_id IS NOT NULL AND food_id IS NULL) "
            "OR (stored_food_id IS NULL AND ingredient_id IS NULL AND food_id IS NOT NULL))",
            name="daily_log_entries_source_ck",
        ),
        Index("ix_daily_log_entries_user_date", "user_id", "log_date"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(sa_column=Column(String(255), nullable=False, index=True))
    log_date: date = Field(sa_column=Column(Date, nullable=False, index=True))
    stored_food_id: Optional[int] = Field(
        default=None,
        sa_column=Column(ForeignKey("stored_food.id", ondelete="SET NULL")),
    )
    ingredient_id: Optional[int] = Field(
        default=None,
        sa_column=Column(ForeignKey("ingredients.id", ondelete="SET NULL")),
    )
    food_id: Optional[int] = Field(
        default=None,
        sa_column=Column(ForeignKey("foods.id", ondelete="SET NULL")),
    )
    portions_consumed: float = Field(sa_column=Column(Float, nullable=False))
    calories: float = Field(sa_column=Column(Float, nullable=False))
    protein: float = Field(sa_column=Column(Float, nullable=False))
    carbohydrates: float = Field(sa_column=Column(Float, nullable=False))
    fat: float = Field(sa_column=Column(Float, nullable=False))
    fiber: float = Field(sa_column=Column(Float, nullable=False))
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
        )
    )


__all__ = ["DailyLogEntry"]
