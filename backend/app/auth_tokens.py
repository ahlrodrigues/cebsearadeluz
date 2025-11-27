# backend/app/auth_tokens.py
import os, time
from datetime import datetime, timedelta
from typing import Optional, List
from jose import jwt, JWTError
from pydantic import BaseModel

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "30"))
CONFIRM_TOKEN_EXPIRE_DAYS = int(os.getenv("CONFIRM_TOKEN_EXPIRE_DAYS", "3"))

class TokenPayload(BaseModel):
    sub: str        # user id
    role: str       # primary role (backward-compat)
    roles: Optional[List[str]] = None  # all roles granted
    type: str       # "access" | "refresh"
    exp: int
    iat: int

def _exp(minutes: int = None, days: int = None) -> int:
    now = datetime.utcnow()
    if minutes is not None: return int((now + timedelta(minutes=minutes)).timestamp())
    if days is not None:    return int((now + timedelta(days=days)).timestamp())
    return int((now + timedelta(minutes=15)).timestamp())

def create_access_token(sub: str, role: str, roles: Optional[list[str]] = None) -> str:
    payload = {
        "sub": sub,
        "role": role,
        "roles": roles or [role],
        "type": "access",
        "exp": _exp(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": int(time.time()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(sub: str, role: str, roles: Optional[list[str]] = None) -> str:
    payload = {
        "sub": sub,
        "role": role,
        "roles": roles or [role],
        "type": "refresh",
        "exp": _exp(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "iat": int(time.time()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_reset_token(sub: str) -> str:
    payload = {"sub": sub, "role": "user", "type": "reset",
               "exp": _exp(minutes=RESET_TOKEN_EXPIRE_MINUTES), "iat": int(time.time())}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_confirm_token(sub: str) -> str:
    payload = {"sub": sub, "role": "user", "type": "confirm",
               "exp": _exp(days=CONFIRM_TOKEN_EXPIRE_DAYS), "iat": int(time.time())}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[TokenPayload]:
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenPayload(**data)
    except JWTError:
        return None


# Optional: QR token helpers for presence scanning
def create_qr_token(sub: str, role: str = "user") -> str:
    # Long-lived token by default (effectively non-expiring for the project needs)
    days = int(os.getenv("QR_TOKEN_EXPIRE_DAYS", "36500"))  # ~100 anos
    payload = {
        "sub": sub,
        "role": role,
        "roles": [role],
        "type": "qr",
        "exp": _exp(days=days),
        "iat": int(time.time()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
