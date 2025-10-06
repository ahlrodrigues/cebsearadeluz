"""
Seed demo data for authentication and exam flows.

Creates:
- Admin user (email: admin@example.com)
- Recepção user (email: recepcao@example.com)
- Entrevista user (email: entrevista@example.com)
- Exame user (email: exame@example.com)
- Assistido user (email: assistido@example.com) with an ExamRecord

Default password for all: Demo@1234

Run:
  DATABASE_URL=sqlite:///./app.db python -m backend.scripts.seed_demo_auth
"""
from __future__ import annotations

from backend.app.database import SessionLocal
from backend.app import models, schemas
from backend.app.security import get_password_hash


def get_or_create_user(db, *, email: str, full_name: str, role: str, status: str = "Ativo", password: str = "Demo@1234") -> models.User:
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        return user
    user = models.User(
        full_name=full_name,
        email=email,
        role=role,
        status=status,
        is_active=(status == "Ativo"),
        hashed_password=get_password_hash(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_exam(db, *, user_id: int) -> models.ExamRecord:
    rec = db.query(models.ExamRecord).filter(models.ExamRecord.user_id == user_id).first()
    if rec:
        return rec
    rec = models.ExamRecord(
        user_id=user_id,
        answers="Respostas iniciais",
        observations="Observações seed",
        recommendations=["evangelho_no_lar", "preces"],
        next_pass_type="P2",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


def main() -> None:
    with SessionLocal() as db:
        print("Seeding demo users (password: Demo@1234)...")
        admin = get_or_create_user(db, email="admin@example.com", full_name="Admin", role=schemas.UserRole.ADMIN.value)
        recep = get_or_create_user(db, email="recepcao@example.com", full_name="Recepção", role=schemas.UserRole.RECEPCAO.value)
        entre = get_or_create_user(db, email="entrevista@example.com", full_name="Entrevista", role=schemas.UserRole.ENTREVISTA.value)
        exame = get_or_create_user(db, email="exame@example.com", full_name="Exame", role=schemas.UserRole.EXAME.value)
        assist = get_or_create_user(db, email="assistido@example.com", full_name="Assistido Exame", role=schemas.UserRole.USER.value)

        exam = get_or_create_exam(db, user_id=assist.id)

        print("Users:")
        print(f"  Admin       : {admin.email}")
        print(f"  Recepção    : {recep.email}")
        print(f"  Entrevista  : {entre.email}")
        print(f"  Exame       : {exame.email}")
        print(f"  Assistido   : {assist.email} (exam_id={exam.id})")
        print("Password for all: Demo@1234")


if __name__ == "__main__":
    main()

