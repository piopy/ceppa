from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.api import deps
from app.core.db import get_db
from app.models.base import HandsOnCourse, Lab, User
from app.schemas import hands_on as hands_on_schema
from app.services.hands_on_service import HandsOnService

router = APIRouter()


# ---- HandsOnCourse Endpoints ---- #


@router.post("/", response_model=hands_on_schema.HandsOnCourseOut)
async def create_hands_on_course(
    course_in: hands_on_schema.HandsOnCourseCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Create a new hands-on lab course for a given topic."""
    try:
        course = await HandsOnService.create_hands_on_course(
            db=db,
            user=current_user,
            topic=course_in.topic,
            custom_instructions=course_in.custom_instructions,
            language=course_in.language or "en",
            use_web_research=course_in.use_web_research or False,
        )
        return course
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate hands-on course: {str(e)}"
        )


@router.get("/", response_model=hands_on_schema.HandsOnCoursesListResponse)
async def read_hands_on_courses(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """List user's hands-on courses with lab completion stats."""
    # Total count
    count_result = await db.execute(
        select(func.count())
        .select_from(HandsOnCourse)
        .where(HandsOnCourse.user_id == current_user.id)
    )
    total = count_result.scalar()

    # Paginated courses
    result = await db.execute(
        select(HandsOnCourse)
        .where(HandsOnCourse.user_id == current_user.id)
        .order_by(HandsOnCourse.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    courses = result.scalars().all()

    # Enrich with stats
    course_list = []
    for course in courses:
        labs_result = await db.execute(
            select(Lab).where(Lab.hands_on_course_id == course.id)
        )
        labs = labs_result.scalars().all()
        total_labs = len(labs)
        completed_labs = sum(1 for lab in labs if lab.is_completed)

        course_list.append(
            hands_on_schema.HandsOnCourseList(
                id=course.id,
                topic=course.topic,
                title=course.title,
                created_at=course.created_at,
                total_labs=total_labs,
                completed_labs=completed_labs,
                all_labs_completed=(
                    total_labs > 0 and total_labs == completed_labs
                ),
            )
        )

    return hands_on_schema.HandsOnCoursesListResponse(
        items=course_list, total=total, skip=skip, limit=limit
    )


@router.get("/{course_id}", response_model=hands_on_schema.HandsOnCourseOut)
async def read_hands_on_course(
    course_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get a specific hands-on course by ID."""
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Hands-on course not found")
    return course


@router.delete("/{course_id}")
async def delete_hands_on_course(
    course_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Delete a hands-on course and all its labs."""
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    await db.delete(course)
    await db.commit()
    return {"message": "Hands-on course deleted successfully"}


# ---- Lab Endpoints ---- #


@router.get("/{course_id}/labs")
async def get_course_labs(
    course_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get all labs for a hands-on course with their completion status."""
    # Verify ownership
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    labs_result = await db.execute(
        select(Lab).where(Lab.hands_on_course_id == course_id)
    )
    labs = labs_result.scalars().all()

    return [
        {
            "id": lab.id,
            "title": lab.title,
            "path_in_index": lab.path_in_index,
            "is_completed": lab.is_completed,
        }
        for lab in labs
    ]


@router.post("/{course_id}/labs/generate", response_model=hands_on_schema.LabOut)
async def generate_lab(
    course_id: int,
    lab_in: dict,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Generate or retrieve a lab for a hands-on course."""
    title = lab_in.get("title", "")
    path_in_index = lab_in.get("path_in_index", "")
    use_web_research = lab_in.get("use_web_research", False)

    if not title or not path_in_index:
        raise HTTPException(status_code=400, detail="title and path_in_index are required")

    # Verify ownership
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    try:
        lab = await HandsOnService.get_or_generate_lab(
            db=db,
            user=current_user,
            hands_on_course=course,
            lab_title=title,
            path_in_index=path_in_index,
            use_web_research=use_web_research,
        )
        return lab
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate lab: {str(e)}"
        )


@router.get("/{course_id}/labs/{lab_id}", response_model=hands_on_schema.LabOut)
async def get_lab(
    course_id: int,
    lab_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get a specific lab by ID."""
    # Verify course ownership
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    lab_result = await db.execute(
        select(Lab).where(
            Lab.id == lab_id,
            Lab.hands_on_course_id == course_id,
        )
    )
    lab = lab_result.scalars().first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")
    return lab


@router.put("/{course_id}/labs/{lab_id}", response_model=hands_on_schema.LabOut)
async def update_lab(
    course_id: int,
    lab_id: int,
    lab_in: hands_on_schema.LabUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update lab progress (completion, notes, step progress)."""
    # Verify course ownership
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    lab_result = await db.execute(
        select(Lab).where(
            Lab.id == lab_id,
            Lab.hands_on_course_id == course_id,
        )
    )
    lab = lab_result.scalars().first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    try:
        updated_lab = await HandsOnService.update_lab_progress(
            db=db,
            lab=lab,
            is_completed=lab_in.is_completed,
            user_notes=lab_in.user_notes,
            step_completed=lab_in.step_completed,
        )
        return updated_lab
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to update lab: {str(e)}"
        )