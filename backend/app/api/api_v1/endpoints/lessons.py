from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.db import get_db
from app.models.base import Lesson, Course, User, LessonQuestion
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


@router.post("/{lesson_id}/regenerate", response_model=lesson_schema.LessonOut)
async def regenerate_lesson(
    lesson_id: int,
    feedback: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Regenerate a lesson with user feedback.
    """
    # Get the lesson and verify ownership
    result = await db.execute(
        select(Lesson)
        .join(Course)
        .where(Lesson.id == lesson_id, Course.user_id == current_user.id)
    )
    lesson = result.scalars().first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Get course for context
    course_res = await db.execute(select(Course).where(Course.id == lesson.course_id))
    course = course_res.scalars().first()

    # Regenerate content with feedback
    try:
        language = getattr(course, "language", "en")
        user_feedback = feedback.get("feedback", "")
        content = await LLMService.generate_lesson_content(
            course.title, lesson.title, course.index_json, language, user_feedback
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Generation failed: {str(e)}")

    # Update lesson content
    lesson.content_markdown = content
    lesson.pdf_path = None  # Reset PDF path since we need to regenerate it
    await db.commit()
    await db.refresh(lesson)

    # Trigger PDF regeneration
    from app.core.db import AsyncSessionLocal

    background_tasks.add_task(
        generate_pdf_background,
        lesson.id,
        content,
        current_user.id,
        course.title,
        lesson.title,
        AsyncSessionLocal,
    )

    return lesson


@router.post("/{lesson_id}/ask", response_model=lesson_schema.QuestionOut)
async def ask_question(
    lesson_id: int,
    question_in: lesson_schema.QuestionCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Ask a question about a lesson and get an LLM-generated answer.
    """
    # Get lesson and verify ownership
    result = await db.execute(
        select(Lesson)
        .join(Course)
        .where(Lesson.id == lesson_id, Course.user_id == current_user.id)
    )
    lesson = result.scalars().first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Get course for language
    course_res = await db.execute(select(Course).where(Course.id == lesson.course_id))
    course = course_res.scalars().first()

    # Generate answer using LLM
    try:
        answer = await LLMService.answer_lesson_question(
            lesson_title=lesson.title,
            lesson_content=lesson.content_markdown,
            question=question_in.question,
            language=getattr(course, "language", "en"),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate answer: {str(e)}"
        )

    # Save question and answer to database
    question_obj = LessonQuestion(
        lesson_id=lesson_id,
        question=question_in.question,
        answer=answer,
    )
    db.add(question_obj)
    await db.commit()
    await db.refresh(question_obj)

    return question_obj


@router.get("/{lesson_id}/questions", response_model=list[lesson_schema.QuestionOut])
async def get_lesson_questions(
    lesson_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get all questions and answers for a specific lesson.
    """
    # Verify lesson ownership
    result = await db.execute(
        select(Lesson)
        .join(Course)
        .where(Lesson.id == lesson_id, Course.user_id == current_user.id)
    )
    lesson = result.scalars().first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Get all questions for this lesson
    questions_result = await db.execute(
        select(LessonQuestion)
        .where(LessonQuestion.lesson_id == lesson_id)
        .order_by(LessonQuestion.created_at.desc())
    )

    return questions_result.scalars().all()
