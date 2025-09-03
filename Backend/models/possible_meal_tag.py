from typing import List, Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, UniqueConstraint

from .meal_tag import MealTagLink


class PossibleMealTag(SQLModel, table=True):
    """Tag that can be associated with a meal."""

    __tablename__ = "possible_meal_tags"
    __table_args__ = (UniqueConstraint("name", "group"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(50), nullable=False))
    group: str = Field(sa_column=Column(String(50), nullable=False))

    meals: List["Meal"] = Relationship(
        back_populates="tags", link_model=MealTagLink
    )
