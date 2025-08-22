"""FastAPI application entry point."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from flask import Flask

from db import db
from routes.ingredients import router as ingredient_router
from routes.meals import router as meal_router

# Configure the database connection string. Historically the application looked
# for `SQLALCHEMY_DATABASE_URI`, but docker-compose provides the URL via the
# more conventional `DATABASE_URL`. Attempt to read either environment variable
# and fall back to the default connection string used by the development stack.
DATABASE_URL = (
    os.getenv("SQLALCHEMY_DATABASE_URI")
    or os.getenv(
        "DATABASE_URL", "postgresql://nutrition_user:nutrition_pass@db:5432/nutrition"
    )
)

# ``flask_sqlalchemy`` expects a Flask application context. Create a minimal
# Flask app solely for managing the SQLAlchemy session used by the existing
# models.
_flask_app = Flask(__name__)
_flask_app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
db.init_app(_flask_app)
_flask_app.app_context().push()

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
        db.create_all()


__all__ = ["app"]

