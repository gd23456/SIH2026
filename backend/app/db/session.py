"""Engine + session helpers.

The engine is built lazily rather than at import time so tests can point
DATABASE_URL at a throwaway file before the app is imported.
"""
from __future__ import annotations

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from ..config import get_settings

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        url = get_settings().database_url
        # check_same_thread=False: uvicorn and TestClient both reach the
        # connection from more than one thread.
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        _engine = create_engine(url, connect_args=connect_args)
    return _engine


def init_db() -> None:
    """Create tables. Safe to call repeatedly."""
    SQLModel.metadata.create_all(get_engine())


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
