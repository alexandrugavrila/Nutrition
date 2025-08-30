"""FastAPI application entry point."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from Backend.db import Base, engine
from Backend.routes import ingredients_router, meals_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup and shutdown logic for the application."""
    if os.getenv("DB_AUTO_CREATE", "").lower() in {"1", "true", "t"}:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(lifespan=lifespan)

# Enable very permissive CORS so the frontend can communicate with the API
# during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prefix all API routes with /api so the frontend can proxy requests.
app.include_router(ingredients_router, prefix="/api")
app.include_router(meals_router, prefix="/api")


__all__ = ["app"]

