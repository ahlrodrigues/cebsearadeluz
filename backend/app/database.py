from contextlib import contextmanager
from typing import Generator

import logging
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)


# Resolve default DB file with absolute path to avoid CWD surprises.
# Prefer a shared app.db at repo root if it exists; otherwise use backend/app.db.
def _default_sqlite_url() -> str:
    base_dir = Path(__file__).resolve().parent.parent  # backend/
    root_db = base_dir.parent / "app.db"
    backend_db = base_dir / "app.db"
    db_file = root_db if root_db.exists() else backend_db
    logger.warning(
        "DATABASE_URL not set; defaulting to %s (root app.db %s)",
        db_file,
        "found" if root_db.exists() else "not found, using backend/app.db",
    )
    return f"sqlite:///{db_file}"


# Allow overriding the database via env var so tests and dev can isolate DBs
DATABASE_URL = os.getenv("DATABASE_URL") or _default_sqlite_url()


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


def init_db() -> None:
    """Create tables if they do not exist."""
    from . import models  # local import to avoid circular at module import
    Base.metadata.create_all(bind=engine)
