from typing import List, Optional

from sqlalchemy import Column, String, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from .ingredient_tag import IngredientTagLink


class PossibleIngredientTag(SQLModel, table=True):
    """Tag that can be associated with an ingredient."""

    __tablename__ = "possible_ingredient_tags"

    __table_args__ = (
        UniqueConstraint("name", "group", name="uq_possible_ingredient_tags_name_group"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(50), nullable=False))
    group: str = Field(sa_column=Column("group", String(50), nullable=False))

    ingredients: List["Ingredient"] = Relationship(
        back_populates="tags", link_model=IngredientTagLink
    )
