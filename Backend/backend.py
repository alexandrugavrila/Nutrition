"""FastAPI application entry point."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import Base, engine
from routes.ingredients import router as ingredient_router
from routes.meals import router as meal_router

app = FastAPI()

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
app.include_router(ingredient_router, prefix="/api")
app.include_router(meal_router, prefix="/api")


@app.on_event("startup")
def _create_tables() -> None:
    """Create database tables if DB_AUTO_CREATE is set."""
    if os.getenv("DB_AUTO_CREATE", "").lower() in {"1", "true", "t"}:
        Base.metadata.create_all(bind=engine)


__all__ = ["app"]

