from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
import os
import uuid

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
            course.title,
            lesson_in.title,
            course.index_json,
            language,
            use_web_research=lesson_in.use_web_research,
            user=current_user,
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
    if lesson_in.is_favorite is not None:
        lesson.is_favorite = lesson_in.is_favorite
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
            course.title,
            lesson.title,
            course.index_json,
            language,
            user_feedback,
            user=current_user,
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
    parent_id opzionale: risposta annidata nel thread (riga utente + riga AI figlia).
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

    # Thread: risolvi parent + conversation, history = catena completa
    parent = None
    history = []
    cid = uuid.uuid4().hex[:12]
    if question_in.parent_id:
        p_res = await db.execute(
            select(LessonQuestion).where(
                LessonQuestion.id == question_in.parent_id,
                LessonQuestion.lesson_id == lesson_id,
            )
        )
        parent = p_res.scalars().first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent question not found")
        cid = parent.conversation_id or uuid.uuid4().hex[:12]
        from app.api.qa_utils import thread_history
        history = await thread_history(db, LessonQuestion, "lesson_id", lesson_id, parent.id)

    # Generate answer using LLM
    try:
        answer = await LLMService.answer_lesson_question(
            lesson_title=lesson.title,
            lesson_content=lesson.content_markdown,
            question=question_in.question,
            language=getattr(course, "language", "en"),
            user=current_user,
            history=history,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate answer: {str(e)}"
        )

    # Riga utente + riga AI figlia (un messaggio per riga)
    user_row = LessonQuestion(
        lesson_id=lesson_id,
        question=question_in.question,
        answer=None,
        parent_id=question_in.parent_id,
        role="user",
        conversation_id=cid,
    )
    db.add(user_row)
    await db.flush()
    assistant_row = LessonQuestion(
        lesson_id=lesson_id,
        question=question_in.question,
        answer=answer,
        parent_id=user_row.id,
        role="assistant",
        conversation_id=cid,
    )
    db.add(assistant_row)
    await db.commit()
    await db.refresh(assistant_row)

    return assistant_row


