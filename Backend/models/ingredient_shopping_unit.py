from __future__ import annotations

from typing import Optional

from sqlalchemy import Column, ForeignKey, ForeignKeyConstraint, Integer
from sqlmodel import Field, Relationship, SQLModel

from .ingredient import Ingredient
from .ingredient_unit import IngredientUnit


class IngredientShoppingUnit(SQLModel, table=True):
    """Preferred shopping unit for an ingredient."""

    __tablename__ = "ingredient_shopping_units"
    __table_args__ = (
        ForeignKeyConstraint(
            ["ingredient_id", "unit_id"],
            ["ingredient_units.ingredient_id", "ingredient_units.id"],
            name="fk_shopping_unit_matches_ingredient",
        ),
    )

    ingredient_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("ingredients.id", ondelete="CASCADE"),
            primary_key=True,
        )
    )
    unit_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            Integer,
            ForeignKey("ingredient_units.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    ingredient: Ingredient = Relationship(back_populates="shopping_unit")
    unit: IngredientUnit = Relationship(
        sa_relationship_kwargs={"foreign_keys": "IngredientShoppingUnit.unit_id"}
    )


__all__ = ["IngredientShoppingUnit"]
