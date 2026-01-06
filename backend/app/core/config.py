from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Autolearn.ai"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str

    # LLM
    OPENAI_API_KEY: str
    OPENAI_BASE_URL: str
    LLM_MODEL: str = "gpt-3.5-turbo"
    DEFAULT_LANGUAGE: str = "en"  # en or it

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()