@router.post("/{lesson_id}/questions/{question_id}/chat")
async def start_chat(
    lesson_id: int,
    question_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Avvia una chat lineare da un commento: ritorna conversation_id + seed."""
    result = await db.execute(
        select(Lesson)
        .join(Course)
        .where(Lesson.id == lesson_id, Course.user_id == current_user.id)
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Lesson not found")
    q_res = await db.execute(
        select(LessonQuestion).where(
            LessonQuestion.id == question_id, LessonQuestion.lesson_id == lesson_id
        )
    )
    q = q_res.scalars().first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    # Riusa conversation del thread se esiste: chat e thread condividono memoria
    cid = q.conversation_id or uuid.uuid4().hex[:12]
    seed = [{"role": "user", "content": q.question}]
    if q.answer:
        seed.append({"role": "assistant", "content": q.answer})
    return {"conversation_id": cid, "seed": seed, "parent_id": q.id}


@router.post("/{lesson_id}/chat/{conversation_id}/messages", response_model=lesson_schema.QuestionOut)
async def post_chat_message(
    lesson_id: int,
    conversation_id: str,
    msg_in: lesson_schema.ChatMessageCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Turno chat: history della conversazione passata al LLM, righe accodate."""
    result = await db.execute(
        select(Lesson)
        .join(Course)
        .where(Lesson.id == lesson_id, Course.user_id == current_user.id)
    )
    lesson = result.scalars().first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    course_res = await db.execute(select(Course).where(Course.id == lesson.course_id))
    course = course_res.scalars().first()

    prev_res = await db.execute(
        select(LessonQuestion)
        .where(
            LessonQuestion.lesson_id == lesson_id,
            LessonQuestion.conversation_id == conversation_id,
        )
        .order_by(LessonQuestion.created_at.asc())
    )
    prev = prev_res.scalars().all()
    history = [
        {"role": r.role or ("assistant" if r.answer else "user"), "content": r.answer or r.question}
        for r in prev
    ]
    # Primo messaggio: aggancia al commento di partenza; poi catena lineare
    parent_id = msg_in.parent_id or (prev[-1].id if prev else None)
    if parent_id:
        p_check = await db.execute(
            select(LessonQuestion).where(
                LessonQuestion.id == parent_id, LessonQuestion.lesson_id == lesson_id
            )
        )
        if not p_check.scalars().first():
            raise HTTPException(status_code=404, detail="Parent question not found")

    try:
        answer = await LLMService.answer_lesson_question(
            lesson_title=lesson.title,
            lesson_content=lesson.content_markdown,
            question=msg_in.content,
            language=getattr(course, "language", "en"),
            user=current_user,
            history=history,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(e)}")

    user_row = LessonQuestion(
        lesson_id=lesson_id, question=msg_in.content, answer=None,
        parent_id=parent_id, role="user", conversation_id=conversation_id,
    )
    db.add(user_row)
    await db.flush()
    assistant_row = LessonQuestion(
        lesson_id=lesson_id, question=msg_in.content, answer=answer,
        parent_id=user_row.id, role="assistant", conversation_id=conversation_id,
    )
    db.add(assistant_row)
    await db.commit()
    await db.refresh(assistant_row)
    return assistant_row


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


@router.delete("/{lesson_id}/questions/{question_id}")
async def delete_question(
    lesson_id: int,
    question_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Delete a question from a lesson.
    Users can only delete questions from lessons they own.
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

    # Get the question
    question_result = await db.execute(
        select(LessonQuestion).where(
            LessonQuestion.id == question_id,
            LessonQuestion.lesson_id == lesson_id,
        )
    )
    question = question_result.scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Delete the question + discendenti thread (un solo statement: niente problemi FK self)
    to_delete = [question]
    idx = 0
    while idx < len(to_delete):
        kids = await db.execute(
            select(LessonQuestion).where(LessonQuestion.parent_id == to_delete[idx].id)
        )
        to_delete.extend(kids.scalars().all())
        idx += 1
    await db.execute(
        delete(LessonQuestion).where(LessonQuestion.id.in_([r.id for r in to_delete]))
    )
    await db.commit()

    return {"message": "Question deleted successfully"}


@router.get("/{lesson_id}/pdf")
async def get_lesson_pdf(
    lesson_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get a lesson's PDF file. If the PDF file doesn't exist on disk,
    regenerate it from the stored content_markdown.
    """
    # Verify ownership
    result = await db.execute(
        select(Lesson)
        .join(Course)
        .where(Lesson.id == lesson_id, Course.user_id == current_user.id)
    )
    lesson = result.scalars().first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # If no content, can't generate PDF
    if not lesson.content_markdown:
        raise HTTPException(status_code=400, detail="Lesson has no content to generate PDF from")

    # Check if PDF exists on disk
    pdf_relative_path = lesson.pdf_path
    if pdf_relative_path:
        pdf_full_path = PDFService.BASE_DIR / pdf_relative_path
        if pdf_full_path.exists():
            return FileResponse(
                path=str(pdf_full_path),
                media_type="application/pdf",
                filename=f"{PDFService._sanitize_filename(lesson.title)}.pdf",
            )

    # PDF doesn't exist — regenerate it
    # Get course for title
    course_res = await db.execute(select(Course).where(Course.id == lesson.course_id))
    course = course_res.scalars().first()
    course_title = course.title if course else "Course"

    pdf_path = await PDFService.convert_markdown_to_pdf(
        lesson.content_markdown,
        current_user.id,
        course_title,
        lesson.title,
    )

    if not pdf_path:
        raise HTTPException(status_code=500, detail="Failed to generate PDF")

    # Update DB with new path
    lesson.pdf_path = pdf_path
    await db.commit()

    # Serve the regenerated PDF
    pdf_full_path = PDFService.BASE_DIR / pdf_path
    if not pdf_full_path.exists():
        raise HTTPException(status_code=500, detail="Generated PDF file not found")

    return FileResponse(
        path=str(pdf_full_path),
        media_type="application/pdf",
        filename=f"{PDFService._sanitize_filename(lesson.title)}.pdf",
    )
