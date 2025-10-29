# backend/app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..auth_tokens import create_access_token, create_refresh_token, decode_token, create_reset_token, create_confirm_token
from ..auth_tokens import TokenPayload
from ..security import verify_password  # seu bcrypt.verify

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
