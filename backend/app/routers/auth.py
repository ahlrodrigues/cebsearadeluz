# backend/app/routers/auth.py
import os
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..auth_tokens import create_access_token, create_refresh_token, decode_token, create_reset_token, create_confirm_token
from ..auth_tokens import TokenPayload
from ..security import verify_password  # seu bcrypt.verify
from ..deps_auth import require_roles

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

def _get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()

@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.is_active is False:
        raise HTTPException(status_code=403, detail="Inactive user")

    role = user.role or "user"
    return TokenPair(
        access_token=create_access_token(str(user.id), role),
        refresh_token=create_refresh_token(str(user.id), role),
    )

@router.post("/refresh", response_model=TokenPair)
def refresh(refresh_token: str):
    payload = decode_token(refresh_token)
    if not payload or payload.type != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return TokenPair(
        access_token=create_access_token(payload.sub, payload.role),
        refresh_token=create_refresh_token(payload.sub, payload.role),
    )


# Password reset flow
class ForgotRequest(BaseModel):
    email: EmailStr

@router.post("/forgot-password")
def forgot_password(payload: ForgotRequest, db: Session = Depends(get_db)):
    # Always return 200 to avoid leaking which emails exist
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        token = create_reset_token(str(user.id))
        _send_reset_email(payload.email, token)
    return {"ok": True}


class ResetRequest(BaseModel):
    token: str
    new_password: str

@router.post("/reset-password")
def reset_password(payload: ResetRequest, db: Session = Depends(get_db)):
    tp = decode_token(payload.token)
    if not tp or tp.type != "reset":
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user = db.query(User).get(int(tp.sub))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Use the existing get_password_hash from security
    from ..security import get_password_hash
    user.hashed_password = get_password_hash(payload.new_password)
    user.is_active = True
    db.add(user)
    db.commit()
    return {"ok": True}


def _send_reset_email(to_email: str, token: str) -> None:
    """Send reset link via SMTP if configured; otherwise log to console."""
    import os, smtplib
    from email.message import EmailMessage

    frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
    reset_url = f"{frontend_base}/reset-password?token={token}"

    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    from_addr = os.getenv("SMTP_FROM") or user
    starttls = os.getenv("SMTP_STARTTLS", "1") == "1"

    subject = "Redefinição de senha"
    body = f"""
Olá,

Recebemos uma solicitação para redefinir sua senha.

Para continuar, acesse o link:
{reset_url}

Se você não solicitou esta redefinição, ignore este e-mail.
""".strip()

    if not host or not from_addr:
        # Dev fallback: log to console for manual copy
        print(f"[reset] To: {to_email} | Link: {reset_url}")
        return

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to_email
        msg.set_content(body)

        with smtplib.SMTP(host, port, timeout=10) as s:
            if starttls:
                s.starttls()
            if user and password:
                s.login(user, password)
            s.send_message(msg)
    except Exception as e:
        # Fallback to console log
        print(f"[reset][warn] Failed to send e-mail: {e}. Link: {reset_url}")


class ConfirmRequest(BaseModel):
    token: str

def _send_confirm_email(to_email: str, token: str) -> None:
    import os, smtplib
    from email.message import EmailMessage

    frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
    confirm_url = f"{frontend_base}/confirm?token={token}"

    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    from_addr = os.getenv("SMTP_FROM") or user
    starttls = os.getenv("SMTP_STARTTLS", "1") == "1"

    subject = "Confirme seu cadastro"
    body = f"""
Olá,

Obrigado por se cadastrar. Para ativar sua conta, confirme o e-mail neste link:
{confirm_url}

""".strip()

    if not host or not from_addr:
        print(f"[confirm] To: {to_email} | Link: {confirm_url}")
        return

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to_email
        msg.set_content(body)

        with smtplib.SMTP(host, port, timeout=10) as s:
            if starttls:
                s.starttls()
            if user and password:
                s.login(user, password)
            s.send_message(msg)
    except Exception as e:
        print(f"[confirm][warn] Failed to send e-mail: {e}. Link: {confirm_url}")


@router.post("/confirm")
def confirm_account(payload: ConfirmRequest, db: Session = Depends(get_db)):
    tp = decode_token(payload.token)
    if not tp or tp.type != "confirm":
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user = db.query(User).get(int(tp.sub))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "Ativo"
    user.is_active = True
    db.add(user)
    db.commit()
    return {"ok": True}


# Resend confirmation for users who have not confirmed yet
class ResendConfirmRequest(BaseModel):
    email: EmailStr


@router.post("/resend-confirmation")
def resend_confirmation(payload: ResendConfirmRequest, db: Session = Depends(get_db)):
    # Always return 200 to avoid leaking email existence
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return {"ok": True}
    if user.is_active is True:
        return {"ok": True}
    # Send a fresh token
    token = create_confirm_token(str(user.id))
    _send_confirm_email(payload.email, token)
    return {"ok": True}


# Allow admin to generate a confirmation token for a specific user
class AdminConfirmTokenRequest(BaseModel):
    user_id: int


class AdminConfirmTokenResponse(BaseModel):
    token: str


@router.post("/admin/confirm-token", response_model=AdminConfirmTokenResponse)
def admin_create_confirm_token(
    payload: AdminConfirmTokenRequest,
    db: Session = Depends(get_db),
    _=Depends(require_roles(["admin"]))
):
    user = db.query(User).get(payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token = create_confirm_token(str(user.id))
    return AdminConfirmTokenResponse(token=token)


class AdminSendConfirmRequest(BaseModel):
    user_id: int


@router.post("/admin/send-confirmation")
def admin_send_confirmation(
    payload: AdminSendConfirmRequest,
    db: Session = Depends(get_db),
    _=Depends(require_roles(["admin"]))
):
    user = db.query(User).get(payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.email:
        raise HTTPException(status_code=400, detail="User has no e-mail")
    if user.is_active is True:
        return {"ok": True}
    token = create_confirm_token(str(user.id))
    _send_confirm_email(user.email, token)
    return {"ok": True}


@router.get("/confirm/inspect")
def inspect_confirm_token(token: str):
    tp = decode_token(token)
    if not tp or tp.type != "confirm":
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    # Minimal safe echo of token data
    return {"sub": tp.sub, "type": tp.type, "exp": tp.exp, "iat": tp.iat}


# Public endpoint to validate registration status (optional leakage)
class RegistrationStatusRequest(BaseModel):
    email: EmailStr


class RegistrationStatusResponse(BaseModel):
    allowed: bool
    requires_confirmation: bool
    known: bool | None = None
    active: bool | None = None
    status: str | None = None


@router.post("/registration-status", response_model=RegistrationStatusResponse)
def registration_status(payload: RegistrationStatusRequest, db: Session = Depends(get_db)):
    requires_confirmation = os.getenv("CONFIRM_EMAIL_ON_REGISTER", "0") == "1"
    allow_public = os.getenv("ALLOW_PUBLIC_REGISTRATION_STATUS", "0") == "1"
    if not allow_public:
        # Do not leak existence of e-mail
        return RegistrationStatusResponse(
            allowed=False,
            requires_confirmation=requires_confirmation,
        )
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return RegistrationStatusResponse(
            allowed=True,
            requires_confirmation=requires_confirmation,
            known=False,
        )
    return RegistrationStatusResponse(
        allowed=True,
        requires_confirmation=requires_confirmation,
        known=True,
        active=bool(user.is_active),
        status=str(user.status),
    )
