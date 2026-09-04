from collections.abc import Iterable
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from . import models, passes, schemas
from .security import get_password_hash


def _is_age_60_or_more(birth_date: Optional[date]) -> bool:
    if not birth_date:
        return False
    today = date.today()
    try:
        age = today.year - birth_date.year - (
            (today.month, today.day) < (birth_date.month, birth_date.day)
        )
        return age >= 60
    except Exception:
        return False


def _annotate_active_cycle_summary(user: models.User) -> models.User:
    active_cycles: Iterable[models.PassCycle] = (
        cycle for cycle in getattr(user, "pass_cycles", []) if cycle.status == "Ativo"
    )
    active_cycle = None
    latest_started_at = None
    for cycle in active_cycles:
        if latest_started_at is None or (
            cycle.started_at and cycle.started_at >= latest_started_at
        ):
            latest_started_at = cycle.started_at
            active_cycle = cycle

    if not active_cycle:
        user.has_active_cycle = False
        user.active_cycle_pass_type = None
        user.active_cycle_stage_number = None
        user.active_cycle_sequence_length = None
        user.active_cycle_presence_count = None
        user.active_cycle_absence_count = None
        user.active_cycle_next_session = None
        user.active_cycle_requires_interview = None
        user.active_cycle_interview_scheduled_for = None
        user.active_cycle_last_presence_recorded_at = None
        return user

    sessions = list(getattr(active_cycle, "sessions", []))
    presence_count = sum(
        1
        for session in sessions
        if session.status == schemas.PassSessionStatus.PRESENTE.value
    )
    absence_count = sum(
        1
        for session in sessions
        if session.status == schemas.PassSessionStatus.AUSENTE.value
    )
    last_presence = None
    last_session_date = None
    for session in sessions:
        if session.presence_recorded_at and (
            last_presence is None or session.presence_recorded_at > last_presence
        ):
            last_presence = session.presence_recorded_at
        if last_session_date is None or session.scheduled_for > last_session_date:
            last_session_date = session.scheduled_for

    assistance_day = getattr(user, "assistance_day", None)
    if last_session_date is not None:
        next_session_date = passes.compute_next_assistance_date(
            assistance_day, last_session_date
        )
    else:
        if assistance_day:
            if active_cycle.started_at >= date.today():
                next_session_date = active_cycle.started_at
            else:
                next_session_date = passes.compute_next_assistance_date(
                    assistance_day, active_cycle.started_at
                )
        else:
            next_session_date = None

    user.has_active_cycle = True
    user.active_cycle_pass_type = active_cycle.pass_type
    user.active_cycle_stage_number = active_cycle.stage_number
    user.active_cycle_sequence_length = active_cycle.sequence_length
    user.active_cycle_presence_count = presence_count
    user.active_cycle_absence_count = absence_count
    user.active_cycle_next_session = next_session_date
    user.active_cycle_requires_interview = active_cycle.requires_interview
    user.active_cycle_interview_scheduled_for = active_cycle.interview_scheduled_for
    user.active_cycle_last_presence_recorded_at = last_presence
    return user


