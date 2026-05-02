import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.base import HandsOnCourse, Lab, User
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)


class HandsOnService:

    @staticmethod
    async def create_hands_on_course(
        db: AsyncSession,
        user: User,
        topic: str,
        custom_instructions: str = None,
        language: str = "en",
        use_web_research: bool = False,
    ) -> HandsOnCourse:
        """Generate a hands-on course index and save it."""
        # 1. Generate index via LLM
        index_json_str = await LLMService.generate_hands_on_course_index(
            topic,
            custom_instructions,
            language,
            use_web_research=use_web_research,
            user=user,
        )
        json.loads(index_json_str)  # Validate JSON

        # 2. Determine title
        try:
            index_data = json.loads(index_json_str)
            module_titles = [m.get("title", "") for m in index_data]
            title = topic
        except Exception:
            title = topic

        # 3. Save to DB
        course = HandsOnCourse(
            user_id=user.id,
            topic=topic,
            title=title,
            description=f"Hands-on lab course on {topic}",
            index_json=index_json_str,
            language=language,
            custom_instructions=custom_instructions,
        )
        db.add(course)
        await db.commit()
        await db.refresh(course)
        return course

    @staticmethod
    async def get_or_generate_lab(
        db: AsyncSession,
        user: User,
        hands_on_course: HandsOnCourse,
        lab_title: str,
        path_in_index: str,
        use_web_research: bool = False,
    ) -> Lab:
        """Get existing lab or generate a new one via LLM."""
        # Check if lab already exists
        result = await db.execute(
            select(Lab).where(
                Lab.hands_on_course_id == hands_on_course.id,
                Lab.path_in_index == path_in_index,
            )
        )
        existing_lab = result.scalars().first()
        if existing_lab:
            return existing_lab

        # Generate content via LLM
        lab_json_str = await LLMService.generate_lab_content(
            hands_on_course.topic,
            lab_title,
            hands_on_course.index_json,
            hands_on_course.language or "en",
            use_web_research=use_web_research,
            user=user,
        )

        # Parse the JSON response
        try:
            lab_data = json.loads(lab_json_str)
            theory_content = lab_data.get("theory_content", "")
            steps = lab_data.get("steps", [])
            steps_json = json.dumps(steps)
        except json.JSONDecodeError:
            # Fallback: treat entire response as theory if JSON parsing fails
            theory_content = lab_json_str
            steps_json = json.dumps([])

        # Save to DB
        new_lab = Lab(
            hands_on_course_id=hands_on_course.id,
            title=lab_title,
            path_in_index=path_in_index,
            theory_content=theory_content,
            steps_json=steps_json,
        )
        db.add(new_lab)
        await db.commit()
        await db.refresh(new_lab)
        return new_lab

    @staticmethod
    async def get_lab_by_path(
        db: AsyncSession, course_id: int, path_in_index: str
    ) -> Lab:
        """Get a specific lab by its path in the index."""
        result = await db.execute(
            select(Lab).where(
                Lab.hands_on_course_id == course_id,
                Lab.path_in_index == path_in_index,
            )
        )
        return result.scalars().first()

    @staticmethod
    async def update_lab_progress(
        db: AsyncSession,
        lab: Lab,
        is_completed: bool = None,
        is_favorite: bool = None,
        user_notes: str = None,
        step_completed: int = None,
    ) -> Lab:
        """Update lab progress (completion, favorite, notes, step status)."""
        if is_completed is not None:
            lab.is_completed = is_completed
        if is_favorite is not None:
            lab.is_favorite = is_favorite
        if user_notes is not None:
            lab.user_notes = user_notes
        if step_completed is not None:
            # Update the specific step's is_completed in steps_json
            try:
                steps = json.loads(lab.steps_json)
                for step in steps:
                    if step.get("step_number") == step_completed:
                        step["is_completed"] = True
                        break
                lab.steps_json = json.dumps(steps)
            except (json.JSONDecodeError, TypeError):
                pass

        await db.commit()
        await db.refresh(lab)
        return lab
