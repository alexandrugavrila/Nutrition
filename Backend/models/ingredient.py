from typing import List, Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String

from .ingredient_unit import IngredientUnit
from .nutrition import Nutrition
from .possible_ingredient_tag import PossibleIngredientTag
from .ingredient_tag import IngredientTagLink


class Ingredient(SQLModel, table=True):
    """Core ingredient information."""

    __tablename__ = "ingredients"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(100), unique=True, nullable=False))

    nutrition: Optional[Nutrition] = Relationship(
        back_populates="ingredient",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    units: List[IngredientUnit] = Relationship(
        back_populates="ingredient",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    tags: List[PossibleIngredientTag] = Relationship(
        back_populates="ingredients", link_model=IngredientTagLink
    )
