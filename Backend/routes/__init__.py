"""Router exports for the Backend routes package."""

from .ingredients import router as ingredients_router
from .foods import router as foods_router
from .plans import router as plans_router

__all__ = ["ingredients_router", "foods_router", "plans_router"]
