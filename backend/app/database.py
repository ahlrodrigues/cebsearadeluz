from contextlib import contextmanager
from typing import Generator

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


# Allow overriding the database via env var so tests and dev can isolate DBs
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")


def _make_engine(url: str):
    # For SQLite, configure safe defaults to avoid long locks
    if url.startswith("sqlite://"):
        return create_engine(
            url,
            connect_args={
                "check_same_thread": False,
                # Short timeout so a locked file doesn't stall forever
                "timeout": 5.0,
            },
        )
    return create_engine(url)


engine = _make_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


@contextmanager
def session_scope() -> Generator:
    """Provide a transactional scope around a series of operations."""

    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
