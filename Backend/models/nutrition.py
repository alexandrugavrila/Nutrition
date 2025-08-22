from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field

PositiveInt = Annotated[int, Field(gt=0)]
Decimal4 = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=4)]


class NutritionModel(BaseModel):
    """Nutritional information for a single ingredient."""

    id: Optional[PositiveInt] = None
    ingredient_id: PositiveInt
    calories: Decimal4
    fat: Decimal4
    carbohydrates: Decimal4
    protein: Decimal4
    fiber: Decimal4

    model_config = ConfigDict(from_attributes=True)
