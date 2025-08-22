from __future__ import annotations

from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field

PositiveInt = Annotated[int, Field(gt=0)]
Name50 = Annotated[str, Field(min_length=1, max_length=50)]


class PossibleIngredientTagModel(BaseModel):
    """Tag that can be associated with an ingredient."""

    id: Optional[PositiveInt] = None
    tag: Optional[Name50] = None

    model_config = ConfigDict(from_attributes=True)
