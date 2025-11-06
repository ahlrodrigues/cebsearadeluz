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
    # Permite definir apenas o nome (SMTP_FROM_NAME) e/ou o cabeçalho completo em SMTP_FROM
    from_config = os.getenv("SMTP_FROM") or user
    from_name = os.getenv("SMTP_FROM_NAME")
    if from_name and user:
        from_addr = f"{from_name} <{user}>"
    else:
        from_addr = from_config
    starttls = os.getenv("SMTP_STARTTLS", "1") == "1"

    subject = "Redefinição de senha"

    # Texto simples (fallback)
    text_body = f"""
Olá,

Recebemos uma solicitação para redefinir sua senha no CEB Seara da Luz.

Para continuar, acesse o link:
{reset_url}

Se você não solicitou esta redefinição, ignore este e-mail.
""".strip()

    # HTML com mesmo layout do e-mail de confirmação
    html_body = f"""
<!doctype html>
<html lang=\"pt-br\">
  <head>
    <meta charset=\"UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <title>{subject}</title>
  </head>
  <body style=\"margin:0;padding:0;background-color:#f5f7fa;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif; color:#1f2937;\">
    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background-color:#f5f7fa;\">
      <tr>
        <td align=\"center\" style=\"padding:24px 12px;\">
          <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);\">
            <tr>
              <td style=\"background-color:#1976d2;color:#ffffff;padding:16px 20px;font-size:18px;font-weight:600;\">
                CEB Seara da Luz
              </td>
            </tr>
            <tr>
              <td style=\"padding:24px 20px;\">
                <h1 style=\"margin:0 0 8px 0;font-size:20px;color:#111827;\">Redefinição de senha</h1>
                <p style=\"margin:0 0 16px 0;line-height:1.5;\">Olá,</p>
                <p style=\"margin:0 0 16px 0;line-height:1.6;\">Recebemos uma solicitação para redefinir sua senha no <strong>CEB Seara da Luz</strong>. Para continuar, clique no botão abaixo:</p>

                <div style=\"text-align:center;margin:24px 0;\">
                  <a href=\"{reset_url}\" target=\"_blank\" rel=\"noopener noreferrer\"
                     style=\"display:inline-block;background-color:#1976d2;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;\">
                    Redefinir senha
                  </a>
                </div>

                <p style=\"margin:0 0 12px 0;line-height:1.6;\">Se o botão não funcionar, copie e cole este link no navegador:</p>
                <p style=\"margin:0 0 16px 0;word-break:break-all;color:#1f2937;\"><a href=\"{reset_url}\" style=\"color:#1976d2;\">{reset_url}</a></p>
                <p style=\"margin:0;line-height:1.6;color:#6b7280;\">Se você não solicitou esta redefinição, ignore este e-mail.</p>
              </td>
            </tr>
            <tr>
              <td style=\"background-color:#f9fafb;color:#6b7280;padding:12px 20px;font-size:12px;text-align:center;\">
                © {os.getenv('EMAIL_FOOTER_YEAR', str(__import__('datetime').datetime.now().year))} CEB Seara da Luz — Todos os direitos reservados
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
"""

    if not host or not from_addr:
        # Dev fallback: log to console for manual copy
        print(f"[reset] To: {to_email} | Link: {reset_url}")
        return

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to_email
        msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")

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
    # Permite definir apenas o nome (SMTP_FROM_NAME) e/ou o cabeçalho completo em SMTP_FROM
    from_config = os.getenv("SMTP_FROM") or user
    from_name = os.getenv("SMTP_FROM_NAME")
    if from_name and user:
        from_addr = f"{from_name} <{user}>"
    else:
        from_addr = from_config
    starttls = os.getenv("SMTP_STARTTLS", "1") == "1"

    subject = "Confirme seu cadastro"

    # Corpo em texto simples (fallback)
    text_body = f"""
Olá,

Obrigado por se cadastrar no CEB Seara da Luz.

Para ativar sua conta, confirme seu e-mail acessando o link abaixo:
{confirm_url}

Se você não solicitou este cadastro, ignore este e-mail.
""".strip()

    # Layout HTML com as cores do frontend (primary #1976d2, bg #f5f7fa)
    html_body = f"""
<!doctype html>
<html lang=\"pt-br\">
  <head>
    <meta charset=\"UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <title>{subject}</title>
  </head>
  <body style=\"margin:0;padding:0;background-color:#f5f7fa;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif; color:#1f2937;\">
    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background-color:#f5f7fa;\">
      <tr>
        <td align=\"center\" style=\"padding:24px 12px;\">
          <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);\">
            <tr>
              <td style=\"background-color:#1976d2;color:#ffffff;padding:16px 20px;font-size:18px;font-weight:600;\">
                CEB Seara da Luz
              </td>
            </tr>
            <tr>
              <td style=\"padding:24px 20px;\">
                <h1 style=\"margin:0 0 8px 0;font-size:20px;color:#111827;\">Confirme seu cadastro</h1>
                <p style=\"margin:0 0 16px 0;line-height:1.5;\">Olá,</p>
                <p style=\"margin:0 0 16px 0;line-height:1.6;\">Obrigado por se cadastrar no <strong>CEB Seara da Luz</strong>. Para ativar sua conta, confirme seu e-mail clicando no botão abaixo.</p>

                <div style=\"text-align:center;margin:24px 0;\">
                  <a href=\"{confirm_url}\" target=\"_blank\" rel=\"noopener noreferrer\"
                     style=\"display:inline-block;background-color:#1976d2;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;\">
                    Confirmar e-mail
                  </a>
                </div>

                <p style=\"margin:0 0 12px 0;line-height:1.6;\">Se o botão não funcionar, copie e cole este link no navegador:</p>
                <p style=\"margin:0 0 16px 0;word-break:break-all;color:#1f2937;\"><a href=\"{confirm_url}\" style=\"color:#1976d2;\">{confirm_url}</a></p>
                <p style=\"margin:0;line-height:1.6;color:#6b7280;\">Se você não solicitou este cadastro, pode ignorar este e-mail.</p>
              </td>
            </tr>
            <tr>
              <td style=\"background-color:#f9fafb;color:#6b7280;padding:12px 20px;font-size:12px;text-align:center;\">
                © {os.getenv('EMAIL_FOOTER_YEAR', str(__import__('datetime').datetime.now().year))} CEB Seara da Luz — Todos os direitos reservados
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
"""

    if not host or not from_addr:
        print(f"[confirm] To: {to_email} | Link: {confirm_url}")
        return

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to_email
        # texto simples + alternativa HTML
        msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")

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
