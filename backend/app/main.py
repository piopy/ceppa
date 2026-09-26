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
    # Dev locale: localhost + hostname/LAN (es. http://pop-os:6760, http://192.168.x.x:6760).
    # ponytail: regex ampia ok qui — JWT sta in localStorage, non nei cookie: nessun credential da rubare via CORS.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|\[::1\]|[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Create user_files dir if not exists (PDF serviti solo via endpoint autenticati)
os.makedirs("/app/user_files", exist_ok=True)

from app.api.api_v1.api import api_router

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
def read_root():
    return {"message": "Welcome to Ceppa.ai API"}

# Serve frontend static files (after all API routes so they take priority)
if os.path.isdir("/var/www/html"):
    app.mount("/", StaticFiles(directory="/var/www/html", html=True), name="frontend")
