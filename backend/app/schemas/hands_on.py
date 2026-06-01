from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


# ---- HandsOnCourse Schemas ---- #

class LabIndexItem(BaseModel):
    title: str
    path: str  # e.g. "1.1"
    type: str = "lab"  # "theory" or "lab"


class ModuleIndexItem(BaseModel):
    title: str
    labs: List[LabIndexItem]


class HandsOnCourseCreate(BaseModel):
    topic: str
    custom_instructions: Optional[str] = None
    language: Optional[str] = None
    use_web_research: Optional[bool] = False


class HandsOnCourseUpdate(BaseModel):
    title: Optional[str] = None


class HandsOnCourseOut(BaseModel):
    id: int
    topic: str
    title: str
    description: Optional[str]
    index_json: str
    language: str
    created_at: datetime

    model_config = {"from_attributes": True}


class HandsOnCourseList(BaseModel):
    id: int
    topic: str
    title: str
    created_at: datetime
    total_labs: int = 0
    completed_labs: int = 0
    all_labs_completed: bool = False

    model_config = {"from_attributes": True}


class HandsOnCoursesListResponse(BaseModel):
    items: List[HandsOnCourseList]
    total: int
    skip: int
    limit: int


# ---- Lab Schemas ---- #

class LabStep(BaseModel):
    step_number: int
    title: str
    description: str
    command: Optional[str] = None
    expected_output: Optional[str] = None
    hints: Optional[List[str]] = None
    is_completed: bool = False


class LabOut(BaseModel):
    id: int
    hands_on_course_id: int
    title: str
    path_in_index: str
    theory_content: str
    steps_json: str  # JSON string of LabStep[]
    pdf_path: Optional[str] = None
    is_completed: bool
    is_favorite: bool = False
    user_notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class LabUpdate(BaseModel):
    is_completed: Optional[bool] = None
    is_favorite: Optional[bool] = None
    user_notes: Optional[str] = None
    step_completed: Optional[int] = None  # Mark a specific step as completed


# ---- Lab Question Schemas ---- #

class LabQuestionCreate(BaseModel):
    question: str


class LabQuestionOut(BaseModel):
    id: int
    lab_id: int
    question: str
    answer: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerateAllLabsRequest(BaseModel):
    use_web_research: bool = False
