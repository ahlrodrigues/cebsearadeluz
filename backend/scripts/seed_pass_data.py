from __future__ import annotations

from datetime import date, timedelta

from backend.app import crud, models, passes, schemas
from backend.app.database import Base, SessionLocal, engine


def _get_or_create_user(
    session,
    *,
    full_name: str,
    email: str,
    password: str = "SenhaSegura123!",
    assistance_day: schemas.AssistanceDay | None = None,
) -> models.User:
    existing = crud.get_user_by_email(session, email)
    if existing:
        return existing

    payload = schemas.UserCreate(
        full_name=full_name,
        email=email,
        password=password,
        status=schemas.UserStatus.ATIVO,
        role=schemas.UserRole.USER,
        assistance_day=assistance_day,
    )
    return crud.create_user(session, payload)




def _reset_pass_data(session, user_id: int) -> None:
    cycle_ids_subquery = (
        session.query(models.PassCycle.id).filter(models.PassCycle.user_id == user_id)
    )
    session.query(models.PassSession).filter(
        models.PassSession.cycle_id.in_(cycle_ids_subquery)
    ).delete(synchronize_session=False)
    session.query(models.PassCycle).filter(models.PassCycle.user_id == user_id).delete(
        synchronize_session=False
    )
    session.commit()

def seed_pass_demo() -> None:
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    try:
        user_ana = _get_or_create_user(
            session,
            full_name="Ana Presenças",
            email="ana.passes@example.com",
            assistance_day=schemas.AssistanceDay.SEGUNDA,
        )
        _reset_pass_data(session, user_ana.id)

        base_date = date(2025, 1, 6)
        passes.register_presence(session, user_id=user_ana.id, presence_date=base_date)
        passes.register_absence(
            session,
            user_id=user_ana.id,
            scheduled_date=base_date + timedelta(days=7),
            notes="Ausência registrada manualmente.",
        )
        passes.register_presence(
            session,
            user_id=user_ana.id,
            presence_date=base_date + timedelta(days=14),
        )
        passes.register_presence(
            session,
            user_id=user_ana.id,
            presence_date=base_date + timedelta(days=21),
        )
        passes.ensure_pending_absences(
            session,
            user_ana.id,
            reference_date=base_date + timedelta(days=30),
        )
        user_bruno = _get_or_create_user(
            session,
            full_name="Bruno Ciclos",
            email="bruno.passes@example.com",
            assistance_day=schemas.AssistanceDay.QUINTA,
        )
        _reset_pass_data(session, user_bruno.id)

        start_bruno = date(2025, 2, 6)
        for week in range(4):
            passes.register_presence(
                session,
                user_id=user_bruno.id,
                presence_date=start_bruno + timedelta(days=7 * week),
            )

        cycles_bruno = passes.list_cycles(session, user_bruno.id)
        concluded_cycle = next(
            (cycle for cycle in cycles_bruno if cycle.status == schemas.PassCycleStatus.CONCLUIDO.value),
            None,
        )
        if concluded_cycle:
            concluded_cycle.interview_scheduled_for = start_bruno + timedelta(days=35)
            session.add(concluded_cycle)
            session.commit()

        passes.register_presence(
            session,
            user_id=user_bruno.id,
            presence_date=start_bruno + timedelta(days=35),
        )
        user_clara = _get_or_create_user(
            session,
            full_name="Clara Sem Passes",
            email="clara.passes@example.com",
            assistance_day=schemas.AssistanceDay.TERCA,
        )
        _reset_pass_data(session, user_clara.id)

    finally:
        session.close()


if __name__ == "__main__":
    seed_pass_demo()
