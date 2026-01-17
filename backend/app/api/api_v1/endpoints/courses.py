from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import asyncio
import json

from app.api import deps
from app.core.db import get_db
from app.core.config import settings
from app.models.base import Course, User, Lesson
from app.schemas import course as course_schema
from app.services.llm_service import LLMService

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
    Retrieve user's courses with lesson completion stats.
    """
    result = await db.execute(
        select(Course)
        .where(Course.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    courses = result.scalars().all()

    # Enrich courses with lesson completion stats
    course_list = []
    for course in courses:
        # Count total and completed lessons
        lessons_result = await db.execute(
            select(Lesson).where(Lesson.course_id == course.id)
        )
        lessons = lessons_result.scalars().all()
        total_lessons = len(lessons)
        completed_lessons = sum(1 for lesson in lessons if lesson.is_completed)

        course_list.append(
            course_schema.CourseList(
                id=course.id,
                title=course.title,
                created_at=course.created_at,
                total_lessons=total_lessons,
                completed_lessons=completed_lessons,
                all_lessons_completed=(
                    total_lessons > 0 and total_lessons == completed_lessons
                ),
            )
        )

    return course_list


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


@router.put("/{course_id}", response_model=course_schema.CourseOut)
async def update_course(
    course_id: int,
    course_in: course_schema.CourseUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Update course details (e.g., rename).
    """
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.user_id == current_user.id)
    )
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course_in.title is not None:
        course.title = course_in.title

    await db.commit()
    await db.refresh(course)
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


# Store generation status in memory (could be Redis in production)
generation_status = {}


@router.post("/{course_id}/generate-all-lessons")
async def generate_all_lessons(
    course_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Generate all lessons for a course in parallel with limited concurrency.
    """
    # Verify course ownership
    course_result = await db.execute(
        select(Course).where(Course.id == course_id, Course.user_id == current_user.id)
    )
    course = course_result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Parse index to get all lessons
    try:
        index_data = json.loads(course.index_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid course index: {str(e)}")

    all_lessons = []
    for module in index_data:
        for lesson in module.get("lessons", []):
            all_lessons.append(
                {
                    "title": lesson["title"],
                    "path": lesson["path"],
                }
            )

    # Check which lessons already exist
    lessons_result = await db.execute(
        select(Lesson).where(Lesson.course_id == course_id)
    )
    existing_lessons = {l.path_in_index for l in lessons_result.scalars().all()}

    lessons_to_generate = [l for l in all_lessons if l["path"] not in existing_lessons]

    if not lessons_to_generate:
        return {
            "message": "All lessons already generated",
            "total": len(all_lessons),
            "to_generate": 0,
        }

    # Initialize status
    status_key = f"course_{course_id}_user_{current_user.id}"
    generation_status[status_key] = {
        "total": len(lessons_to_generate),
        "completed": 0,
        "failed": 0,
        "in_progress": True,
        "errors": [],
    }

    # Start background task
    background_tasks.add_task(
        generate_lessons_background,
        course_id,
        course.title,
        course.index_json,
        getattr(course, "language", "en"),
        lessons_to_generate,
        current_user.id,
        status_key,
    )

    return {
        "message": "Generation started",
        "total": len(all_lessons),
        "already_generated": len(existing_lessons),
        "to_generate": len(lessons_to_generate),
        "status_key": status_key,
    }


@router.get("/{course_id}/generation-status")
async def get_generation_status(
    course_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get the status of ongoing lesson generation.
    """
    status_key = f"course_{course_id}_user_{current_user.id}"
    status = generation_status.get(
        status_key,
        {
            "total": 0,
            "completed": 0,
            "failed": 0,
            "in_progress": False,
            "errors": [],
        },
    )
    return status


async def generate_lessons_background(
    course_id: int,
    course_title: str,
    index_json: str,
    language: str,
    lessons_to_generate: list,
    user_id: int,
    status_key: str,
) -> None:
    """
    Background task to generate all lessons with limited concurrency.
    """
    from app.core.db import AsyncSessionLocal
    from app.services.pdf_service import PDFService

    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_WORKERS)

    async def generate_single_lesson(lesson_data):
        async with semaphore:
            try:
                # Generate content
                content = await LLMService.generate_lesson_content(
                    course_title,
                    lesson_data["title"],
                    index_json,
                    language,
                )

                # Save to database
                async with AsyncSessionLocal() as session:
                    new_lesson = Lesson(
                        course_id=course_id,
                        title=lesson_data["title"],
                        path_in_index=lesson_data["path"],
                        content_markdown=content,
                    )
                    session.add(new_lesson)
                    await session.commit()
                    await session.refresh(new_lesson)
                    lesson_id = new_lesson.id

                # Generate PDF
                pdf_path = await PDFService.convert_markdown_to_pdf(
                    content, user_id, course_title, lesson_data["title"]
                )

                # Update with PDF path
                async with AsyncSessionLocal() as session:
                    result = await session.execute(
                        select(Lesson).where(Lesson.id == lesson_id)
                    )
                    lesson = result.scalars().first()
                    if lesson:
                        lesson.pdf_path = pdf_path
                        await session.commit()

                # Update status
                generation_status[status_key]["completed"] += 1
                return {"success": True, "lesson": lesson_data["title"]}

            except Exception as e:
                generation_status[status_key]["failed"] += 1
                generation_status[status_key]["errors"].append(
                    {
                        "lesson": lesson_data["title"],
                        "error": str(e),
                    }
                )
                return {
                    "success": False,
                    "lesson": lesson_data["title"],
                    "error": str(e),
                }

    # Generate all lessons in parallel
    tasks = [generate_single_lesson(lesson) for lesson in lessons_to_generate]
    await asyncio.gather(*tasks, return_exceptions=True)

    # Mark as complete
    generation_status[status_key]["in_progress"] = False
