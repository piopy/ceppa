from typing import Any
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, distinct

from app.api import deps
from app.core.db import get_db
from app.core.security import encrypt_value
from app.models.base import User, Course, Lesson, LessonQuestion, HandsOnCourse, Lab, LabQuestion
from app.schemas import user as user_schema

router = APIRouter()


def _user_to_out(user: User) -> dict:
    """Mai plaintext: solo flag set/non-set. Chiavi via PUT, blank=keep, null=clear."""
    return {
        "id": user.id,
        "username": user.username,
        "custom_openai_api_key": None,
        "custom_openai_base_url": user.custom_openai_base_url,
        "custom_llm_model": user.custom_llm_model,
        "custom_tavily_api_key": None,
        "custom_openai_api_key_set": bool(user.custom_openai_api_key),
        "custom_tavily_api_key_set": bool(user.custom_tavily_api_key),
    }


@router.get("/streak")
async def get_streak(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Giorni di attività consecutivi (lezioni/lab/domande create). Niente migration: usa created_at."""
    days: set = set()

    async def collect(model, join_chain):
        q = select(func.date(model.created_at).label("d")).select_from(model)
        for join_model, onclause in join_chain:
            q = q.join(join_model, onclause)
        q = q.where(join_chain[-1][0].user_id == current_user.id).group_by("d")
        for (d,) in (await db.execute(q)).all():
            if d:
                days.add(d if isinstance(d, date) else d.date() if hasattr(d, "date") else d)

    await collect(Lesson, [(Course, Lesson.course_id == Course.id)])
    await collect(LessonQuestion, [(Lesson, LessonQuestion.lesson_id == Lesson.id), (Course, Lesson.course_id == Course.id)])
    await collect(Lab, [(HandsOnCourse, Lab.hands_on_course_id == HandsOnCourse.id)])
    await collect(LabQuestion, [(Lab, LabQuestion.lab_id == Lab.id), (HandsOnCourse, Lab.hands_on_course_id == HandsOnCourse.id)])

    today = date.today()
    streak = 0
    cursor = today if today in days else today - timedelta(days=1)
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return {"streak": streak, "today_done": today in days, "total_days": len(days)}


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
