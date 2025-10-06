# backend/app/deps_auth.py
from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user_token(token: str = Depends(oauth2_scheme)):
    from .auth_tokens import decode_token
    payload = decode_token(token)
    if not payload or payload.type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload

def require_roles(roles: List[str]):
    def _inner(payload = Depends(get_current_user_token)):
        if getattr(payload, 'role', None) not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return payload
    return _inner
