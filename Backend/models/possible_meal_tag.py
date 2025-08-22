from __future__ import annotations

from typing import List, Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String

from .meal_tag import MealTagLink


class PossibleMealTag(SQLModel, table=True):
    """Tag that can be associated with a meal."""

    __tablename__ = "possible_meal_tags"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(50), unique=True, nullable=False))

    meals: List["Meal"] = Relationship(
        back_populates="tags", link_model=MealTagLink
    )
