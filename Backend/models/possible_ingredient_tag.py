from typing import List, Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, UniqueConstraint

from .ingredient_tag import IngredientTagLink


class PossibleIngredientTag(SQLModel, table=True):
    """Tag that can be associated with an ingredient."""

    __tablename__ = "possible_ingredient_tags"
    __table_args__ = (UniqueConstraint("name", "group"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(50), nullable=False))
    group: str = Field(sa_column=Column(String(50), nullable=False))

    ingredients: List["Ingredient"] = Relationship(
        back_populates="tags", link_model=IngredientTagLink
    )
