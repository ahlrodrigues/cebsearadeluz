from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from . import models, schemas

PASS_SEQUENCE_LENGTH = 4


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_active_cycle(db: Session, user_id: int) -> Optional[models.PassCycle]:
    return (
        db.query(models.PassCycle)
        .options(selectinload(models.PassCycle.sessions))
        .filter(
            models.PassCycle.user_id == user_id,
            models.PassCycle.status == schemas.PassCycleStatus.ATIVO.value,
        )
        .order_by(models.PassCycle.started_at.desc(), models.PassCycle.id.desc())
        .first()
    )


def list_cycles(db: Session, user_id: int) -> list[models.PassCycle]:
    return (
        db.query(models.PassCycle)
        .options(selectinload(models.PassCycle.sessions))
        .filter(models.PassCycle.user_id == user_id)
        .order_by(models.PassCycle.started_at.desc(), models.PassCycle.id.desc())
        .all()
    )


def create_pass_cycle(
    db: Session,
    *,
    user_id: int,
    stage_number: int = 1,
    pass_type: Optional[str] = None,
    start_date: Optional[date] = None,
) -> models.PassCycle:
    cycle = models.PassCycle(
        user_id=user_id,
        stage_number=stage_number,
        pass_type=pass_type or _pass_type_label(stage_number),
        sequence_length=PASS_SEQUENCE_LENGTH,
        started_at=start_date or date.today(),
        status=schemas.PassCycleStatus.ATIVO.value,
    )
    db.add(cycle)
    db.flush()
    db.refresh(cycle)
    return cycle


def _pass_type_label(stage_number: int) -> str:
    return f"Passe {stage_number}"


def _finalize_cycle(
    db: Session,
    cycle: models.PassCycle,
    *,
    completed_at: date,
    requires_interview: bool = True,
) -> None:
    cycle.status = schemas.PassCycleStatus.CONCLUIDO.value
    cycle.completed_at = completed_at
    cycle.requires_interview = requires_interview
    cycle.updated_at = _utcnow()
    db.add(cycle)


def _interrupt_cycle(db: Session, cycle: models.PassCycle, *, interrupted_at: date) -> None:
    cycle.status = schemas.PassCycleStatus.INTERROMPIDO.value
    cycle.interrupted_at = interrupted_at
    cycle.updated_at = _utcnow()
    db.add(cycle)


def _next_sequence_index(db: Session, cycle_id: int) -> int:
    last_index = (
        db.query(func.max(models.PassSession.sequence_index))
        .filter(models.PassSession.cycle_id == cycle_id)
        .scalar()
    )
    return (last_index or 0) + 1


def _count_consecutive_absences(db: Session, cycle_id: int) -> int:
    sessions = (
        db.query(models.PassSession)
        .filter(models.PassSession.cycle_id == cycle_id)
        .order_by(models.PassSession.sequence_index.desc())
        .all()
    )
    count = 0
    for session in sessions:
        if session.status == schemas.PassSessionStatus.FALTA.value:
            count += 1
        elif session.status == schemas.PassSessionStatus.PRESENTE.value:
            break
        else:
            break
    return count


def register_presence(
    db: Session,
    *,
    user_id: int,
    presence_date: date,
    notes: Optional[str] = None,
) -> models.PassSession:
    cycle = get_active_cycle(db, user_id)

    if cycle is None:
        cycle = create_pass_cycle(
            db,
            user_id=user_id,
            stage_number=1,
            start_date=presence_date,
        )

    last_presence: Optional[models.PassSession] = (
        db.query(models.PassSession)
        .filter(
            models.PassSession.cycle_id == cycle.id,
            models.PassSession.status == schemas.PassSessionStatus.PRESENTE.value,
        )
        .order_by(models.PassSession.sequence_index.desc())
        .first()
    )

    consecutive_absences = _count_consecutive_absences(db, cycle.id)

    if consecutive_absences > 1:
        _interrupt_cycle(db, cycle, interrupted_at=presence_date)
        db.flush()
        cycle = create_pass_cycle(
            db,
            user_id=user_id,
            stage_number=cycle.stage_number,
            pass_type=cycle.pass_type,
            start_date=presence_date,
        )
        consecutive_absences = 0

    session = models.PassSession(
        cycle_id=cycle.id,
        sequence_index=_next_sequence_index(db, cycle.id),
        scheduled_for=presence_date,
        status=schemas.PassSessionStatus.PRESENTE.value,
        presence_recorded_at=_utcnow(),
        notes=notes,
    )
    db.add(session)

    db.flush()

    total_presences = (
        db.query(func.count(models.PassSession.id))
        .filter(
            models.PassSession.cycle_id == cycle.id,
            models.PassSession.status == schemas.PassSessionStatus.PRESENTE.value,
        )
        .scalar()
    )

    if total_presences >= cycle.sequence_length:
        _finalize_cycle(db, cycle, completed_at=presence_date)
        db.flush()
        create_pass_cycle(
            db,
            user_id=user_id,
            stage_number=cycle.stage_number + 1,
            start_date=presence_date + timedelta(days=7),
        )

    db.commit()
    db.refresh(session)
    return session


def register_absence(
    db: Session,
    *,
    user_id: int,
    scheduled_date: date,
    notes: Optional[str] = None,
) -> models.PassSession:
    cycle = get_active_cycle(db, user_id)

    if cycle is None:
        cycle = create_pass_cycle(
            db,
            user_id=user_id,
            stage_number=1,
            start_date=scheduled_date,
        )

    session = models.PassSession(
        cycle_id=cycle.id,
        sequence_index=_next_sequence_index(db, cycle.id),
        scheduled_for=scheduled_date,
        status=schemas.PassSessionStatus.FALTA.value,
        notes=notes,
    )
    db.add(session)

    db.flush()

    consecutive_absences = _count_consecutive_absences(db, cycle.id)

    if consecutive_absences > 1:
        _interrupt_cycle(db, cycle, interrupted_at=scheduled_date)
        db.flush()
        create_pass_cycle(
            db,
            user_id=user_id,
            stage_number=cycle.stage_number,
            pass_type=cycle.pass_type,
            start_date=scheduled_date,
        )

    db.commit()
    db.refresh(session)
    return session