def get_user(db: Session, user_id: int) -> Optional[models.User]:
    user = (
        db.query(models.User)
        .options(selectinload(models.User.pass_cycles).selectinload(models.PassCycle.sessions))
        .filter(models.User.id == user_id)
        .first()
    )
    if user:
        _annotate_active_cycle_summary(user)
    return user


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def get_users(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    *,
    search: Optional[str] = None,
    status: Optional[str] = None,
    role: Optional[str] = None,
    assistance_day: Optional[str] = None,
):
    query = db.query(models.User).options(
        selectinload(models.User.pass_cycles).selectinload(models.PassCycle.sessions)
    )

    if search:
        normalized = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(models.User.full_name).like(normalized),
                func.lower(func.coalesce(models.User.social_name, "")).like(normalized),
            )
        )
    if status:
        query = query.filter(models.User.status == status)
    if role:
        query = query.filter(models.User.role == role)
    if assistance_day:
        query = query.filter(models.User.assistance_day == assistance_day)

    users = (
        query.order_by(models.User.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    for user in users:
        _annotate_active_cycle_summary(user)
    return users


def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    hashed_password = get_password_hash(user_in.password)
    preferential = bool(getattr(user_in, "preferential", False))
    if _is_age_60_or_more(getattr(user_in, "birth_date", None)):
        preferential = True
    db_user = models.User(
        full_name=user_in.full_name,
        social_name=user_in.social_name,
        birth_date=user_in.birth_date,
        cep=user_in.cep,
        street=user_in.street,
        number=user_in.number,
        complement=user_in.complement,
        neighborhood=user_in.neighborhood,
        city=user_in.city,
        state=user_in.state,
        phone=user_in.phone,
        email=user_in.email,
        social_network=user_in.social_network,
        status=user_in.status.value,
        role=user_in.role.value,
        extra_roles=",".join(r.value for r in getattr(user_in, "extra_roles", []) or []),
        preferential=preferential,
        hashed_password=hashed_password,
        is_active=user_in.status == schemas.UserStatus.ATIVO,
        digital_login_enabled=bool(getattr(user_in, 'digital_login_enabled', True)),
        assistance_day=user_in.assistance_day.value if user_in.assistance_day else None,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    _annotate_active_cycle_summary(db_user)
    return db_user


def update_user(db: Session, db_user: models.User, user_in: schemas.UserUpdate) -> models.User:
    if user_in.full_name is not None:
        db_user.full_name = user_in.full_name
    if "social_name" in user_in.model_fields_set:
        db_user.social_name = user_in.social_name
    if user_in.birth_date is not None:
        db_user.birth_date = user_in.birth_date
    if user_in.cep is not None:
        db_user.cep = user_in.cep
    if user_in.street is not None:
        db_user.street = user_in.street
    if user_in.number is not None:
        db_user.number = user_in.number
    if user_in.complement is not None:
        db_user.complement = user_in.complement
    if user_in.neighborhood is not None:
        db_user.neighborhood = user_in.neighborhood
    if user_in.city is not None:
        db_user.city = user_in.city
    if user_in.state is not None:
        db_user.state = user_in.state
    if user_in.phone is not None:
        db_user.phone = user_in.phone
    if user_in.email is not None:
        db_user.email = user_in.email
    if user_in.social_network is not None:
        db_user.social_network = user_in.social_network
    if user_in.status is not None:
        db_user.status = user_in.status.value
        db_user.is_active = user_in.status == schemas.UserStatus.ATIVO
    if user_in.role is not None:
        db_user.role = user_in.role.value
    if "extra_roles" in user_in.model_fields_set and user_in.extra_roles is not None:
        db_user.extra_roles = ",".join(r.value for r in (user_in.extra_roles or []))
    if 'digital_login_enabled' in user_in.model_fields_set and user_in.digital_login_enabled is not None:
        db_user.digital_login_enabled = bool(user_in.digital_login_enabled)
    if 'assistance_day' in user_in.model_fields_set:
        db_user.assistance_day = (
            user_in.assistance_day.value if user_in.assistance_day else None
        )
    if 'preferential' in user_in.model_fields_set and user_in.preferential is not None:
        db_user.preferential = bool(user_in.preferential)
    if _is_age_60_or_more(getattr(db_user, "birth_date", None)):
        db_user.preferential = True
    if user_in.password is not None:
        db_user.hashed_password = get_password_hash(user_in.password)
    db.commit()
    db.refresh(db_user)
    _annotate_active_cycle_summary(db_user)
    return db_user


def delete_user(db: Session, db_user: models.User) -> None:
    db.delete(db_user)
    db.commit()


def get_exam_record(db: Session, user_id: int) -> Optional[models.ExamRecord]:
    return (
        db.query(models.ExamRecord)
        .filter(models.ExamRecord.user_id == user_id)
        .first()
    )


def _complete_pending_interview(db: Session, user_id: int, exam: models.ExamRecord) -> None:
    """Close the pass cycle waiting for interview and start the next one.

    The exam ficha is the only place staff mark an interview as done (there's
    no separate "close interview" action), so saving it with completed=True
    is what should advance the assistido to the next pass stage. Idempotent:
    once a cycle's interview_completed_at is set, this query no longer
    matches it, so re-saving an already-completed ficha is a no-op.
    """
    if not getattr(exam, "completed", False):
        return

    cycle = (
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
    if cycle is None:
        return

    cycle.interview_completed_at = passes._utcnow()
    db.add(cycle)
    db.commit()
    db.refresh(cycle)

    if passes.get_active_cycle(db, user_id) is not None:
        return

    next_stage = cycle.stage_number + 1
    if next_stage > len(passes.PASS_TYPE_SEQUENCE):
        return

    user = db.query(models.User).filter(models.User.id == user_id).first()
    assistance_day = getattr(user, "assistance_day", None)
    today = date.today()
    next_start = passes.compute_next_assistance_date(assistance_day, today) or (
        today + timedelta(days=7)
    )
    passes.create_pass_cycle(
        db,
        user_id=user_id,
        stage_number=next_stage,
        pass_type=exam.next_pass_type,
        start_date=next_start,
        assistance_day=assistance_day,
    )
    db.commit()


def create_exam_record(
    db: Session, user_id: int, exam_in: schemas.ExamRecordCreate
) -> models.ExamRecord:
    exam = models.ExamRecord(
        user_id=user_id,
        completed=bool(getattr(exam_in, "completed", False)),
        answers=exam_in.answers,
        observations=exam_in.observations,
        recommendations=list(exam_in.recommendations),
        next_pass_type=exam_in.next_pass_type.value if exam_in.next_pass_type else None,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    _complete_pending_interview(db, user_id, exam)
    return exam


def update_exam_record(
    db: Session,
    exam_record: models.ExamRecord,
    exam_in: schemas.ExamRecordUpdate,
) -> models.ExamRecord:
    if exam_in.completed is not None:
        exam_record.completed = bool(exam_in.completed)
    if exam_in.answers is not None:
        exam_record.answers = exam_in.answers
    if exam_in.observations is not None:
        exam_record.observations = exam_in.observations
    if exam_in.recommendations is not None:
        exam_record.recommendations = list(exam_in.recommendations)
    if exam_in.next_pass_type is not None:
        exam_record.next_pass_type = exam_in.next_pass_type.value if exam_in.next_pass_type else None
    db.commit()
    db.refresh(exam_record)
    _complete_pending_interview(db, exam_record.user_id, exam_record)
    return exam_record
