from pydantic import BaseModel
from typing import Optional


class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: int

    model_config = {"from_attributes": True}
