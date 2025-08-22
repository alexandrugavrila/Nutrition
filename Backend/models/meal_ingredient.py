from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field

from .ingredient import IngredientModel
from .ingredient_unit import IngredientUnitModel

PositiveInt = Annotated[int, Field(gt=0)]
Decimal4 = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=4)]


class MealIngredientModel(BaseModel):
    """Link between a meal and an ingredient with quantity information."""

    ingredient_id: PositiveInt
    meal_id: Optional[PositiveInt] = None
    unit_id: Optional[PositiveInt] = None
    unit_quantity: Optional[Decimal4] = None
    ingredient: Optional[IngredientModel] = None
    unit: Optional[IngredientUnitModel] = None

    model_config = ConfigDict(from_attributes=True)
