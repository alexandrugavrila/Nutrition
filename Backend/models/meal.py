from typing import List, Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String

from .meal_ingredient import MealIngredient
from .possible_meal_tag import PossibleMealTag
from .meal_tag import MealTagLink


class Meal(SQLModel, table=True):
    """Meal with associated ingredients and tags."""

    __tablename__ = "meals"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(100), unique=True, nullable=False))

    ingredients: List[MealIngredient] = Relationship(
        back_populates="meal",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    tags: List[PossibleMealTag] = Relationship(
        back_populates="meals", link_model=MealTagLink
    )
