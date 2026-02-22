from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.db import Base


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
