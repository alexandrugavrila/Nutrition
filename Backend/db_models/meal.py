# models/meal.py
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from ..db import Base
from .meal_tag import meal_tags


class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    ingredients = relationship(
        "MealIngredient", backref="meal", cascade="all, delete-orphan"
    )
    tags = relationship("PossibleMealTag", secondary=meal_tags, backref="meals")
