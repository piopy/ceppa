from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.db import get_db
from app.models.base import Lesson, Course, User
from app.schemas import lesson as lesson_schema
from app.services.llm_service import LLMService
from app.services.pdf_service import PDFService

router = APIRouter()


async def generate_pdf_background(
    lesson_id: int,
    content: str,
    user_id: int,
    course_title: str,
    lesson_title: str,
    db_session_maker,
) -> None:
    path = await PDFService.convert_markdown_to_pdf(
        content, user_id, course_title, lesson_title
    )

    # Update DB with path - we need a new session here usually if using async session in background
    # However, depending on session maker provided or just using a new one
    async with db_session_maker() as session:
        result = await session.execute(select(Lesson).where(Lesson.id == lesson_id))
        lesson = result.scalars().first()
        if lesson:
            lesson.pdf_path = path
            await session.commit()


@router.post("/generate", response_model=lesson_schema.LessonOut)
async def generate_lesson(
    lesson_in: lesson_schema.LessonCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Generate or Retrieve a lesson.
    If it exists for this path, return it.
    If not, generate content via LLM, save, and trigger PDF gen in background.
    """
    # Check if exists
    result = await db.execute(
        select(Lesson)
        .join(Course)
        .where(
            Lesson.course_id == lesson_in.course_id,
            Lesson.path_in_index == lesson_in.path_in_index,
            Course.user_id == current_user.id,
        )
    )
    existing_lesson = result.scalars().first()
    if existing_lesson:
        return existing_lesson

    # Get Course for context
    course_res = await db.execute(
        select(Course).where(
            Course.id == lesson_in.course_id, Course.user_id == current_user.id
        )
    )
    course = course_res.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Generate Content
    try:
        language = getattr(course, "language", "en")  # Default to 'en' if not set
        content = await LLMService.generate_lesson_content(
            course.title, lesson_in.title, course.index_json, language
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Generation failed: {str(e)}")

    # Save Lesson
    new_lesson = Lesson(
        course_id=lesson_in.course_id,
        title=lesson_in.title,
        path_in_index=lesson_in.path_in_index,
        content_markdown=content,
    )
    db.add(new_lesson)
    await db.commit()
    await db.refresh(new_lesson)

    # Trigger PDF Gen (Need a way to pass session maker or handle DB update in BG)
    from app.core.db import AsyncSessionLocal

    background_tasks.add_task(
        generate_pdf_background,
        new_lesson.id,
        content,
        current_user.id,
        course.title,
        lesson_in.title,
        AsyncSessionLocal,
    )

    return new_lesson


@router.put("/{lesson_id}", response_model=lesson_schema.LessonOut)
async def update_lesson(
    lesson_id: int,
    lesson_in: lesson_schema.LessonUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Update lesson progress or notes.
    """
    # Join Course to ensure user ownership
    result = await db.execute(
        select(Lesson)
        .join(Course)
        .where(Lesson.id == lesson_id, Course.user_id == current_user.id)
    )
    lesson = result.scalars().first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if lesson_in.is_completed is not None:
        lesson.is_completed = lesson_in.is_completed
    if lesson_in.user_notes is not None:
        lesson.user_notes = lesson_in.user_notes

    await db.commit()
    await db.refresh(lesson)
    return lesson


@router.get("/{lesson_id}", response_model=lesson_schema.LessonOut)
async def get_lesson(
    lesson_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(Lesson)
        .join(Course)
        .where(Lesson.id == lesson_id, Course.user_id == current_user.id)
    )
    lesson = result.scalars().first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson
