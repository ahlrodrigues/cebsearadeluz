from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    social_name = Column(String(255), nullable=True)
    birth_date = Column(Date, nullable=True)
    cep = Column(String(9), nullable=True)
    street = Column(String(255), nullable=True)
    number = Column(String(20), nullable=True)
    complement = Column(String(255), nullable=True)
    neighborhood = Column(String(255), nullable=True)
    city = Column(String(255), nullable=True)
    state = Column(String(2), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    social_network = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="Ativo")
    role = Column(String(20), nullable=False, default="user", index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
