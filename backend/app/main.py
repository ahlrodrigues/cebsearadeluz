import os
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, models, passes, schemas
from .database import Base, engine, get_db
try:
    from .routers import auth as auth_router
except Exception:  # pragma: no cover - allow tests without auth deps
    auth_router = None
from .deps_auth import get_current_user_token, require_roles
from .policies import enforce_auto_deactivation

app = FastAPI(title="User Management API", version="0.1.0")

ALLOWED_ORIGINS = ["*"]  # Dev: liberar todas as origens

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,  # necessário para usar '*'
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
if auth_router is not None:
    app.include_router(auth_router.router)


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    # Avoid 404 noise when browsers request favicon on backend host
    return Response(status_code=204)

# Only JWT QR tokens are accepted by default. Set ALLOW_LEGACY_QR=1 to
# temporarily accept numeric/JSON QR payloads during migration.
ALLOW_LEGACY_QR = os.getenv("ALLOW_LEGACY_QR", "0") == "1"
# Public registration can optionally require approval (user starts as Desativado)
REQUIRE_REGISTRATION_APPROVAL = os.getenv("REQUIRE_REGISTRATION_APPROVAL", "0") == "1"


@app.post("/users", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_user(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    if user_in.email:
        existing_user = crud.get_user_by_email(db, user_in.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe um usuário cadastrado com esse e-mail.",
            )
    user = crud.create_user(db, user_in)
    return user


@app.get("/users", response_model=list[schemas.User])
def read_users(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    status: schemas.UserStatus | None = None,
    role: schemas.UserRole | None = None,
    db: Session = Depends(get_db),
):
    users = crud.get_users(
        db,
        skip=skip,
        limit=limit,
        search=search,
        status=status.value if status else None,
        role=role.value if role else None,
    )
    return users


@app.get("/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return user


@app.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user_in: schemas.UserUpdate, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    if user_in.email and user_in.email != db_user.email:
        existing_user = crud.get_user_by_email(db, user_in.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe um usuário cadastrado com esse e-mail.",
            )

    updated_user = crud.update_user(db, db_user, user_in)
    return updated_user


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    crud.delete_user(db, db_user)
    return None


@app.get("/users/{user_id}/exam", response_model=schemas.ExamRecord)
def get_exam_record(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado.",
        )
    exam = crud.get_exam_record(db, user_id)
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ficha de exame não encontrada.",
        )
    return exam


@app.post(
    "/users/{user_id}/exam",
    response_model=schemas.ExamRecord,
    status_code=status.HTTP_201_CREATED,
)
def create_exam_record(
    user_id: int,
    exam_in: schemas.ExamRecordCreate,
    db: Session = Depends(get_db),
):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado.",
        )
    existing = crud.get_exam_record(db, user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe uma ficha de exame cadastrada para este assistido.",
        )
    exam = crud.create_exam_record(db, user_id, exam_in)
    return exam


@app.put("/users/{user_id}/exam", response_model=schemas.ExamRecord)
def upsert_exam_record(
    user_id: int,
    exam_in: schemas.ExamRecordUpdate,
    db: Session = Depends(get_db),
):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado.",
        )
    exam = crud.get_exam_record(db, user_id)
    if exam is None:
        create_payload = schemas.ExamRecordCreate(**exam_in.model_dump(exclude_unset=True))
        return crud.create_exam_record(db, user_id, create_payload)
    return crud.update_exam_record(db, exam, exam_in)


