from typing import List, Optional, TYPE_CHECKING

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String

from .ingredient_unit import IngredientUnit
from .nutrition import Nutrition
from .possible_ingredient_tag import PossibleIngredientTag
from .ingredient_tag import IngredientTagLink

if TYPE_CHECKING:  # pragma: no cover - only for type checking
    from .schemas import IngredientCreate


class Ingredient(SQLModel, table=True):
    """Core ingredient information."""

    __tablename__ = "ingredients"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(100), unique=True, nullable=False))

    nutrition: Optional[Nutrition] = Relationship(
        back_populates="ingredient",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    units: List[IngredientUnit] = Relationship(
        back_populates="ingredient",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    tags: List[PossibleIngredientTag] = Relationship(
        back_populates="ingredients", link_model=IngredientTagLink
    )

    @classmethod
    def from_create(cls, data: "IngredientCreate") -> "Ingredient":
        """Create an :class:`Ingredient` ORM object from an ``IngredientCreate`` schema."""

        ingredient = cls(name=data.name)

        if data.nutrition:
            ingredient.nutrition = Nutrition.model_validate(
                data.nutrition.model_dump()
            )

        ingredient.units = [
            IngredientUnit.model_validate(unit.model_dump()) for unit in data.units
        ]

        # Tags are resolved separately in the routes using the database session
        # to load existing ``PossibleIngredientTag`` records by ID.
        # ``Ingredient.from_create`` therefore leaves the ``tags`` collection
        # empty so that the routes can populate it appropriately.

        return ingredient
