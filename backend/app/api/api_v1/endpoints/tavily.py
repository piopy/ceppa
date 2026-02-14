from typing import Any
from fastapi import APIRouter, Depends

from app.api import deps
from app.models.base import User
from app.services.tavily_service import TavilyService

router = APIRouter()


@router.get("/credits")
async def get_tavily_credits(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get Tavily API usage and remaining credits.
    Returns current usage, limit, and remaining credits.
    Uses user's custom Tavily key if configured.
    """
    tavily = TavilyService.for_user(current_user)
    return await tavily.get_credits_info()
