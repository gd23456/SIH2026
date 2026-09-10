"""Persistence layer.

Importing this package registers the models on SQLModel.metadata, which is
what `init_db()` needs in order to create the tables.
"""
from .models import Artisan, ChannelConnection, ChannelPublish, Listing
from .session import get_engine, get_session, init_db

__all__ = [
    "Artisan",
    "ChannelConnection",
    "ChannelPublish",
    "Listing",
    "get_engine",
    "get_session",
    "init_db",
]
