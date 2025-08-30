from typing import Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Numeric


class Nutrition(SQLModel, table=True):
    """Nutritional information for a single ingredient."""

    __tablename__ = "nutrition"

    id: Optional[int] = Field(default=None, primary_key=True)
    ingredient_id: Optional[int] = Field(
        default=None, foreign_key="ingredients.id", nullable=False
    )
    calories: float = Field(sa_column=Column(Numeric(10, 4, asdecimal=False), nullable=False))
    fat: float = Field(sa_column=Column(Numeric(10, 4, asdecimal=False), nullable=False))
    carbohydrates: float = Field(sa_column=Column(Numeric(10, 4, asdecimal=False), nullable=False))
    protein: float = Field(sa_column=Column(Numeric(10, 4, asdecimal=False), nullable=False))
    fiber: float = Field(sa_column=Column(Numeric(10, 4, asdecimal=False), nullable=False))

    ingredient: Optional["Ingredient"] = Relationship(back_populates="nutrition")
