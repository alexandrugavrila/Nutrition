from typing import Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Numeric


class IngredientUnit(SQLModel, table=True):
    """Measurement unit for an ingredient."""

    __tablename__ = "ingredient_units"

    id: Optional[int] = Field(default=None, primary_key=True)
    ingredient_id: Optional[int] = Field(
        default=None, foreign_key="ingredients.id"
    )
    name: str = Field(sa_column=Column(String(50), nullable=False))
    grams: float = Field(sa_column=Column(Numeric(10, 4, asdecimal=False), nullable=False))

    ingredient: Optional["Ingredient"] = Relationship(back_populates="units")
