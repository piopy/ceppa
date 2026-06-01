import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.db import get_db
from app.models.base import (
    User, Course, Lesson, LessonQuestion,
    HandsOnCourse, Lab, LabQuestion,
)
from app.schemas.export_import import UserExport, ImportResult

router = APIRouter()


@router.get("/export")
async def export_user_data(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Export all user data (courses, lessons, labs, Q&A) as JSON."""

    courses_result = await db.execute(
        select(Course).where(Course.user_id == current_user.id)
    )
    courses = courses_result.scalars().all()

    hands_on_result = await db.execute(
        select(HandsOnCourse).where(HandsOnCourse.user_id == current_user.id)
    )
    hands_on_courses = hands_on_result.scalars().all()

    course_ids = [c.id for c in courses]
    hands_on_ids = [h.id for h in hands_on_courses]

    # Fetch lessons and their questions
    lessons_result = await db.execute(
        select(Lesson).where(Lesson.course_id.in_(course_ids))
        if course_ids else select(Lesson).where(False)
    )
    lessons = lessons_result.scalars().all() if course_ids else []

    lesson_ids = [l.id for l in lessons]
    if lesson_ids:
        questions_result = await db.execute(
            select(LessonQuestion).where(LessonQuestion.lesson_id.in_(lesson_ids))
        )
        lesson_questions = questions_result.scalars().all()
    else:
        lesson_questions = []

    # Fetch labs and their questions
    labs_result = await db.execute(
        select(Lab).where(Lab.hands_on_course_id.in_(hands_on_ids))
        if hands_on_ids else select(Lab).where(False)
    )
    labs = labs_result.scalars().all() if hands_on_ids else []

    lab_ids = [l.id for l in labs]
    if lab_ids:
        lab_questions_result = await db.execute(
            select(LabQuestion).where(LabQuestion.lab_id.in_(lab_ids))
        )
        lab_questions = lab_questions_result.scalars().all()
    else:
        lab_questions = []

    # Build lookup maps
    questions_by_lesson: dict[int, list[LessonQuestion]] = {}
    for q in lesson_questions:
        questions_by_lesson.setdefault(q.lesson_id, []).append(q)

    questions_by_lab: dict[int, list[LabQuestion]] = {}
    for q in lab_questions:
        questions_by_lab.setdefault(q.lab_id, []).append(q)

    lessons_by_course: dict[int, list[Lesson]] = {}
    for l in lessons:
        lessons_by_course.setdefault(l.course_id, []).append(l)

    labs_by_hands_on: dict[int, list[Lab]] = {}
    for l in labs:
        labs_by_hands_on.setdefault(l.hands_on_course_id, []).append(l)

    now = datetime.now(timezone.utc)

    export_data = UserExport(
        exported_at=now,
        username=current_user.username,
        courses=[
            {
                "title": c.title,
                "description": c.description,
                "language": c.language,
                "index_json": c.index_json,
                "created_at": c.created_at,
                "lessons": [
                    {
                        "title": l.title,
                        "path_in_index": l.path_in_index,
                        "content_markdown": l.content_markdown,
                        "is_completed": l.is_completed,
                        "is_favorite": l.is_favorite,
                        "user_notes": l.user_notes,
                        "created_at": l.created_at,
                        "questions": [
                            {
                                "question": q.question,
                                "answer": q.answer,
                                "created_at": q.created_at,
                            }
                            for q in questions_by_lesson.get(l.id, [])
                        ],
                    }
                    for l in lessons_by_course.get(c.id, [])
                ],
            }
            for c in courses
        ],
        hands_on_courses=[
            {
                "topic": h.topic,
                "title": h.title,
                "description": h.description,
                "language": h.language,
                "custom_instructions": h.custom_instructions,
                "index_json": h.index_json,
                "created_at": h.created_at,
                "labs": [
                    {
                        "title": lab.title,
                        "path_in_index": lab.path_in_index,
                        "theory_content": lab.theory_content,
                        "steps_json": lab.steps_json,
                        "is_completed": lab.is_completed,
                        "is_favorite": lab.is_favorite,
                        "user_notes": lab.user_notes,
                        "created_at": lab.created_at,
                        "questions": [
                            {
                                "question": q.question,
                                "answer": q.answer,
                                "created_at": q.created_at,
                            }
                            for q in questions_by_lab.get(lab.id, [])
                        ],
                    }
                    for lab in labs_by_hands_on.get(h.id, [])
                ],
            }
            for h in hands_on_courses
        ],
    )

    json_bytes = export_data.model_dump_json(indent=2).encode("utf-8")
    filename = f"ceppa_export_{current_user.username}.json"

    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import")
async def import_user_data(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImportResult:
    """Import user data from a previously exported JSON file."""

    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="File must be a .json file")

    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    if "version" not in data or "courses" not in data:
        raise HTTPException(
            status_code=400,
            detail="Invalid export file: missing 'version' or 'courses' field",
        )

    courses_data = data.get("courses", [])
    hands_on_data = data.get("hands_on_courses", [])

    courses_imported = 0
    lessons_imported = 0
    hands_on_imported = 0
    labs_imported = 0

    for course_data in courses_data:
        course = Course(
            user_id=current_user.id,
            title=course_data["title"],
            description=course_data.get("description"),
            language=course_data.get("language", "en"),
            index_json=course_data["index_json"],
            created_at=_parse_datetime(course_data.get("created_at")),
        )
        db.add(course)
        await db.flush()
        courses_imported += 1

        for lesson_data in course_data.get("lessons", []):
            lesson = Lesson(
                course_id=course.id,
                title=lesson_data["title"],
                path_in_index=lesson_data["path_in_index"],
                content_markdown=lesson_data["content_markdown"],
                is_completed=lesson_data.get("is_completed", False),
                is_favorite=lesson_data.get("is_favorite", False),
                user_notes=lesson_data.get("user_notes"),
                created_at=_parse_datetime(lesson_data.get("created_at")),
            )
            db.add(lesson)
            await db.flush()
            lessons_imported += 1

            for q_data in lesson_data.get("questions", []):
                question = LessonQuestion(
                    lesson_id=lesson.id,
                    question=q_data["question"],
                    answer=q_data["answer"],
                    created_at=_parse_datetime(q_data.get("created_at")),
                )
                db.add(question)

    for hoc_data in hands_on_data:
        hoc = HandsOnCourse(
            user_id=current_user.id,
            topic=hoc_data["topic"],
            title=hoc_data["title"],
            description=hoc_data.get("description"),
            language=hoc_data.get("language", "en"),
            custom_instructions=hoc_data.get("custom_instructions"),
            index_json=hoc_data["index_json"],
            created_at=_parse_datetime(hoc_data.get("created_at")),
        )
        db.add(hoc)
        await db.flush()
        hands_on_imported += 1

        for lab_data in hoc_data.get("labs", []):
            lab = Lab(
                hands_on_course_id=hoc.id,
                title=lab_data["title"],
                path_in_index=lab_data["path_in_index"],
                theory_content=lab_data["theory_content"],
                steps_json=lab_data["steps_json"],
                is_completed=lab_data.get("is_completed", False),
                is_favorite=lab_data.get("is_favorite", False),
                user_notes=lab_data.get("user_notes"),
                created_at=_parse_datetime(lab_data.get("created_at")),
            )
            db.add(lab)
            await db.flush()
            labs_imported += 1

            for q_data in lab_data.get("questions", []):
                question = LabQuestion(
                    lab_id=lab.id,
                    question=q_data["question"],
                    answer=q_data["answer"],
                    created_at=_parse_datetime(q_data.get("created_at")),
                )
                db.add(question)

    await db.commit()

    return ImportResult(
        courses_imported=courses_imported,
        lessons_imported=lessons_imported,
        hands_on_courses_imported=hands_on_imported,
        labs_imported=labs_imported,
    )


def _parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass
    return None
