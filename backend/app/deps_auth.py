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
        # Suporte a múltiplos perfis no token (payload.roles)
        user_roles: List[str] = []
        primary = getattr(payload, "role", None)
        if primary:
            user_roles.append(primary)
        extra = getattr(payload, "roles", None)
        if isinstance(extra, list):
            for r in extra:
                if r and r not in user_roles:
                    user_roles.append(r)
        if not any(r in roles for r in user_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return payload
    return _inner
