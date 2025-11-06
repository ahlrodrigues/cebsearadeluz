from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

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
    assistance_day = Column(String(15), nullable=True)
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

    pass_cycles = relationship(
        "PassCycle",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    exam_record = relationship(
        "ExamRecord",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )


class PassCycle(Base):
    __tablename__ = "pass_cycles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stage_number = Column(Integer, nullable=False, default=1)
    pass_type = Column(String(5), nullable=False, default="P1")
    status = Column(String(20), nullable=False, default="Ativo")
    sequence_length = Column(Integer, nullable=False, default=4)
    started_at = Column(Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
    completed_at = Column(Date, nullable=True)
    interrupted_at = Column(Date, nullable=True)
    requires_interview = Column(Boolean, nullable=False, default=False)
    interview_scheduled_for = Column(Date, nullable=True)
    interview_completed_at = Column(DateTime(timezone=True), nullable=True)
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

    user = relationship("User", back_populates="pass_cycles")
    sessions = relationship(
        "PassSession",
        back_populates="cycle",
        cascade="all, delete-orphan",
        order_by="PassSession.sequence_index",
    )


class PassSession(Base):
    __tablename__ = "pass_sessions"
    __table_args__ = (
        UniqueConstraint("cycle_id", "sequence_index", name="uq_pass_sessions_sequence"),
    )

    id = Column(Integer, primary_key=True, index=True)
    cycle_id = Column(Integer, ForeignKey("pass_cycles.id"), nullable=False, index=True)
    sequence_index = Column(Integer, nullable=False)
    scheduled_for = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="Presente")
    presence_recorded_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(String(255), nullable=True)
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

    cycle = relationship("PassCycle", back_populates="sessions")


class ExamRecord(Base):
    __tablename__ = "exam_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    answers = Column(Text, nullable=True)
    observations = Column(Text, nullable=True)
    recommendations = Column(JSON, nullable=False, default=list)
    next_pass_type = Column(String(5), nullable=True)
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

    user = relationship("User", back_populates="exam_record")


class ScanLog(Base):
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    raw = Column(Text, nullable=True)
    token_type = Column(String(20), nullable=True)
    scanned_for = Column(Date, nullable=True)
    ticket_number = Column(Integer, nullable=True)
    ok = Column(Boolean, default=False, nullable=False)
    error = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    session_id = Column(Integer, ForeignKey("pass_sessions.id"), nullable=True)


class WebAuthnCredential(Base):
    __tablename__ = "webauthn_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    credential_id = Column(String(255), nullable=False, unique=True, index=True)  # base64url id
    public_key = Column(Text, nullable=True)  # stored key material (dev placeholder when skip verify)
    sign_count = Column(Integer, nullable=False, default=0)
    transports = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
