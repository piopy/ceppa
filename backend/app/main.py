import logging
from fastapi import FastAPI
from app.core.config import settings
from fastapi.staticfiles import StaticFiles
import os

from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME, openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In dev, allow all. Could be refined to localhost:5173
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Create user_files dir if not exists
os.makedirs("/app/user_files", exist_ok=True)
app.mount("/media", StaticFiles(directory="/app/user_files"), name="media")

from app.api.api_v1.api import api_router

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
def read_root():
    return {"message": "Welcome to Ceppa.ai API"}

# Serve frontend static files (after all API routes so they take priority)
if os.path.isdir("/var/www/html"):
    app.mount("/", StaticFiles(directory="/var/www/html", html=True), name="frontend")
