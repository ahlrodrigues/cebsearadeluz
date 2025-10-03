from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from .security import decode_token
from .schemas_auth import TokenPayload
from typing import List

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user_token(token: str = Depends(oauth2_scheme)) -> TokenPayload:
    payload = decode_token(token)
    if not payload or payload.type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload

def require_roles(roles: List[str]):
    def _inner(payload: TokenPayload = Depends(get_current_user_token)):
        if payload.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return payload
    return _inner
