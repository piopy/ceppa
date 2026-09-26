import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.base import HandsOnCourse, Lab, User
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)


def normalize_course_index(index_json: str) -> dict:
    """Indice v1 (array) -> forma v2 {spine_project, modules}. v2 passa invariato."""
    try:
        data = json.loads(index_json)
    except (json.JSONDecodeError, TypeError):
        return {"spine_project": None, "modules": []}
    if isinstance(data, list):
        modules = []
        for m in data:
            labs = [
                {
                    "title": lab.get("title", ""),
                    "path": lab.get("path", ""),
                    "type": lab.get("type", "lab"),
                    "mode": "guided",
                    "difficulty": 3,
                    "objective": "",
                    "prerequisites": [],
                    "setup_required": False,
                    "deliverable": "",
                    "acceptance_criteria": [],
                    "increment": "",
                }
                for lab in m.get("labs", [])
            ]
            modules.append({"title": m.get("title", ""), "level": "applied", "concepts": [], "labs": labs})
        return {"spine_project": None, "modules": modules}
    return data if isinstance(data, dict) else {"spine_project": None, "modules": []}


def normalize_lab_content(steps_json: str) -> dict:
    """steps_json v1 (array) -> wrapper v2. v2 passa invariato."""
    try:
        data = json.loads(steps_json)
    except (json.JSONDecodeError, TypeError):
        data = []
    if isinstance(data, list):
        return {"mode": "guided", "objective": "", "setup": {"needed": False, "description": "", "commands": []}, "steps": data, "deliverable": "", "reflection": []}
    return data if isinstance(data, dict) else {"mode": "guided", "objective": "", "setup": {}, "steps": [], "deliverable": "", "reflection": []}


def lab_meta_from_index(index_json: str, path: str) -> dict:
    """Metadati lab v2 dall'indice: mode, spine, prerequisites, setup già fatto."""
    norm = normalize_course_index(index_json)
    spine = (norm.get("spine_project") or None)
    prev, found, setup_done, meta = [], None, False, {}
    for module in norm.get("modules", []):
        for lab in module.get("labs", []):
            if lab.get("path") == path:
                found = lab
                break
            prev.append(lab.get("title", ""))
            if lab.get("setup_required"):
                setup_done = True
        if found:
            break
    if found:
        meta = {"mode": found.get("mode", "guided"), "spine_project": spine, "prerequisites": prev, "setup_already_done": setup_done}
    else:
        meta = {"mode": "guided", "spine_project": spine, "prerequisites": prev, "setup_already_done": setup_done}
    return meta


def _parse_lab_response(lab_json_str: str) -> tuple:
    """(theory_content, steps_json wrapper). Fallback: tutto in theory."""
    try:
        lab_data = json.loads(lab_json_str)
        theory_content = lab_data.get("theory_content", "")
        if isinstance(lab_data.get("steps"), list):
            steps_json = json.dumps(lab_data)  # wrapper v2 intero
        else:
            steps_json = json.dumps([])
    except json.JSONDecodeError:
        theory_content, steps_json = lab_json_str, json.dumps([])
    return theory_content, steps_json


class HandsOnService:

    @staticmethod
    async def create_hands_on_course(
        db: AsyncSession,
        user: User,
        topic: str,
        custom_instructions: str = None,
        language: str = "en",
        use_web_research: bool = False,
        target_level: str = None,
    ) -> HandsOnCourse:
        """Generate a hands-on course index and save it."""
        # 1. Generate index via LLM
        index_json_str = await LLMService.generate_hands_on_course_index(
            topic,
            custom_instructions,
            language,
            use_web_research=use_web_research,
            user=user,
            target_level=target_level,
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
        mode: str = None,
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

        # Metadati v2 dall'indice (mode di default, spine, prerequisiti, setup)
        meta = lab_meta_from_index(hands_on_course.index_json, path_in_index)

        # Generate content via LLM
        lab_json_str = await LLMService.generate_lab_content(
            hands_on_course.topic,
            lab_title,
            hands_on_course.index_json,
            hands_on_course.language or "en",
            use_web_research=use_web_research,
            user=user,
            mode=mode or meta["mode"],
            spine_project=meta["spine_project"],
            prerequisites=meta["prerequisites"],
            setup_already_done=meta["setup_already_done"],
        )

        theory_content, steps_json = _parse_lab_response(lab_json_str)

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
    async def regenerate_lab(
        db: AsyncSession,
        user: User,
        lab: Lab,
        hands_on_course: HandsOnCourse,
        feedback: str,
        use_web_research: bool = False,
        mode: str = None,
    ) -> Lab:
        """Regenerate a lab with user feedback (feedback ora passato al LLM, prima ignorato)."""
        meta = lab_meta_from_index(hands_on_course.index_json, lab.path_in_index)
        # Generate content via LLM with feedback
        lab_json_str = await LLMService.generate_lab_content(
            hands_on_course.topic,
            lab.title,
            hands_on_course.index_json,
            hands_on_course.language or "en",
            use_web_research=use_web_research,
            user=user,
            mode=mode or normalize_lab_content(lab.steps_json).get("mode", "guided"),
            spine_project=meta["spine_project"],
            prerequisites=meta["prerequisites"],
            setup_already_done=meta["setup_already_done"],
            feedback=feedback,
        )

        theory_content, steps_json = _parse_lab_response(lab_json_str)

        # Update lab content
        lab.theory_content = theory_content
        lab.steps_json = steps_json
        await db.commit()
        await db.refresh(lab)
        return lab

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
