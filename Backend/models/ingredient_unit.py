from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field

PositiveInt = Annotated[int, Field(gt=0)]
Name50 = Annotated[str, Field(min_length=1, max_length=50)]
Decimal4 = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=4)]


class IngredientUnitModel(BaseModel):
    """Measurement unit for an ingredient."""

    id: Optional[PositiveInt] = None
    ingredient_id: Optional[PositiveInt] = None
    name: Name50
    grams: Decimal4

    model_config = ConfigDict(from_attributes=True)
