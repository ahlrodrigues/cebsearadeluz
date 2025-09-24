from typing import Optional

from sqlalchemy.orm import Session

from . import models, schemas
from .security import get_password_hash


def get_user(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def get_users(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(models.User)
        .order_by(models.User.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    hashed_password = get_password_hash(user_in.password)
    db_user = models.User(
        full_name=user_in.full_name,
        email=user_in.email,
        hashed_password=hashed_password,
        is_active=user_in.is_active,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, db_user: models.User, user_in: schemas.UserUpdate) -> models.User:
    if user_in.full_name is not None:
        db_user.full_name = user_in.full_name
    if user_in.email is not None:
        db_user.email = user_in.email
    if user_in.is_active is not None:
        db_user.is_active = user_in.is_active
    if user_in.password is not None:
        db_user.hashed_password = get_password_hash(user_in.password)
    db.commit()
    db.refresh(db_user)
    return db_user


def delete_user(db: Session, db_user: models.User) -> None:
    db.delete(db_user)
    db.commit()
