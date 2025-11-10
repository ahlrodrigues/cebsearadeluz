import base64, os, secrets, time
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from jose import jwt
from sqlalchemy.orm import Session

from ..database import get_db, engine
from ..models import User, WebAuthnCredential, Base
from ..auth_tokens import SECRET_KEY, ALGORITHM, create_access_token, create_refresh_token
from ..deps_auth import get_current_user_token

router = APIRouter(prefix="/webauthn", tags=["webauthn"])


def _ensure_tables():
    try:
        Base.metadata.create_all(bind=engine, tables=[WebAuthnCredential.__table__])
    except Exception:
        pass


def b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64u_to_bytes(s: str) -> bytes:
    pad = '=' * ((4 - (len(s) % 4)) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _state_token(kind: str, user_id: int, challenge: bytes) -> str:
    now = int(time.time())
    payload = {
        "k": kind,
        "uid": user_id,
        "chal": b64u(challenge),
        "exp": now + 300,
        "iat": now,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _verify_state(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(status_code=400, detail="Estado inválido ou expirado")


def _rp_info() -> tuple[str, str]:
    rp_id = os.getenv("WEB_AUTHN_RP_ID")
    rp_name = os.getenv("WEB_AUTHN_RP_NAME", "CEB Seara da Luz")
    if not rp_id:
        # fallback do host a partir do FRONTEND_BASE_URL
        fb = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
        try:
            from urllib.parse import urlparse
            rp_id = urlparse(fb).hostname or "localhost"
        except Exception:
            rp_id = "localhost"
    return rp_id, rp_name


class BeginRegisterResponse(BaseModel):
    publicKey: dict
    state: str


@router.post("/register/begin", response_model=BeginRegisterResponse)
def register_begin(
    payload = Depends(get_current_user_token),
    db: Session = Depends(get_db),
):
    if os.getenv("WEB_AUTHN_ENABLED", "0") != "1":
        raise HTTPException(status_code=404, detail="WebAuthn desabilitado")
    _ensure_tables()
    uid = int(getattr(payload, "sub", 0))
    user = db.query(User).get(uid)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if not getattr(user, "digital_login_enabled", True):
        raise HTTPException(status_code=403, detail="Login digital desativado para este usuário")

    rp_id, rp_name = _rp_info()
    challenge = secrets.token_bytes(32)
    state = _state_token("reg", user_id=user.id, challenge=challenge)

    # ids já registrados para excluir
    creds = db.query(WebAuthnCredential).filter(WebAuthnCredential.user_id == user.id).all()
    # Política: não permitir múltiplas credenciais por usuário
    if len(creds) >= 1:
        raise HTTPException(status_code=400, detail="Já existe uma credencial de biometria cadastrada para este usuário.")
    exclude = [{"type": "public-key", "id": c.credential_id} for c in creds]

    pubkey = {
        "rp": {"name": rp_name, "id": rp_id},
        "user": {
            "id": b64u(str(user.id).encode("utf-8")),
            "name": user.email or f"user-{user.id}",
            "displayName": user.social_name or user.full_name,
        },
        "challenge": b64u(challenge),
        "pubKeyCredParams": [
            {"type": "public-key", "alg": -7},   # ES256
            {"type": "public-key", "alg": -257}, # RS256
        ],
        "timeout": 60000,
        "attestation": "none",
        "authenticatorSelection": {"residentKey": "preferred", "userVerification": "preferred"},
        "excludeCredentials": exclude,
    }
    return BeginRegisterResponse(publicKey=pubkey, state=state)


class FinishRegisterRequest(BaseModel):
    state: str
    id: str
    rawId: str
    type: str
    response: dict


@router.post("/register/finish")
def register_finish(payload: FinishRegisterRequest, ctx = Depends(get_current_user_token), db: Session = Depends(get_db)):
    if os.getenv("WEB_AUTHN_ENABLED", "0") != "1":
        raise HTTPException(status_code=404, detail="WebAuthn desabilitado")
    _ensure_tables()
    uid = int(getattr(ctx, "sub", 0))
    st = _verify_state(payload.state)
    if st.get("k") != "reg" or int(st.get("uid", 0)) != uid:
        raise HTTPException(status_code=400, detail="Estado inválido")
    user = db.query(User).get(uid)
    if not user or not getattr(user, "digital_login_enabled", True):
        raise HTTPException(status_code=403, detail="Login digital desativado para este usuário")

    dev_skip = os.getenv("WEB_AUTHN_DEV_SKIP_VERIFY", "0") == "1"
    if not dev_skip:
        # Para produção, integrar py-webauthn/python-fido2 e validar a attestation aqui.
        raise HTTPException(status_code=501, detail="Verificação WebAuthn não configurada (habilite WEB_AUTHN_DEV_SKIP_VERIFY=1 em dev)")

    # Dev: armazenar credential_id e stub de public_key
    cred_id = payload.id
    # Política: um registro por usuário
    existing_for_user = db.query(WebAuthnCredential).filter(WebAuthnCredential.user_id == uid).all()
    if len(existing_for_user) >= 1:
        # Se for a mesma credencial, trata como idempotente
        if any(c.credential_id == payload.id for c in existing_for_user):
            return {"ok": True}
        raise HTTPException(status_code=400, detail="Usuário já possui uma credencial cadastrada.")
    # Evitar duplicidade de credential_id entre usuários
    exists = db.query(WebAuthnCredential).filter(WebAuthnCredential.credential_id == cred_id).first()
    if exists and exists.user_id != uid:
        raise HTTPException(status_code=400, detail="Credencial já vinculada a outro usuário.")
    rec = WebAuthnCredential(
        user_id=uid,
        credential_id=cred_id,
        public_key="dev-skip",
        sign_count=0,
        transports=",".join(payload.response.get("transports", []) or []),
    )
    db.add(rec)
    db.commit()
    return {"ok": True}


class BeginLoginRequest(BaseModel):
    email: EmailStr


class BeginLoginResponse(BaseModel):
    publicKey: dict
    state: str


@router.post("/login/begin", response_model=BeginLoginResponse)
def login_begin(payload: BeginLoginRequest, db: Session = Depends(get_db)):
    if os.getenv("WEB_AUTHN_ENABLED", "0") != "1":
        raise HTTPException(status_code=404, detail="WebAuthn desabilitado")
    _ensure_tables()
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        # Para não vazar existência de e-mail, responder genericamente
        raise HTTPException(status_code=404, detail="Credencial não encontrada")
    if not getattr(user, "digital_login_enabled", True):
        raise HTTPException(status_code=403, detail="Login digital desativado para este usuário")
    creds = db.query(WebAuthnCredential).filter(WebAuthnCredential.user_id == user.id).all()
    if not creds:
        raise HTTPException(status_code=404, detail="Credencial não encontrada")

    rp_id, rp_name = _rp_info()
    challenge = secrets.token_bytes(32)
    state = _state_token("auth", user_id=user.id, challenge=challenge)
    allow = [{"type": "public-key", "id": c.credential_id, "transports": (c.transports or "").split(",") if c.transports else []} for c in creds]
    pubkey = {
        "challenge": b64u(challenge),
        "timeout": 60000,
        "rpId": rp_id,
        "allowCredentials": allow,
        "userVerification": "preferred",
    }
    return BeginLoginResponse(publicKey=pubkey, state=state)


class FinishLoginRequest(BaseModel):
    state: str
    id: str
    rawId: str
    type: str
    response: dict


@router.post("/login/finish")
def login_finish(payload: FinishLoginRequest, db: Session = Depends(get_db)):
    if os.getenv("WEB_AUTHN_ENABLED", "0") != "1":
        raise HTTPException(status_code=404, detail="WebAuthn desabilitado")
    _ensure_tables()
    st = _verify_state(payload.state)
    if st.get("k") != "auth":
        raise HTTPException(status_code=400, detail="Estado inválido")
    uid = int(st.get("uid", 0))
    cred = db.query(WebAuthnCredential).filter(WebAuthnCredential.user_id == uid, WebAuthnCredential.credential_id == payload.id).first()
    if not cred:
        raise HTTPException(status_code=400, detail="Credencial desconhecida")

    dev_skip = os.getenv("WEB_AUTHN_DEV_SKIP_VERIFY", "0") == "1"
    if not dev_skip:
        # Para produção, validar assertion (clientDataJSON, authenticatorData, signature, etc.).
        raise HTTPException(status_code=501, detail="Verificação WebAuthn não configurada (habilite WEB_AUTHN_DEV_SKIP_VERIFY=1 em dev)")

    user = db.query(User).get(uid)
    if not user or user.is_active is False:
        raise HTTPException(status_code=403, detail="Usuário inativo")
    if not getattr(user, "digital_login_enabled", True):
        raise HTTPException(status_code=403, detail="Login digital desativado para este usuário")
    role = user.role or "user"
    return {
        "access_token": create_access_token(str(user.id), role),
        "refresh_token": create_refresh_token(str(user.id), role),
        "token_type": "bearer",
    }
