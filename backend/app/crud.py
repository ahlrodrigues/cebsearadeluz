from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from . import models, schemas
from .security import get_password_hash


def get_user(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


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
):
    query = db.query(models.User)

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

    return (
        query.order_by(models.User.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    hashed_password = get_password_hash(user_in.password)
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
        hashed_password=hashed_password,
        is_active=user_in.status == schemas.UserStatus.ATIVO,
        assistance_day=user_in.assistance_day.value if user_in.assistance_day else None,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
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
    if 'assistance_day' in user_in.model_fields_set:
        db_user.assistance_day = (
            user_in.assistance_day.value if user_in.assistance_day else None
        )
    if user_in.password is not None:
        db_user.hashed_password = get_password_hash(user_in.password)
    db.commit()
    db.refresh(db_user)
    return db_user


def delete_user(db: Session, db_user: models.User) -> None:
    db.delete(db_user)
    db.commit()
