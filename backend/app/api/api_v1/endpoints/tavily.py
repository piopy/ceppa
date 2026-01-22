from typing import Any
from fastapi import APIRouter, Depends

from app.api import deps
from app.models.base import User
from app.services.tavily_service import tavily_service

router = APIRouter()


@router.get("/credits")
async def get_tavily_credits(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get Tavily API usage and remaining credits.
    Returns current usage, limit, and remaining credits.
    """
    return tavily_service.get_credits_info()
