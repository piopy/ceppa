from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.db import get_db
from app.core.security import encrypt_value, decrypt_value
from app.models.base import User
from app.schemas import user as user_schema

router = APIRouter()


def _user_to_out(user: User) -> dict:
    """Convert user model to output dict, decrypting API keys for display (masked)."""
    return {
        "id": user.id,
        "username": user.username,
        # Decrypt keys for the frontend - they'll be shown masked in password fields
        "custom_openai_api_key": decrypt_value(user.custom_openai_api_key) if user.custom_openai_api_key else None,
        "custom_openai_base_url": user.custom_openai_base_url,
        "custom_llm_model": user.custom_llm_model,
        "custom_tavily_api_key": decrypt_value(user.custom_tavily_api_key) if user.custom_tavily_api_key else None,
    }


@router.get("/me")
async def get_current_user_profile(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user profile with custom LLM settings.
    """
    return _user_to_out(current_user)


@router.put("/me/settings")
async def update_user_settings(
    settings_in: user_schema.UserSettingsUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Update user's custom LLM and Tavily settings.
    Pass null/empty string to clear a setting (reverts to global default).
    API keys are encrypted before storage.
    """
    if settings_in.custom_openai_api_key is not None:
        val = settings_in.custom_openai_api_key or None
        current_user.custom_openai_api_key = encrypt_value(val) if val else None
    if settings_in.custom_openai_base_url is not None:
        current_user.custom_openai_base_url = settings_in.custom_openai_base_url or None
    if settings_in.custom_llm_model is not None:
        current_user.custom_llm_model = settings_in.custom_llm_model or None
    if settings_in.custom_tavily_api_key is not None:
        val = settings_in.custom_tavily_api_key or None
        current_user.custom_tavily_api_key = encrypt_value(val) if val else None

    await db.commit()
    await db.refresh(current_user)
    return _user_to_out(current_user)
