from __future__ import annotations

from typing import Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Numeric


class MealIngredient(SQLModel, table=True):
    """Link between a meal and an ingredient with quantity information."""

    __tablename__ = "meal_ingredients"

    ingredient_id: int = Field(foreign_key="ingredients.id", primary_key=True)
    meal_id: int = Field(foreign_key="meals.id", primary_key=True)
    unit_id: Optional[int] = Field(default=None, foreign_key="ingredient_units.id")
    unit_quantity: Optional[float] = Field(
        default=None, sa_column=Column(Numeric(10, 4))
    )

    ingredient: Optional["Ingredient"] = Relationship()
    meal: Optional["Meal"] = Relationship(back_populates="ingredients")
    unit: Optional["IngredientUnit"] = Relationship()
