"""SQLAlchemy ORM models package.

Importing this package registers all models with the shared ``Base`` metadata
so Alembic's autogenerate feature can detect schema changes.
"""

from ..db import Base

from .ingredient import Ingredient
from .ingredient_unit import IngredientUnit
from .ingredient_tag import ingredient_tags
from .meal import Meal
from .meal_ingredient import MealIngredient
from .meal_tag import meal_tags
from .nutrition import Nutrition
from .possible_ingredient_tag import PossibleIngredientTag
from .possible_meal_tag import PossibleMealTag

__all__ = [
    "Base",
    "Ingredient",
    "IngredientUnit",
    "ingredient_tags",
    "Meal",
    "MealIngredient",
    "meal_tags",
    "Nutrition",
    "PossibleIngredientTag",
    "PossibleMealTag",
]
