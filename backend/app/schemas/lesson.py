from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LessonCreate(BaseModel):
    course_id: int
    title: str
    path_in_index: str
    use_web_research: bool = False


class LessonOut(BaseModel):
    id: int
    course_id: int
    title: str
    path_in_index: str
    content_markdown: str
    pdf_path: Optional[str]
    is_completed: bool
    is_favorite: bool = False
    user_notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class LessonUpdate(BaseModel):
    is_completed: Optional[bool] = None
    is_favorite: Optional[bool] = None
    user_notes: Optional[str] = None


class QuestionCreate(BaseModel):
    question: str
    parent_id: Optional[int] = None  # Rispondi dentro thread


class ChatMessageCreate(BaseModel):
    content: str
    parent_id: Optional[int] = None  # Primo messaggio: aggancia al commento di partenza


class QuestionOut(BaseModel):
    id: int
    question: str
    answer: Optional[str] = None
    parent_id: Optional[int] = None
    role: Optional[str] = None
    conversation_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
