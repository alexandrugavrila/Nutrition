# models/ingredient.py
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from db import Base
from .ingredient_tag import ingredient_tags


class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    nutrition = relationship(
        "Nutrition", backref="ingredient", uselist=False, cascade="all, delete-orphan"
    )
    units = relationship(
        "IngredientUnit", backref="ingredient", cascade="all, delete-orphan"
    )
    tags = relationship(
        "PossibleIngredientTag", secondary=ingredient_tags, backref="ingredients"
    )

