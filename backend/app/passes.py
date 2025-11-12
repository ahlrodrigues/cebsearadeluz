
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from . import models, schemas

PASS_SEQUENCE_LENGTH = 4
PASS_TYPE_SEQUENCE = [
    schemas.PassType.P1.value,
    schemas.PassType.P2.value,
    schemas.PassType.P3A.value,
    schemas.PassType.P3B.value,
    schemas.PassType.CH.value,
    schemas.PassType.P4A.value,
    schemas.PassType.P4B.value,
]
ASSISTANCE_DAY_TO_WEEKDAY = {
    schemas.AssistanceDay.SEGUNDA.value: 0,
    schemas.AssistanceDay.TERCA.value: 1,
    schemas.AssistanceDay.QUARTA.value: 2,
    schemas.AssistanceDay.QUINTA.value: 3,
    schemas.AssistanceDay.SEXTA.value: 4,
    schemas.AssistanceDay.SABADO.value: 5,
    schemas.AssistanceDay.DOMINGO.value: 6,
}
AUTO_ABSENCE_NOTE = "Ausência registrada automaticamente."
AUTO_PRESENCE_NOTE = "Presença registrada automaticamente"
RESTART_CYCLE_NOTE = "Reiniciando ciclo de passes"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _pass_type_label(stage_number: int) -> str:
    index = max(0, min(stage_number - 1, len(PASS_TYPE_SEQUENCE) - 1))
    return PASS_TYPE_SEQUENCE[index]


def _weekday_from_assistance_day(assistance_day: Optional[str]) -> Optional[int]:
    if assistance_day is None:
        return None
    return ASSISTANCE_DAY_TO_WEEKDAY.get(assistance_day)


def _align_to_assistance_day(assistance_day: Optional[str], start_date: date) -> date:
    weekday = _weekday_from_assistance_day(assistance_day)
    if weekday is None:
        return start_date
    offset = (weekday - start_date.weekday()) % 7
    return start_date + timedelta(days=offset)


def _next_assistance_date(assistance_day: Optional[str], from_date: date) -> Optional[date]:
    weekday = _weekday_from_assistance_day(assistance_day)
    if weekday is None:
        return None
    days_ahead = (weekday - from_date.weekday() + 7) % 7
    if days_ahead == 0:
        days_ahead = 7
    return from_date + timedelta(days=days_ahead)

def compute_next_assistance_date(assistance_day: Optional[str], from_date: date) -> Optional[date]:
    return _next_assistance_date(assistance_day, from_date)

def compute_previous_assistance_date(assistance_day: Optional[str], reference_date: date) -> Optional[date]:
    weekday = _weekday_from_assistance_day(assistance_day)
    if weekday is None:
        return None
    days_back = (reference_date.weekday() - weekday) % 7
    return reference_date - timedelta(days=days_back)




def _query_active_cycle(db: Session, user_id: int) -> Optional[models.PassCycle]:
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


def _find_session_by_date(cycle: models.PassCycle, scheduled_for: date) -> Optional[models.PassSession]:
    for item in cycle.sessions:
        if item.scheduled_for == scheduled_for:
            return item
    return None


def _create_absence_session(
    db: Session,
    cycle: models.PassCycle,
    *,
    scheduled_for: date,
    notes: Optional[str] = None,
    commit: bool = True,
) -> models.PassSession:
    session = models.PassSession(
        cycle_id=cycle.id,
        sequence_index=_next_sequence_index(db, cycle.id),
        scheduled_for=scheduled_for,
        status=schemas.PassSessionStatus.AUSENTE.value,
        notes=notes,
    )
    db.add(session)
    if commit:
        db.commit()
        db.refresh(session)
    else:
        db.flush()
    return session


