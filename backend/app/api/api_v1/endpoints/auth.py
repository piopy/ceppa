from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import time
from collections import defaultdict

from app.api import deps
from app.core import security
from app.core.db import get_db
from app.models.base import User
from app.schemas import user as user_schema
from app.schemas import token as token_schema

router = APIRouter()

# Rate limit login: max 10 tentativi / 5min per IP+username (in-memory, come generation_status)
_login_attempts: dict = defaultdict(list)
_LOGIN_MAX, _LOGIN_WINDOW = 10, 300


def _limited(key: str) -> bool:
    now = time.time()
    hits = [t for t in _login_attempts[key] if now - t < _LOGIN_WINDOW]
    _login_attempts[key] = hits
    if len(hits) >= _LOGIN_MAX:
        return True
    hits.append(now)
    return False


@router.post("/register", response_model=user_schema.User)
async def register(
    user_in: user_schema.UserCreate, db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Register a new user.
    """
    result = await db.execute(select(User).where(User.username == user_in.username))
    user = result.scalars().first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system",
        )

    user = User(
        username=user_in.username,
        password_hash=security.get_password_hash(user_in.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=token_schema.Token)
async def login_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    key = f"{request.client.host}:{form_data.username}"
    if _limited(key):
        raise HTTPException(status_code=429, detail="Troppi tentativi. Riprova tra qualche minuto.")
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalars().first()

    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    access_token_expires = timedelta(minutes=60 * 24 * 8)  # 8 days for dev
    return {
        "access_token": security.create_access_token(
            user.username, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=token_schema.Token)
async def refresh_token(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Nuovo token da uno ancora valido (rotazione scadenza)."""
    access_token_expires = timedelta(minutes=60 * 24 * 8)
    return {
        "access_token": security.create_access_token(
            current_user.username, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.post("/logout")
async def logout() -> Any:
    """JWT stateless: il client cancella il token. Endpoint di parità (nessuna denylist)."""
    return {"message": "Logged out"}
