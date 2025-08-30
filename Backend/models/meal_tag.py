from sqlmodel import SQLModel, Field


class MealTagLink(SQLModel, table=True):
    """Association table linking meals and tags."""

    __tablename__ = "meal_tags"

    meal_id: int = Field(foreign_key="meals.id", primary_key=True)
    tag_id: int = Field(foreign_key="possible_meal_tags.id", primary_key=True)
