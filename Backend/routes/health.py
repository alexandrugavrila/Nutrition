"""Operational health endpoints for liveness/readiness checks."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from Backend.db import SessionLocal

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def liveness() -> dict[str, str]:
    """Report process liveness for container orchestrators."""
    return {"status": "live"}


@router.get("/ready")
def readiness() -> dict[str, str]:
    """Report readiness only when the API can reach the database."""
    with SessionLocal() as session:
        try:
            session.exec(text("SELECT 1"))
        except Exception as exc:  # pragma: no cover - defensive container probe path
            raise HTTPException(status_code=503, detail="database_unavailable") from exc

    return {
        "status": "ready",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "dependencies": "database",
    }
