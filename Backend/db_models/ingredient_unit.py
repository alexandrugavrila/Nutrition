# db_models/meal_ingredients.py
from sqlalchemy import Column, ForeignKey, Integer, Numeric, String

from db import Base


class IngredientUnit(Base):
    __tablename__ = "ingredient_units"

    id = Column(Integer, primary_key=True)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=False)
    name = Column(String(50), nullable=False)
    grams = Column(Numeric(10, 4), nullable=False)