"""Persistence layer.

Importing this package registers the models on SQLModel.metadata, which is
what `init_db()` needs in order to create the tables.
"""
from .models import Artisan, Listing
from .session import get_engine, get_session, init_db

__all__ = ["Artisan", "Listing", "get_engine", "get_session", "init_db"]
