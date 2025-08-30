from sqlmodel import SQLModel, Field


class IngredientTagLink(SQLModel, table=True):
    """Association table linking ingredients and tags."""

    __tablename__ = "ingredient_tags"

    ingredient_id: int = Field(foreign_key="ingredients.id", primary_key=True)
    tag_id: int = Field(foreign_key="possible_ingredient_tags.id", primary_key=True)
