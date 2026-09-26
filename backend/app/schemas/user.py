from pydantic import BaseModel, Field
from typing import Optional


class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class User(UserBase):
    id: int

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    username: str
    custom_openai_api_key: Optional[str] = None
    custom_openai_base_url: Optional[str] = None
    custom_llm_model: Optional[str] = None
    custom_tavily_api_key: Optional[str] = None
    custom_openai_api_key_set: bool = False
    custom_tavily_api_key_set: bool = False

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    custom_openai_api_key: Optional[str] = None
    custom_openai_base_url: Optional[str] = None
    custom_llm_model: Optional[str] = None
    custom_tavily_api_key: Optional[str] = None
