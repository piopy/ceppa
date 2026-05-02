from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.db import Base


from sqlalchemy import JSON as SQLA_JSON


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    custom_openai_api_key = Column(String, nullable=True)
    custom_openai_base_url = Column(String, nullable=True)
    custom_llm_model = Column(String, nullable=True)
    custom_tavily_api_key = Column(String, nullable=True)

    courses = relationship("Course", back_populates="user", cascade="all, delete-orphan")
    hands_on_courses = relationship("HandsOnCourse", back_populates="user", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    description = Column(Text)
    index_json = Column(Text)  # Storing the JSON tree of the course index
    language = Column(String, default="en")  # "en" or "it"
    position = Column(Integer, nullable=True, default=0)  # For drag & drop ordering
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="courses")
    lessons = relationship("Lesson", back_populates="course", cascade="all, delete-orphan")


class Lesson(Base):
    __tablename__ = "lessons"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    title = Column(String)
    path_in_index = Column(String)  # e.g., "1.2.1" or ID from JSON
    content_markdown = Column(Text)  # The raw generated content
    pdf_path = Column(
        String, nullable=True
    )  # Path to PDF file relative to user media root
    is_completed = Column(Boolean, default=False)
    is_favorite = Column(Boolean, default=False)
    user_notes = Column(Text, nullable=True)  # For exercises/notes
    created_at = Column(TIMESTAMP, server_default=func.now())

    course = relationship("Course", back_populates="lessons")
    questions = relationship("LessonQuestion", back_populates="lesson", cascade="all, delete-orphan")


class LessonQuestion(Base):
    __tablename__ = "lesson_questions"
    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    lesson = relationship("Lesson", back_populates="questions")


class HandsOnCourse(Base):
    """
    Separate table for hands-on/lab courses to avoid any impact on existing theory courses.
    """
    __tablename__ = "hands_on_courses"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    topic = Column(String)
    title = Column(String)
    description = Column(Text)
    index_json = Column(Text)  # JSON tree of the lab index (30% theory / 70% practice modules)
    language = Column(String, default="en")
    custom_instructions = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="hands_on_courses")
    labs = relationship("Lab", back_populates="hands_on_course", cascade="all, delete-orphan")


class Lab(Base):
    """
    Individual lab sessions within a hands-on course.
    Each lab has theory content (30%) + practical steps (70%).
    """
    __tablename__ = "labs"
    id = Column(Integer, primary_key=True, index=True)
    hands_on_course_id = Column(Integer, ForeignKey("hands_on_courses.id"))
    title = Column(String)
    path_in_index = Column(String)  # e.g., "1.1", "2.3"
    theory_content = Column(Text)  # The 30% theory markdown
    steps_json = Column(Text)  # JSON array of practical steps (70%)
    is_completed = Column(Boolean, default=False)
    is_favorite = Column(Boolean, default=False)
    user_notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    hands_on_course = relationship("HandsOnCourse", back_populates="labs")
    questions = relationship("LabQuestion", back_populates="lab", cascade="all, delete-orphan")


class LabQuestion(Base):
    __tablename__ = "lab_questions"
    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    lab = relationship("Lab", back_populates="questions")
