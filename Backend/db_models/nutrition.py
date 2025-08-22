# models/nutrition.py
from sqlalchemy import Column, ForeignKey, Integer, Numeric

from db import Base


class Nutrition(Base):
    __tablename__ = "nutrition"

    id = Column(Integer, primary_key=True)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=False)
    calories = Column(Numeric(10, 4), nullable=False)
    fat = Column(Numeric(10, 4), nullable=False)
    carbohydrates = Column(Numeric(10, 4), nullable=False)
    protein = Column(Numeric(10, 4), nullable=False)
    fiber = Column(Numeric(10, 4), nullable=False)

