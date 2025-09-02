from typing import List, Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String

from .food_tag import FoodTagLink


class PossibleFoodTag(SQLModel, table=True):
    """Tag that can be associated with a food."""

    __tablename__ = "possible_food_tags"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(50), unique=True, nullable=False))

    foods: List["Food"] = Relationship(
        back_populates="tags", link_model=FoodTagLink
    )
