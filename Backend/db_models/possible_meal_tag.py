# models/meal_ingredients.py
from sqlalchemy import Column, Integer, String

from ..db import Base


class PossibleMealTag(Base):
    __tablename__ = "possible_meal_tags"

    id = Column(Integer, primary_key=True)
    tag = Column(String(50), nullable=False, unique=True)

