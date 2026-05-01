"""FastAPI authentication dependencies."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session

from Backend.auth.sessions import get_user_by_session_token
from Backend.db import get_db
from Backend.models import User
from Backend.settings import settings


def _extract_session_token(request: Request) -> str | None:
    return request.cookies.get(settings.session_cookie_name)


def get_optional_current_user(
    request: Request, db: Session = Depends(get_db)
) -> User | None:
    """Return the authenticated user when a valid session cookie is present."""

    token = _extract_session_token(request)
    if not token:
        return None
    return get_user_by_session_token(db, token)


def get_current_user(
    request: Request, db: Session = Depends(get_db)
) -> User:
    """Require an authenticated user."""

    user = get_optional_current_user(request, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return user


def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Require an authenticated admin account."""

    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return current_user


__all__ = ["get_optional_current_user", "get_current_user", "require_admin_user"]
