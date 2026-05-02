from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
import json
import asyncio
import logging

logger = logging.getLogger(__name__)

from app.api import deps
from app.core.db import get_db
from app.core.config import settings
from app.models.base import HandsOnCourse, Lab, User, LabQuestion
from app.schemas import hands_on as hands_on_schema
from app.services.hands_on_service import HandsOnService
from app.services.llm_service import LLMService
from app.services.pdf_service import PDFService

router = APIRouter()

# Store generation status for hands-on courses in memory
generation_status = {}


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
            "is_favorite": lab.is_favorite,
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


@router.post("/{course_id}/labs/{lab_id}/regenerate", response_model=hands_on_schema.LabOut)
async def regenerate_lab(
    course_id: int,
    lab_id: int,
    feedback: dict,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Regenerate a lab with user feedback.
    """
    # Verify course ownership
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    # Get the lab
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
        user_feedback = feedback.get("feedback", "")
        updated_lab = await HandsOnService.regenerate_lab(
            db=db,
            user=current_user,
            lab=lab,
            hands_on_course=course,
            feedback=user_feedback,
            use_web_research=False,
        )
        return updated_lab
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to regenerate lab: {str(e)}"
        )


@router.put("/{course_id}/labs/{lab_id}", response_model=hands_on_schema.LabOut)
async def update_lab(
    course_id: int,
    lab_id: int,
    lab_in: hands_on_schema.LabUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update lab progress (completion, favorite, notes, step progress)."""
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
            is_favorite=lab_in.is_favorite,
            user_notes=lab_in.user_notes,
            step_completed=lab_in.step_completed,
        )
        return updated_lab
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to update lab: {str(e)}"
        )


# ---- Lab Q&A Endpoints ---- #


