from datetime import datetime
from pydantic import BaseModel


class LessonQuestionExport(BaseModel):
    question: str
    answer: str
    created_at: datetime


class LessonExport(BaseModel):
    title: str
    path_in_index: str
    content_markdown: str
    is_completed: bool
    is_favorite: bool
    user_notes: str | None = None
    created_at: datetime
    questions: list[LessonQuestionExport] = []


class CourseExport(BaseModel):
    title: str
    description: str | None = None
    language: str = "en"
    index_json: str
    created_at: datetime
    lessons: list[LessonExport] = []


class LabQuestionExport(BaseModel):
    question: str
    answer: str
    created_at: datetime


class LabExport(BaseModel):
    title: str
    path_in_index: str
    theory_content: str
    steps_json: str
    is_completed: bool
    is_favorite: bool
    user_notes: str | None = None
    created_at: datetime
    questions: list[LabQuestionExport] = []


class HandsOnCourseExport(BaseModel):
    topic: str
    title: str
    description: str | None = None
    language: str = "en"
    custom_instructions: str | None = None
    index_json: str
    created_at: datetime
    labs: list[LabExport] = []


class UserExport(BaseModel):
    version: str = "1.0"
    exported_at: datetime
    username: str
    courses: list[CourseExport] = []
    hands_on_courses: list[HandsOnCourseExport] = []


class ImportResult(BaseModel):
    courses_imported: int
    lessons_imported: int
    hands_on_courses_imported: int
    labs_imported: int