@app.get("/users/{user_id}/qr", response_model=schemas.UserQRCode)
def get_user_qr(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    display_name = user.social_name or user.full_name
    return schemas.UserQRCode(id=user.id, name=display_name)


@app.post(
    "/public/register",
    response_model=schemas.PublicRegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def public_register(payload: schemas.PublicRegisterRequest, db: Session = Depends(get_db)):
    user_in = schemas.UserCreate(**payload.model_dump())
    desired_status = (
        schemas.UserStatus.DESATIVADO if REQUIRE_REGISTRATION_APPROVAL else schemas.UserStatus.ATIVO
    )
    user_in.role = schemas.UserRole.USER
    user_in.status = desired_status
    user = crud.create_user(db, user_in)
    return schemas.PublicRegisterResponse(
        id=user.id, status=schemas.UserStatus(user.status), role=schemas.UserRole(user.role)
    )


@app.get("/me", response_model=schemas.User)
def me(payload = Depends(get_current_user_token), db: Session = Depends(get_db)):
    user = crud.get_user(db, int(getattr(payload, 'sub', 0)))
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return user


@app.get("/me/qr-token")
def me_qr_token(payload = Depends(get_current_user_token), db: Session = Depends(get_db)):
    user = crud.get_user(db, int(getattr(payload, 'sub', 0)))
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    from .auth_tokens import create_qr_token
    return {"token": create_qr_token(str(user.id), user.role or "user")}


@app.get("/me/pass-cycles", response_model=list[schemas.PassCycle])
def me_pass_cycles(payload = Depends(get_current_user_token), db: Session = Depends(get_db)):
    uid = int(getattr(payload, 'sub', 0))
    return passes.list_cycles(db, uid)


@app.get("/me/pass-cycles/active", response_model=schemas.PassCycle)
def me_active_pass_cycle(payload = Depends(get_current_user_token), db: Session = Depends(get_db)):
    uid = int(getattr(payload, 'sub', 0))
    cycle = passes.get_active_cycle(db, uid)
    if not cycle:
        raise HTTPException(status_code=404, detail="Usuário não possui ciclo de passes ativo.")
    return cycle


@app.get("/users/{user_id}/qr-token")
def get_user_qr_token(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    # Use role from user to embed in token; default to "user"
    from .auth_tokens import create_qr_token
    token = create_qr_token(str(user.id), user.role or "user")
    return {"token": token}


@app.get("/users/{user_id}/pass-cycles", response_model=list[schemas.PassCycle])
def list_pass_cycles(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    cycles = passes.list_cycles(db, user_id)
    return cycles


@app.get("/users/{user_id}/pass-cycles/active", response_model=schemas.PassCycle)
def get_active_pass_cycle(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    cycle = passes.get_active_cycle(db, user_id)
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não possui ciclo de passes ativo.",
        )
    return cycle


@app.post(
    "/users/{user_id}/passes/presence",
    response_model=schemas.PassSession,
    status_code=status.HTTP_201_CREATED,
)
def register_pass_presence(
    user_id: int,
    payload: schemas.PassPresenceRequest,
    db: Session = Depends(get_db),
):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    presence_date = payload.date or date.today()
    notes = payload.notes or "Presença registrada manualmente"
    session = passes.register_presence(
        db,
        user_id=user_id,
        presence_date=presence_date,
        notes=notes,
    )
    return session


@app.post("/passes/scan", response_model=schemas.PassSession, status_code=status.HTTP_201_CREATED)
def scan_qr_and_register_presence(payload: schemas.QRScanRequest, db: Session = Depends(get_db)):
    if not payload.token and not payload.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Forneça 'token' ou 'user_id'.")

    resolved_user_id: int | None = None
    # Dev convenience: accept explicit user_id on this dev endpoint
    if payload.user_id:
        resolved_user_id = payload.user_id
    elif payload.token:
        token_str = payload.token.strip()
        from .auth_tokens import decode_token
        decoded = decode_token(token_str)
        if decoded and decoded.type in {"qr", "access"}:
            try:
                resolved_user_id = int(decoded.sub)
            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token não contém usuário válido.")
        elif ALLOW_LEGACY_QR:
            # Legacy fallback (numeric / JSON)
            if token_str.isdigit():
                resolved_user_id = int(token_str)
            else:
                import json
                try:
                    parsed = json.loads(token_str)
                    candidate = parsed.get("user_id") or parsed.get("id")
                    if isinstance(candidate, int):
                        resolved_user_id = candidate
                    elif isinstance(candidate, str) and candidate.isdigit():
                        resolved_user_id = int(candidate)
                except Exception:
                    pass
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de QR inválido.")

    if not resolved_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não foi possível determinar o usuário.")

    user = crud.get_user(db, resolved_user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    if getattr(user, "status", None) != "Ativo" or getattr(user, "is_active", False) is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário desativado.")

    presence_date = payload.date or date.today()
    notes = payload.notes or "Presença via QR"
    session = passes.register_presence(db, user_id=resolved_user_id, presence_date=presence_date, notes=notes)
    return session


def _ensure_scanlog_table():
    try:
        models.Base.metadata.create_all(bind=engine, tables=[models.ScanLog.__table__])
    except Exception:
        pass


def _next_ticket_number(db: Session, for_date: date) -> int:
    _ensure_scanlog_table()
    from sqlalchemy import func
    last = (
        db.query(func.max(models.ScanLog.ticket_number))
        .filter(models.ScanLog.scanned_for == for_date, models.ScanLog.ok == True)
        .scalar()
    )
    return (last or 0) + 1


def _log_scan(
    db: Session,
    *,
    raw: str | None,
    token_type: str | None,
    scanned_for: date | None,
    ok: bool,
    error: str | None,
    user_id: int | None,
    session_id: int | None,
    ticket_number: int | None,
):
    _ensure_scanlog_table()
    log = models.ScanLog(
        raw=raw,
        token_type=token_type,
        scanned_for=scanned_for,
        ok=ok,
        error=error,
        user_id=user_id,
        session_id=session_id,
        ticket_number=ticket_number,
    )
    db.add(log)
    db.commit()
    return log


@app.post(
    "/passes/scan-kiosk",
    response_model=schemas.ScanKioskResponse,
    status_code=status.HTTP_201_CREATED,
)
def scan_kiosk(payload: schemas.QRScanRequest, db: Session = Depends(get_db), _=Depends(require_roles(["recepcao","admin"]))):
    raw = payload.token
    token_type: str | None = None
    resolved_user_id: int | None = None
    try:
        if not payload.token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Forneça 'token'.")

        if payload.token:
            token_str = payload.token.strip()
            # Try JWT first
            try:
                from .auth_tokens import decode_token
                dec = decode_token(token_str)
            except Exception:
                dec = None
            if dec and getattr(dec, "type", None) in {"qr", "access"}:
                resolved_user_id = int(dec.sub)
                token_type = "jwt"
            elif ALLOW_LEGACY_QR:
                if token_str.isdigit():
                    resolved_user_id = int(token_str)
                    token_type = "numeric"
                else:
                    import json
                    try:
                        parsed = json.loads(token_str)
                        candidate = parsed.get("user_id") or parsed.get("id")
                        if isinstance(candidate, int):
                            resolved_user_id = candidate
                        elif isinstance(candidate, str) and candidate.isdigit():
                            resolved_user_id = int(candidate)
                        token_type = "json"
                    except Exception:
                        token_type = "unknown"
            else:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de QR inválido.")

        if not resolved_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não foi possível determinar o usuário.")

        user = crud.get_user(db, resolved_user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
        if getattr(user, "status", None) != "Ativo" or getattr(user, "is_active", False) is False:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário desativado.")

        presence_date = payload.date or date.today()
        session = passes.register_presence(
            db,
            user_id=resolved_user_id,
            presence_date=presence_date,
            notes=payload.notes or "Presença via QR (kiosk)",
        )

        ticket = _next_ticket_number(db, presence_date)
        _log_scan(
            db,
            raw=raw,
            token_type=token_type,
            scanned_for=presence_date,
            ok=True,
            error=None,
            user_id=resolved_user_id,
            session_id=session.id,
            ticket_number=ticket,
        )

        return schemas.ScanKioskResponse(
            ticket_number=ticket,
            user_id=user.id,
            user_name=(user.social_name or user.full_name),
            session=session,
        )
    except HTTPException as exc:
        presence_date = payload.date or date.today()
        _log_scan(
            db,
            raw=raw,
            token_type=token_type,
            scanned_for=presence_date,
            ok=False,
            error=exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            user_id=resolved_user_id,
            session_id=None,
            ticket_number=None,
        )
        raise


@app.get("/reports/scan-logs", response_model=list[schemas.ScanLogView])
def list_scan_logs(date_ref: date | None = None, db: Session = Depends(get_db), _=Depends(require_roles(["admin"]))):
    _ensure_scanlog_table()
    q = db.query(models.ScanLog)
    if date_ref:
        q = q.filter(models.ScanLog.scanned_for == date_ref)
    logs = q.order_by(models.ScanLog.created_at.asc()).all()
    # Enrich with user_name
    user_ids = {l.user_id for l in logs if l.user_id}
    names: dict[int, str] = {}
    if user_ids:
        users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
        for u in users:
            names[u.id] = (u.social_name or u.full_name)
    result: list[dict] = []
    for l in logs:
        item = {
            "id": l.id,
            "created_at": l.created_at,
            "raw": l.raw,
            "token_type": l.token_type,
            "scanned_for": l.scanned_for,
            "ticket_number": l.ticket_number,
            "ok": l.ok,
            "error": l.error,
            "user_id": l.user_id,
            "session_id": l.session_id,
            "user_name": names.get(l.user_id or -1),
        }
        result.append(item)
    return result


@app.get("/reports/scan-logs/summary", response_model=schemas.ScanLogsSummary)
def scan_logs_summary(date_ref: date, db: Session = Depends(get_db), _=Depends(require_roles(["admin"]))):
    _ensure_scanlog_table()
    q = db.query(models.ScanLog).filter(models.ScanLog.scanned_for == date_ref)
    total = q.count()
    success = q.filter(models.ScanLog.ok == True).count()
    failure = total - success
    return schemas.ScanLogsSummary(
        date_ref=date_ref,
        total=total,
        success=success,
        failure=failure,
    )


@app.post("/admin/policies/enforce-absence-deactivation")
def enforce_absence_deactivation(months: int = 6, db: Session = Depends(get_db), _=Depends(require_roles(["admin"]))):
    """Apply the auto-deactivation policy now. Suggested to run via cron."""
    return enforce_auto_deactivation(db, months=months)


@app.get("/interviews/completed")
def interviews_completed(
    search: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_roles(["entrevista", "admin"]))
):
    # List users who have an ExamRecord, with next pass date from active cycle
    from sqlalchemy.orm import selectinload
    from sqlalchemy import func, or_
    q = (
        db.query(models.User)
        .options(selectinload(models.User.pass_cycles).selectinload(models.PassCycle.sessions))
        .join(models.ExamRecord, models.ExamRecord.user_id == models.User.id)
    )
    if search:
        s = f"%{search.lower()}%"
        q = q.filter(
            or_(
                func.lower(models.User.full_name).like(s),
                func.lower(func.coalesce(models.User.social_name, "")).like(s),
            )
        )
    users = q.all()
    items = []
    for u in users:
        active = None
        for c in u.pass_cycles:
            if c.status == schemas.PassCycleStatus.ATIVO.value:
                if active is None or (
                    c.started_at and active.started_at and c.started_at > active.started_at
                ):
                    active = c
        next_date = None
        pass_type = None
        if active:
            last_date = None
            for s in active.sessions:
                if last_date is None or s.scheduled_for > last_date:
                    last_date = s.scheduled_for
            if last_date is not None:
                next_date = passes.compute_next_assistance_date(u.assistance_day, last_date)
            else:
                next_date = active.started_at
            pass_type = active.pass_type
        items.append(
            {
                "id": u.id,
                "name": u.social_name or u.full_name,
                "next_pass_date": next_date,
                "pass_type": pass_type,
            }
        )
    return items


@app.get("/exams/queue", response_model=list[schemas.ExamQueueItem])
def exams_queue(db: Session = Depends(get_db), _=Depends(require_roles(["exame","admin"]))):
    # Latest concluded cycles that require interview and not yet completed
    from sqlalchemy.orm import joinedload
    q = (
        db.query(models.PassCycle)
        .options(joinedload(models.PassCycle.user))
        .filter(
            models.PassCycle.status == schemas.PassCycleStatus.CONCLUIDO.value,
            models.PassCycle.requires_interview == True,
            models.PassCycle.interview_completed_at.is_(None),
        )
        .order_by(models.PassCycle.completed_at.desc())
    )
    items: list[dict] = []
    for c in q.all():
        u = c.user
        items.append({
            "user_id": u.id,
            "name": (u.social_name or u.full_name),
            "cycle_id": c.id,
            "pass_type": c.pass_type,
            "scheduled_for": c.interview_scheduled_for,
        })
    return items


@app.put("/exams/{user_id}/schedule", response_model=schemas.PassCycle)
def exams_schedule(user_id: int, payload: schemas.ExamScheduleRequest, db: Session = Depends(get_db), _=Depends(require_roles(["exame","admin"]))):
    # Set interview_scheduled_for on the most recent concluded cycle requiring interview
    c = (
        db.query(models.PassCycle)
        .filter(
            models.PassCycle.user_id == user_id,
            models.PassCycle.status == schemas.PassCycleStatus.CONCLUIDO.value,
            models.PassCycle.requires_interview == True,
        )
        .order_by(models.PassCycle.completed_at.desc(), models.PassCycle.id.desc())
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Nenhum ciclo elegível para agendamento.")
    c.interview_scheduled_for = payload.date
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@app.post("/exams/{user_id}/complete", response_model=schemas.PassCycle)
def exams_complete(user_id: int, db: Session = Depends(get_db), _=Depends(require_roles(["exame","admin"]))):
    # Mark interview as completed now
    c = (
        db.query(models.PassCycle)
        .filter(
            models.PassCycle.user_id == user_id,
            models.PassCycle.status == schemas.PassCycleStatus.CONCLUIDO.value,
            models.PassCycle.requires_interview == True,
            models.PassCycle.interview_completed_at.is_(None),
        )
        .order_by(models.PassCycle.completed_at.desc(), models.PassCycle.id.desc())
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Nenhum ciclo pendente de entrevista.")
    from datetime import datetime, timezone
    c.interview_completed_at = datetime.now(timezone.utc)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@app.post(
    "/users/{user_id}/passes/absence",
    response_model=schemas.PassSession,
    status_code=status.HTTP_201_CREATED,
)
def register_pass_absence(
    user_id: int,
    payload: schemas.PassAbsenceRequest,
    db: Session = Depends(get_db),
):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    absence_date = payload.date or date.today()
    notes = payload.notes or "Ausência registrada manualmente"
    session = passes.register_absence(
        db,
        user_id=user_id,
        scheduled_date=absence_date,
        notes=notes,
    )
    return session