@router.post("/{course_id}/labs/{lab_id}/ask", response_model=hands_on_schema.LabQuestionOut)
async def ask_lab_question(
    course_id: int,
    lab_id: int,
    question_in: hands_on_schema.LabQuestionCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Ask a question about a lab and get an LLM-generated answer.
    """
    # Verify course ownership
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    # Get lab
    lab_result = await db.execute(
        select(Lab).where(
            Lab.id == lab_id,
            Lab.hands_on_course_id == course_id,
        )
    )
    lab = lab_result.scalars().first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    # Generate answer using LLM
    try:
        answer = await LLMService.answer_lab_question(
            lab_title=lab.title,
            lab_theory=lab.theory_content,
            lab_steps=lab.steps_json,
            question=question_in.question,
            language=getattr(course, "language", "en"),
            user=current_user,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate answer: {str(e)}"
        )

    # Save question and answer to database
    question_obj = LabQuestion(
        lab_id=lab_id,
        question=question_in.question,
        answer=answer,
    )
    db.add(question_obj)
    await db.commit()
    await db.refresh(question_obj)

    return question_obj


@router.get("/{course_id}/labs/{lab_id}/questions", response_model=list[hands_on_schema.LabQuestionOut])
async def get_lab_questions(
    course_id: int,
    lab_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get all questions and answers for a specific lab.
    """
    # Verify course ownership
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    # Get all questions for this lab
    questions_result = await db.execute(
        select(LabQuestion)
        .where(LabQuestion.lab_id == lab_id)
        .order_by(LabQuestion.created_at.desc())
    )

    return questions_result.scalars().all()


@router.delete("/{course_id}/labs/{lab_id}/questions/{question_id}")
async def delete_lab_question(
    course_id: int,
    lab_id: int,
    question_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Delete a question from a lab.
    """
    # Verify course ownership
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    # Get the question
    question_result = await db.execute(
        select(LabQuestion).where(
            LabQuestion.id == question_id,
            LabQuestion.lab_id == lab_id,
        )
    )
    question = question_result.scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Delete the question
    await db.delete(question)
    await db.commit()

    return {"message": "Question deleted successfully"}


# ---- Generate All Labs ---- #


@router.post("/{course_id}/generate-all-labs")
async def generate_all_labs(
    course_id: int,
    request: hands_on_schema.GenerateAllLabsRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Generate all labs for a hands-on course in parallel with limited concurrency.
    """
    use_web_research = request.use_web_research

    # Verify course ownership
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    # Parse index to get all labs
    try:
        index_data = json.loads(course.index_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid course index: {str(e)}")

    all_labs = []
    for module in index_data:
        for lab in module.get("labs", []):
            all_labs.append(
                {
                    "title": lab["title"],
                    "path": lab["path"],
                }
            )

    # Check which labs already exist
    labs_result = await db.execute(
        select(Lab).where(Lab.hands_on_course_id == course_id)
    )
    existing_labs = {l.path_in_index for l in labs_result.scalars().all()}

    labs_to_generate = [l for l in all_labs if l["path"] not in existing_labs]

    if not labs_to_generate:
        return {
            "message": "All labs already generated",
            "total": len(all_labs),
            "to_generate": 0,
        }

    # Initialize status
    status_key = f"hands_on_{course_id}_user_{current_user.id}"
    generation_status[status_key] = {
        "total": len(labs_to_generate),
        "completed": 0,
        "failed": 0,
        "in_progress": True,
        "errors": [],
    }

    # Start background task
    background_tasks.add_task(
        generate_labs_background,
        course_id,
        course.topic,
        course.index_json,
        getattr(course, "language", "en"),
        labs_to_generate,
        current_user.id,
        status_key,
        use_web_research,
    )

    return {
        "message": "Generation started",
        "total": len(all_labs),
        "already_generated": len(existing_labs),
        "to_generate": len(labs_to_generate),
        "status_key": status_key,
    }


@router.get("/{course_id}/generation-status")
async def get_generation_status(
    course_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get the status of ongoing lab generation.
    """
    status_key = f"hands_on_{course_id}_user_{current_user.id}"
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


async def generate_labs_background(
    course_id: int,
    course_title: str,
    index_json: str,
    language: str,
    labs_to_generate: list,
    user_id: int,
    status_key: str,
    use_web_research: bool = False,
) -> None:
    """
    Background task to generate all labs with limited concurrency.
    """
    from app.core.db import AsyncSessionLocal

    # Load user for per-user LLM/Tavily settings
    user = None
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()

    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_WORKERS)

    async def generate_single_lab(lab_data):
        async with semaphore:
            try:
                # Generate content
                lab_json_str = await LLMService.generate_lab_content(
                    course_title,
                    lab_data["title"],
                    index_json,
                    language,
                    use_web_research=use_web_research,
                    user=user,
                )

                # Parse JSON
                lab_content = json.loads(lab_json_str)
                theory_content = lab_content.get("theory_content", "")
                steps = lab_content.get("steps", [])
                steps_json = json.dumps(steps)

                # Save to database
                async with AsyncSessionLocal() as session:
                    new_lab = Lab(
                        hands_on_course_id=course_id,
                        title=lab_data["title"],
                        path_in_index=lab_data["path"],
                        theory_content=theory_content,
                        steps_json=steps_json,
                    )
                    session.add(new_lab)
                    await session.commit()

                # Update status
                generation_status[status_key]["completed"] += 1
                return {"success": True, "lab": lab_data["title"]}

            except Exception as e:
                generation_status[status_key]["failed"] += 1
                generation_status[status_key]["errors"].append(
                    {
                        "lab": lab_data["title"],
                        "error": str(e),
                    }
                )
                return {
                    "success": False,
                    "lab": lab_data["title"],
                    "error": str(e),
                }

    # Generate all labs in parallel
    tasks = [generate_single_lab(lab) for lab in labs_to_generate]
    await asyncio.gather(*tasks, return_exceptions=True)

    # Mark as complete
    generation_status[status_key]["in_progress"] = False


# ---- Download PDF/EPUB for hands-on courses ---- #


def natural_sort_key(path_in_index: str):
    """
    Sort helper for path_in_index like '1.1', '1.2', '10.1'
    """
    import re
    return [
        int(text) if text.isdigit() else text.lower()
        for text in re.split("([0-9]+)", path_in_index)
    ]


@router.get("/{course_id}/download-full-pdf")
async def download_full_course_pdf(
    course_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Download a single PDF containing all labs merged together.
    Only available when all labs are generated.
    """
    # Get course
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    # Get all labs for this course
    labs_result = await db.execute(
        select(Lab)
        .where(Lab.hands_on_course_id == course_id)
        .order_by(Lab.path_in_index)
    )
    labs = labs_result.scalars().all()

    if not labs:
        raise HTTPException(status_code=400, detail="No labs found for this course")

    # Sort labs naturally by path_in_index
    sorted_labs = sorted(labs, key=lambda l: natural_sort_key(l.path_in_index))

    # Build merged markdown
    merged_md_parts = [
        f"# {course.title}\n\n",
        f"**Course Description:** {course.description}\n\n" if course.description else "",
        "\\newpage\n\n",
        "# Table of Contents\n\n",
    ]

    # Add TOC
    for lab in sorted_labs:
        merged_md_parts.append(f"- {lab.path_in_index}. {lab.title}\n")

    merged_md_parts.append("\n\\newpage\n\n")

    # Add all lab contents
    for lab in sorted_labs:
        merged_md_parts.append(f"# {lab.path_in_index}. {lab.title}\n\n")
        merged_md_parts.append("## Theory Background\n\n")
        if lab.theory_content:
            merged_md_parts.append(lab.theory_content)
        merged_md_parts.append("\n\n## Practical Steps\n\n")
        if lab.steps_json:
            try:
                steps = json.loads(lab.steps_json)
                for step in steps:
                    merged_md_parts.append(f"### Step {step['step_number']}: {step['title']}\n\n")
                    merged_md_parts.append(f"{step['description']}\n\n")
                    if step.get('command'):
                        merged_md_parts.append(f"```bash\n{step['command']}\n```\n\n")
                    if step.get('expected_output'):
                        merged_md_parts.append(f"**Expected output:**\n```\n{step['expected_output']}\n```\n\n")
            except json.JSONDecodeError:
                merged_md_parts.append(f"{lab.steps_json}\n\n")
        merged_md_parts.append("\n\\newpage\n\n")

    merged_md = "".join(merged_md_parts)

    # Generate PDF
    safe_course_title = PDFService._sanitize_filename(course.title)
    pdf_path = await PDFService.convert_markdown_to_pdf(
        merged_md, current_user.id, course.title, safe_course_title
    )

    if not pdf_path:
        raise HTTPException(
            status_code=500, detail="Failed to generate merged PDF. Check backend logs."
        )

    # Return file
    full_path = PDFService.BASE_DIR / pdf_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Generated PDF file not found")

    return FileResponse(
        path=str(full_path),
        media_type="application/pdf",
        filename=f"{safe_course_title}.pdf",
    )


@router.get("/{course_id}/download-full-epub")
async def download_full_course_epub(
    course_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Download a single EPUB containing all labs merged together.
    Only available when all labs are generated.
    """
    # Get course
    result = await db.execute(
        select(HandsOnCourse).where(
            HandsOnCourse.id == course_id,
            HandsOnCourse.user_id == current_user.id,
        )
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Hands-on course not found")

    # Get all labs for this course
    labs_result = await db.execute(
        select(Lab)
        .where(Lab.hands_on_course_id == course_id)
        .order_by(Lab.path_in_index)
    )
    labs = labs_result.scalars().all()

    if not labs:
        raise HTTPException(status_code=400, detail="No labs found for this course")

    # Sort labs naturally by path_in_index
    sorted_labs = sorted(labs, key=lambda l: natural_sort_key(l.path_in_index))

    # Build merged markdown
    merged_md_parts = [
        f"# {course.title}\n\n",
        f"**Course Description:** {course.description}\n\n" if course.description else "",
        "\n\n",
        "# Table of Contents\n\n",
    ]

    # Add TOC
    for lab in sorted_labs:
        merged_md_parts.append(f"- {lab.path_in_index}. {lab.title}\n")

    merged_md_parts.append("\n\n")

    # Add all lab contents
    for lab in sorted_labs:
        merged_md_parts.append(f"# {lab.path_in_index}. {lab.title}\n\n")
        merged_md_parts.append("## Theory Background\n\n")
        if lab.theory_content:
            merged_md_parts.append(lab.theory_content)
        merged_md_parts.append("\n\n## Practical Steps\n\n")
        if lab.steps_json:
            try:
                steps = json.loads(lab.steps_json)
                for step in steps:
                    merged_md_parts.append(f"### Step {step['step_number']}: {step['title']}\n\n")
                    merged_md_parts.append(f"{step['description']}\n\n")
                    if step.get('command'):
                        merged_md_parts.append(f"```bash\n{step['command']}\n```\n\n")
                    if step.get('expected_output'):
                        merged_md_parts.append(f"**Expected output:**\n```\n{step['expected_output']}\n```\n\n")
            except json.JSONDecodeError:
                merged_md_parts.append(f"{lab.steps_json}\n\n")
        merged_md_parts.append("\n\n")

    merged_md = "".join(merged_md_parts)

    # Generate EPUB
    safe_course_title = PDFService._sanitize_filename(course.title)
    epub_path = await PDFService.convert_markdown_to_epub(
        merged_md, current_user.id, course.title, safe_course_title
    )

    if not epub_path:
        raise HTTPException(
            status_code=500, detail="Failed to generate merged EPUB. Check backend logs."
        )

    # Return file
    full_path = PDFService.BASE_DIR / epub_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Generated EPUB file not found")

    return FileResponse(
        path=str(full_path),
        media_type="application/epub+zip",
        filename=f"{safe_course_title}.epub",
    )