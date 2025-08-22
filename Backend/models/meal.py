from __future__ import annotations

from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .meal_ingredient import MealIngredientModel
from .possible_meal_tag import PossibleMealTagModel

PositiveInt = Annotated[int, Field(gt=0)]
Name100 = Annotated[str, Field(min_length=1, max_length=100)]


class MealModel(BaseModel):
    """Meal with associated ingredients and tags."""

    id: Optional[PositiveInt] = None
    name: Name100
    ingredients: List[MealIngredientModel] = Field(default_factory=list)
    tags: List[PossibleMealTagModel] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