def _register_pending_absences(db: Session, user_id: int, reference_date: Optional[date] = None) -> None:
    reference = reference_date or date.today()
    check_until = reference - timedelta(days=1)
    if check_until < date.min:
        return

    user = (
        db.query(models.User)
        .options(selectinload(models.User.pass_cycles).selectinload(models.PassCycle.sessions))
        .filter(models.User.id == user_id)
        .first()
    )
    if not user or not user.assistance_day:
        return

    active_cycle = next(
        (
            cycle
            for cycle in user.pass_cycles
            if cycle.status == schemas.PassCycleStatus.ATIVO.value
        ),
        None,
    )
    if not active_cycle:
        return

    last_expected = compute_previous_assistance_date(user.assistance_day, check_until)
    if last_expected is None or last_expected < active_cycle.started_at:
        return

    recorded_dates = {session.scheduled_for for session in active_cycle.sessions}
    if last_expected in recorded_dates:
        return

    _create_absence_session(
        db,
        active_cycle,
        scheduled_for=last_expected,
        notes=AUTO_ABSENCE_NOTE,
        commit=False,
    )
    db.commit()
    db.refresh(active_cycle)



def ensure_pending_absences(db: Session, user_id: int, reference_date: Optional[date] = None) -> None:
    _register_pending_absences(db, user_id, reference_date)
def get_active_cycle(db: Session, user_id: int) -> Optional[models.PassCycle]:
    _register_pending_absences(db, user_id)
    return _query_active_cycle(db, user_id)


def list_cycles(db: Session, user_id: int) -> list[models.PassCycle]:
    _register_pending_absences(db, user_id)
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
    assistance_day: Optional[str] = None,
) -> models.PassCycle:
    start = start_date or date.today()
    aligned_start = _align_to_assistance_day(assistance_day, start)
    cycle = models.PassCycle(
        user_id=user_id,
        stage_number=stage_number,
        pass_type=pass_type or _pass_type_label(stage_number),
        sequence_length=PASS_SEQUENCE_LENGTH,
        started_at=aligned_start,
        status=schemas.PassCycleStatus.ATIVO.value,
    )
    db.add(cycle)
    db.flush()
    db.refresh(cycle)
    return cycle


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
        if session.status == schemas.PassSessionStatus.AUSENTE.value:
            count += 1
        elif session.status == schemas.PassSessionStatus.PRESENTE.value:
            break
        else:
            break
    return count


def _count_total_absences(db: Session, cycle_id: int) -> int:
    return (
        db.query(func.count(models.PassSession.id))
        .filter(
            models.PassSession.cycle_id == cycle_id,
            models.PassSession.status == schemas.PassSessionStatus.AUSENTE.value,
        )
        .scalar()
        or 0
    )


