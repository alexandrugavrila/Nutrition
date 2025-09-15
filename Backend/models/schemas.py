from typing import List, Optional

from pydantic import ConfigDict
from sqlmodel import SQLModel, Field

from .ingredient_unit import IngredientUnit
from .nutrition import Nutrition
from .food_ingredient import FoodIngredient
from .possible_ingredient_tag import PossibleIngredientTag
from .possible_food_tag import PossibleFoodTag


class NutritionCreate(SQLModel):
    """Schema for creating nutrition data."""

    calories: float
    fat: float
    carbohydrates: float
    protein: float
    fiber: float


class IngredientUnitCreate(SQLModel):
    """Schema for creating ingredient unit data."""

    name: str
    grams: float


class IngredientUnitUpdate(SQLModel):
    """Schema for updating ingredient unit data (allows id for upsert)."""

    id: Optional[int] = None
    name: str
    grams: float


class FoodIngredientCreate(SQLModel):
    """Schema for creating food ingredient linkage."""

    ingredient_id: int
    unit_id: Optional[int] = None
    unit_quantity: Optional[float] = None


class TagRef(SQLModel):
    """Reference to an existing tag by ID."""

    id: int


class IngredientCreate(SQLModel):
    """Schema for creating an ingredient."""

    name: str
    nutrition: Optional[NutritionCreate] = None
    units: List[IngredientUnitCreate] = Field(default_factory=list)
    tags: List[TagRef] = Field(default_factory=list)


class IngredientUpdate(SQLModel):
    """Schema for updating an ingredient."""

    name: str
    nutrition: Optional[NutritionCreate] = None
    # Accept units with optional id for proper upsert behavior
    units: List[IngredientUnitUpdate] = Field(default_factory=list)
    tags: List[TagRef] = Field(default_factory=list)


class IngredientRead(SQLModel):
    """Schema for reading ingredient data."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    nutrition: Optional[Nutrition] = None
    units: List[IngredientUnit] = Field(default_factory=list)
    tags: List[PossibleIngredientTag] = Field(default_factory=list)


class FoodCreate(SQLModel):
    """Schema for creating a food."""

    name: str
    ingredients: List[FoodIngredientCreate] = Field(default_factory=list)
    tags: List[TagRef] = Field(default_factory=list)


class FoodUpdate(FoodCreate):
    """Schema for updating a food."""

    pass


class FoodRead(SQLModel):
    """Schema for reading food data."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    ingredients: List[FoodIngredient] = Field(default_factory=list)
    tags: List[PossibleFoodTag] = Field(default_factory=list)


__all__ = [
    "NutritionCreate",
    "IngredientUnitCreate",
    "FoodIngredientCreate",
    "TagRef",
    "IngredientCreate",
    "IngredientUpdate",
    "IngredientRead",
    "FoodCreate",
    "FoodUpdate",
    "FoodRead",
]
