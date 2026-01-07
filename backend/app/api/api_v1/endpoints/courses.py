from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.db import get_db
from app.models.base import Course, User
from app.schemas import course as course_schema
from app.services.llm_service import LLMService
import json

router = APIRouter()


@router.post("/", response_model=course_schema.CourseOut)
async def create_course(
    course_in: course_schema.CourseCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Generate a new course index for a given topic and save it.
    """
    # 1. Generate Index via LLM
    try:
        language = course_in.language or "en"
        index_json_str = await LLMService.generate_course_index(
            course_in.topic, course_in.custom_instructions, language
        )
        # Validate JSON
        json.loads(index_json_str)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate course index: {str(e)}"
        )

    # 2. Save to DB
    course = Course(
        user_id=current_user.id,
        title=course_in.topic,
        description=f"Course on {course_in.topic}",
        index_json=index_json_str,
        language=language,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course


@router.get("/", response_model=List[course_schema.CourseList])
async def read_courses(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Retrieve user's courses.
    """
    result = await db.execute(
        select(Course)
        .where(Course.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    courses = result.scalars().all()
    return courses


@router.get("/{course_id}/lessons", response_model=List[dict])
async def get_course_lessons(
    course_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get all generated lessons for a course with their completion status.
    """
    from app.models.base import Lesson

    # Verify course ownership
    course_result = await db.execute(
        select(Course).where(Course.id == course_id, Course.user_id == current_user.id)
    )
    course = course_result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Get all lessons for this course
    lessons_result = await db.execute(
        select(Lesson).where(Lesson.course_id == course_id)
    )
    lessons = lessons_result.scalars().all()

    # Return simplified data
    return [
        {
            "path_in_index": lesson.path_in_index,
            "is_completed": lesson.is_completed,
        }
        for lesson in lessons
    ]


@router.get("/{course_id}", response_model=course_schema.CourseOut)
async def read_course(
    course_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get specific course by ID.
    """
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.user_id == current_user.id)
    )
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.delete("/{course_id}")
async def delete_course(
    course_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Delete a course and all its lessons.
    """
    from app.models.base import Lesson

    # Verify course ownership
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.user_id == current_user.id)
    )
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Delete all lessons associated with this course
    await db.execute(select(Lesson).where(Lesson.course_id == course_id))
    lessons_result = await db.execute(
        select(Lesson).where(Lesson.course_id == course_id)
    )
    lessons = lessons_result.scalars().all()
    for lesson in lessons:
        await db.delete(lesson)

    # Delete the course
    await db.delete(course)
    await db.commit()

    return {"message": "Course deleted successfully"}
