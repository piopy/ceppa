from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LessonCreate(BaseModel):
    course_id: int
    title: str
    path_in_index: str


class LessonOut(BaseModel):
    id: int
    course_id: int
    title: str
    path_in_index: str
    content_markdown: str
    pdf_path: Optional[str]
    is_completed: bool
    user_notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class LessonUpdate(BaseModel):
    is_completed: Optional[bool] = None
    user_notes: Optional[str] = None


class QuestionCreate(BaseModel):
    question: str


class QuestionOut(BaseModel):
    id: int
    question: str
    answer: str
    created_at: datetime

    model_config = {"from_attributes": True}
