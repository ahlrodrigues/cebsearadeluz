from pydantic import BaseModel
from typing import Optional, List


class LoginRequest(BaseModel):
    username: str  # ou email, conforme seu User
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    role: str
    roles: Optional[List[str]] = None
    type: str  # "access" | "refresh"
