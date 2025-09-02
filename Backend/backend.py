"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from Backend.db import Base, engine
from Backend.routes import ingredients_router, foods_router
from Backend.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup and shutdown logic for the application."""
    if settings.db_auto_create:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(lifespan=lifespan)

# Enable very permissive CORS so the frontend can communicate with the API
# during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prefix all API routes with /api so the frontend can proxy requests.
app.include_router(ingredients_router, prefix="/api")
app.include_router(foods_router, prefix="/api")


__all__ = ["app"]

