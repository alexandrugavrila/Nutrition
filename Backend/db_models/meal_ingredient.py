# models/meal_ingredients.py
from sqlalchemy import (
    Column,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
)
from sqlalchemy.orm import relationship

from ..db import Base


class MealIngredient(Base):
    __tablename__ = "meal_ingredients"

    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), primary_key=True)
    meal_id = Column(Integer, ForeignKey("meals.id"), primary_key=True)
    unit_id = Column(Integer, ForeignKey("ingredient_units.id"))
    unit_quantity = Column(Numeric(10, 4))

    unit = relationship("IngredientUnit")
    __table_args__ = (
        ForeignKeyConstraint(["unit_id"], ["ingredient_units.id"]),
    )
