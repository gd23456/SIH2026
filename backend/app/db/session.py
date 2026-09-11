"""Engine + session helpers.

The engine is built lazily rather than at import time so tests can point
DATABASE_URL at a throwaway file before the app is imported.
"""
from __future__ import annotations

import logging
from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from ..config import get_settings

log = logging.getLogger("karigar.db")

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
    """Create tables and add any columns the model has gained.

    Safe to call repeatedly.

    create_all() creates MISSING TABLES only — it will not touch a table that
    already exists, so a model that gains a column leaves every existing
    database one column short and every query against it raises
    OperationalError. That has bitten this project once already (views/scans,
    which 500'd every publish on a pre-existing db). Rather than ship a
    migration tool for a handful of additive string columns, reconcile them
    here: read the live schema, add what is absent, never drop or alter.
    """
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    _add_missing_columns(engine)


# Additive-only reconciliation. Deliberately narrow: new nullable/defaulted
# columns are safe to bolt on, anything else (renames, type changes, drops)
# needs a real migration and a human.
def _add_missing_columns(engine) -> None:
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table in SQLModel.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue  # create_all just made it, so it is already current
            have = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in have:
                    continue
                sql_type = column.type.compile(engine.dialect)
                default = ""
                if not column.nullable:
                    # SQLite cannot add a NOT NULL column without telling it
                    # what the existing rows should hold.
                    is_text = any(k in sql_type.upper() for k in ("CHAR", "TEXT", "CLOB"))
                    literal = "''" if is_text else "0"
                    default = f" NOT NULL DEFAULT {literal}"
                conn.execute(
                    text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {sql_type}{default}')
                )
                log.info("migrated: added %s.%s", table.name, column.name)


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
