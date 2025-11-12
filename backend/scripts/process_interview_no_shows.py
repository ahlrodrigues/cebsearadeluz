from __future__ import annotations

from datetime import date, timedelta
import os

from sqlalchemy.orm import Session

from backend.app.database import SessionLocal  # uses DATABASE_URL env
from backend.app import models, schemas, passes, crud
from backend.app.main import (
    _has_interview_log_for_date,
    _count_consecutive_interview_no_shows,
    INTERVIEW_NO_SHOW_LABEL,
    _ensure_scanlog_table,
    _log_scan,
)


def _process_user_for_date(db: Session, user_id: int, day: date) -> bool:
    c = (
        db.query(models.PassCycle)
        .filter(
            models.PassCycle.user_id == user_id,
            models.PassCycle.status == schemas.PassCycleStatus.CONCLUIDO.value,
            models.PassCycle.requires_interview == True,
            models.PassCycle.interview_completed_at.is_(None),
            models.PassCycle.completed_at <= day,
        )
        .order_by(models.PassCycle.completed_at.desc(), models.PassCycle.id.desc())
        .first()
    )
    if not c:
        return False
    if _has_interview_log_for_date(db, user_id, day):
        return False

    _ensure_scanlog_table()
    _log_scan(
        db,
        raw=None,
        token_type="interview",
        scanned_for=day,
        ok=False,
        error=INTERVIEW_NO_SHOW_LABEL,
        user_id=user_id,
        session_id=None,
        ticket_number=None,
    )

    streak = _count_consecutive_interview_no_shows(db, user_id)
    if streak >= 2:
        from datetime import datetime, timezone

        c.interview_completed_at = datetime.now(timezone.utc)
        db.add(c)
        db.commit()
        db.refresh(c)

        active = passes.get_active_cycle(db, user_id)
        if not active:
            exam = crud.get_exam_record(db, user_id)
            desired_pass: str | None = None
            if exam and getattr(exam, "next_pass_type", None):
                desired_pass = exam.next_pass_type
            if not desired_pass:
                desired_pass = schemas.PassType.P2.value
            user = crud.get_user(db, user_id)
            start_from = day
            next_start = passes.compute_next_assistance_date(
                getattr(user, "assistance_day", None), start_from
            ) or (start_from + timedelta(days=7))
            passes.create_pass_cycle(
                db,
                user_id=user_id,
                stage_number=1,
                pass_type=desired_pass,
                start_date=next_start,
                assistance_day=getattr(user, "assistance_day", None),
            )
            db.commit()
    return True


def process_for_date(target: date) -> int:
    db: Session = SessionLocal()
    try:
        # users with presence on day
        user_ids = (
            db.query(models.PassCycle.user_id)
            .join(models.PassSession, models.PassSession.cycle_id == models.PassCycle.id)
            .filter(
                models.PassSession.scheduled_for == target,
                models.PassSession.status == schemas.PassSessionStatus.PRESENTE.value,
            )
            .distinct()
            .all()
        )
        processed = 0
        for (uid,) in user_ids:
            try:
                if _process_user_for_date(db, uid, target):
                    processed += 1
            except Exception:
                continue
        return processed
    finally:
        db.close()


def main() -> None:
    ref = os.environ.get("DATE_REF")
    if ref:
        y, m, d = map(int, ref.split("-"))
        target = date(y, m, d)
    else:
        target = date.today()
    count = process_for_date(target)
    print(f"[process_interview_no_shows] date_ref={target} processed={count}")


if __name__ == "__main__":
    main()

