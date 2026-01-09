from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime


class LessonIndexItem(BaseModel):
    title: str
    path: str  # e.g. "1.1" relative index ID


class ModuleIndexItem(BaseModel):
    title: str
    lessons: List[LessonIndexItem]


class CourseCreate(BaseModel):
    topic: str
    custom_instructions: Optional[str] = None
    language: Optional[str] = None  # "en" or "it"


class CourseUpdate(BaseModel):
    title: Optional[str] = None


class CourseOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    index_json: str  # We might want to parse this in the frontend or use a JSON field in Pydantic if we used a specific type
    created_at: datetime
    # We can return the parsed index if we want, but for now raw string or parsed:
    # index: List[ModuleIndexItem]

    model_config = {"from_attributes": True}


class CourseList(BaseModel):
    id: int
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}
