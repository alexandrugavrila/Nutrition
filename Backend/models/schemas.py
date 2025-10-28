from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import ConfigDict, model_validator
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


class IngredientShoppingUnitSelection(SQLModel):
    """Payload for selecting a preferred shopping unit."""

    unit_id: Optional[int] = None
    name: Optional[str] = None
    grams: Optional[float] = None


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
    shopping_unit_id: Optional[int] = None
    shopping_unit: Optional[IngredientShoppingUnitSelection] = None


class IngredientUpdate(SQLModel):
    """Schema for updating an ingredient."""

    name: str
    nutrition: Optional[NutritionCreate] = None
    # Accept units with optional id for proper upsert behavior
    units: List[IngredientUnitUpdate] = Field(default_factory=list)
    tags: List[TagRef] = Field(default_factory=list)
    shopping_unit_id: Optional[int] = None
    shopping_unit: Optional[IngredientShoppingUnitSelection] = None


class IngredientRead(SQLModel):
    """Schema for reading ingredient data."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    nutrition: Optional[Nutrition] = None
    units: List[IngredientUnit] = Field(default_factory=list)
    tags: List[PossibleIngredientTag] = Field(default_factory=list)
    shopping_unit_id: Optional[int] = None
    shopping_unit: Optional[IngredientUnit] = None


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


class PlanCreate(SQLModel):
    """Payload required to persist a plan."""

    label: str
    payload: Dict[str, Any]


class PlanUpdate(SQLModel):
    """Fields allowed when updating a persisted plan."""

    label: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


class PlanRead(SQLModel):
    """Representation of a saved plan returned from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    payload: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class StoredFoodBase(SQLModel):
    """Common fields shared by stored food payloads."""

    label: Optional[str] = None
    user_id: str
    food_id: Optional[int] = None
    ingredient_id: Optional[int] = None
    prepared_portions: float
    per_portion_calories: float
    per_portion_protein: float
    per_portion_carbohydrates: float
    per_portion_fat: float
    per_portion_fiber: float

    @model_validator(mode="after")
    def _validate_source(self) -> "StoredFoodBase":
        """Ensure exactly one of food_id or ingredient_id is provided."""

        if bool(self.food_id) == bool(self.ingredient_id):
            raise ValueError("Provide either food_id or ingredient_id, but not both.")
        return self


class StoredFoodCreate(StoredFoodBase):
    """Schema for creating stored food entries."""

    remaining_portions: Optional[float] = None
    prepared_at: Optional[datetime] = None


class StoredFoodRead(StoredFoodBase):
    """Schema returned when reading stored food entries."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    remaining_portions: float
    is_finished: bool
    prepared_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None


class StoredFoodConsume(SQLModel):
    """Payload for consuming stored food portions."""

    portions: float


__all__ = [
    "NutritionCreate",
    "IngredientUnitCreate",
    "IngredientShoppingUnitSelection",
    "FoodIngredientCreate",
    "TagRef",
    "IngredientCreate",
    "IngredientUpdate",
    "IngredientRead",
    "FoodCreate",
    "FoodUpdate",
    "FoodRead",
    "PlanCreate",
    "PlanUpdate",
    "PlanRead",
    "StoredFoodCreate",
    "StoredFoodRead",
    "StoredFoodConsume",
]
