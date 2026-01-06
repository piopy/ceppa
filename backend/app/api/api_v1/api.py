from fastapi import APIRouter
from app.api.api_v1.endpoints import auth, courses, lessons

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