def register_presence(
    db: Session,
    *,
    user_id: int,
    presence_date: date,
    notes: Optional[str] = None,
) -> models.PassSession:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    assistance_day = user.assistance_day if user else None

    # Reativação automática no primeiro registro de presença
    if user and (getattr(user, "status", None) != "Ativo" or getattr(user, "is_active", False) is False):
        user.status = "Ativo"
        user.is_active = True
        db.add(user)
        db.flush()

    cycle = _query_active_cycle(db, user_id)

    if cycle is None:
        # Sem ciclo ativo: decidir como iniciar na PRIMEIRA presença
        # 1) Se houver exame concluído com indicação de próximo passe, usa-o
        desired_pass: Optional[str] = None
        try:
            # Verifica se existe ciclo concluído com entrevista completada
            concluded = (
                db.query(models.PassCycle)
                .filter(
                    models.PassCycle.user_id == user_id,
                    models.PassCycle.status == schemas.PassCycleStatus.CONCLUIDO.value,
                    models.PassCycle.requires_interview == True,
                    models.PassCycle.interview_completed_at.isnot(None),
                )
                .order_by(models.PassCycle.completed_at.desc(), models.PassCycle.id.desc())
                .first()
            )
            if concluded is not None:
                exam = db.query(models.ExamRecord).filter(models.ExamRecord.user_id == user_id).first()
                if exam and getattr(exam, "next_pass_type", None):
                    desired_pass = exam.next_pass_type
        except Exception:
            desired_pass = None

        stage_number = 1
        pass_type = None
        if desired_pass:
            pass_type = desired_pass
        else:
            # 2) Sem indicação de exame: regra de 60 dias
            last_presence_date = _get_last_presence_date(db, user_id)
            if last_presence_date is None:
                pass_type = schemas.PassType.P2.value
            else:
                try:
                    delta_days = (presence_date - last_presence_date).days
                except Exception:
                    delta_days = 999999
                if delta_days >= 60:
                    pass_type = schemas.PassType.P2.value
                else:
                    latest = _get_latest_cycle(db, user_id)
                    if latest is not None:
                        stage_number = latest.stage_number
                        pass_type = latest.pass_type
        if not pass_type:
            pass_type = schemas.PassType.P2.value
        cycle = create_pass_cycle(
            db,
            user_id=user_id,
            stage_number=stage_number,
            pass_type=pass_type,
            start_date=presence_date,
            assistance_day=assistance_day,
        )

    # Regra de 60 dias: se a última presença for há 60 dias ou mais, reinicia ciclo com P2
    presence_note = notes
    last_presence_date_for_user = _get_last_presence_date(db, user_id)
    if last_presence_date_for_user is not None:
        try:
            gap_days = (presence_date - last_presence_date_for_user).days
        except Exception:
            gap_days = 0
        if gap_days >= 60:
            _interrupt_cycle(db, cycle, interrupted_at=presence_date)
            db.flush()
            cycle = create_pass_cycle(
                db,
                user_id=user_id,
                stage_number=1,
                pass_type=schemas.PassType.P2.value,
                start_date=presence_date,
                assistance_day=assistance_day,
            )
            presence_note = RESTART_CYCLE_NOTE

    # regra de reinício por ausências: 2 ausências no ciclo (independente de serem consecutivas)
    total_absences = _count_total_absences(db, cycle.id)
    if total_absences >= 2:
        _interrupt_cycle(db, cycle, interrupted_at=presence_date)
        db.flush()
        cycle = create_pass_cycle(
            db,
            user_id=user_id,
            stage_number=cycle.stage_number,
            pass_type=cycle.pass_type,
            start_date=presence_date,
            assistance_day=assistance_day,
        )
        # Anota nas observações da primeira presença do novo ciclo
        presence_note = RESTART_CYCLE_NOTE

    session = models.PassSession(
        cycle_id=cycle.id,
        sequence_index=_next_sequence_index(db, cycle.id),
        scheduled_for=presence_date,
        status=schemas.PassSessionStatus.PRESENTE.value,
        presence_recorded_at=_utcnow(),
        notes=presence_note,
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
        # Fechou ciclo: marcar para exame (requires_interview=True) e NÃO criar próximo ciclo aqui.
        _finalize_cycle(db, cycle, completed_at=presence_date, requires_interview=True)
        db.flush()

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
    user = db.query(models.User).filter(models.User.id == user_id).first()
    assistance_day = user.assistance_day if user else None

    cycle = _query_active_cycle(db, user_id)

    if cycle is None:
        cycle = create_pass_cycle(
            db,
            user_id=user_id,
            stage_number=1,
            start_date=scheduled_date,
            assistance_day=assistance_day,
        )

    existing = _find_session_by_date(cycle, scheduled_date)
    if existing:
        session_record = existing
    else:
        session_record = _create_absence_session(
        db,
        cycle,
        scheduled_for=scheduled_date,
        notes=notes or AUTO_ABSENCE_NOTE,
    )

    # Regra: 2 ausências no ciclo → interrompe o ciclo, sem criar novo ciclo agora.
    total_absences = _count_total_absences(db, cycle.id)
    if total_absences >= 2:
        _interrupt_cycle(db, cycle, interrupted_at=scheduled_date)
        db.commit()
        return session_record

    db.commit()
    return session_record

def _get_last_presence_date(db: Session, user_id: int) -> Optional[date]:
    """Retorna a última data (scheduled_for) de presença registrada para o usuário."""
    from sqlalchemy import func
    last_date = (
        db.query(func.max(models.PassSession.scheduled_for))
        .join(models.PassCycle, models.PassCycle.id == models.PassSession.cycle_id)
        .filter(
            models.PassCycle.user_id == user_id,
            models.PassSession.status == schemas.PassSessionStatus.PRESENTE.value,
        )
        .scalar()
    )
    return last_date

def _get_latest_cycle(db: Session, user_id: int) -> Optional[models.PassCycle]:
    return (
        db.query(models.PassCycle)
        .filter(models.PassCycle.user_id == user_id)
        .order_by(models.PassCycle.started_at.desc(), models.PassCycle.id.desc())
        .first()
    )
