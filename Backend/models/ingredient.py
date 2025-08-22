from __future__ import annotations

from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .ingredient_unit import IngredientUnitModel
from .nutrition import NutritionModel
from .possible_ingredient_tag import PossibleIngredientTagModel

PositiveInt = Annotated[int, Field(gt=0)]
Name100 = Annotated[str, Field(min_length=1, max_length=100)]


class IngredientModel(BaseModel):
    """Core ingredient information."""

    id: Optional[PositiveInt] = None
    name: Name100
    nutrition: Optional[NutritionModel] = None
    units: List[IngredientUnitModel] = Field(default_factory=list)
    tags: List[PossibleIngredientTagModel] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
