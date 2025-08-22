from __future__ import annotations

from typing import List, Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String

from .ingredient_tag import IngredientTagLink


class PossibleIngredientTag(SQLModel, table=True):
    """Tag that can be associated with an ingredient."""

    __tablename__ = "possible_ingredient_tags"

    id: Optional[int] = Field(default=None, primary_key=True)
    tag: str = Field(sa_column=Column(String(50), unique=True, nullable=False))

    ingredients: List["Ingredient"] = Relationship(
        back_populates="tags", link_model=IngredientTagLink
    )
