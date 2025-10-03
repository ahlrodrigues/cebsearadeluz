from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models


def _last_presence_date_for_user(db: Session, user_id: int) -> Optional[date]:
    last_date = (
        db.query(func.max(models.PassSession.scheduled_for))
        .join(models.PassCycle, models.PassCycle.id == models.PassSession.cycle_id)
        .filter(
            models.PassCycle.user_id == user_id,
            models.PassSession.status == "Presente",
        )
        .scalar()
    )
    return last_date


def enforce_auto_deactivation(db: Session, *, months: int = 6) -> dict:
    """Deactivate users with no presence within the given months.

    Policy: If a user is "Ativo" but hasn't recorded a presence in the
    last N months, set status to "Desativado" and is_active to False.
    Users who never attended (no presence) are ignored by this policy.
    """
    today = date.today()
    threshold = today - timedelta(days=months * 30)

    # Get all active users
    active_users = db.query(models.User).filter(models.User.status == "Ativo").all()

    deactivated = 0
    evaluated = 0
    for u in active_users:
        evaluated += 1
        last_presence = _last_presence_date_for_user(db, u.id)
        if last_presence is None:
            # ignore users with no presence yet
            continue
        if last_presence < threshold:
            u.status = "Desativado"
            u.is_active = False
            db.add(u)
            deactivated += 1

    if deactivated:
        db.commit()

    return {
        "evaluated": evaluated,
        "deactivated": deactivated,
        "months": months,
        "threshold": str(threshold),
    }

