"""
Alembic migration environment for FleetFlow.

Loads DATABASE_URL from .env (via app.config) rather than from
alembic.ini, and imports every ORM model so that `alembic revision
--autogenerate` can see the full schema — the fully-built `users` table
as well as the nine Milestone 1 stub tables.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.database import Base

# Import every model module so its table is registered on Base.metadata
# before autogenerate inspects it. The imports are intentionally
# unused directly in this file — they exist for their side effect.
from app.models import (  # noqa: F401
    attendance,
    driver,
    fuel_record,
    gps_tracking,
    maintenance,
    notification,
    shipment,
    trip,
    user,
    vehicle,
)

# Alembic Config object, providing access to values within alembic.ini.
config = context.config

# Inject the real database URL from environment configuration instead of
# reading it from alembic.ini, so credentials live only in .env.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging, if present.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata used for 'autogenerate' support.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emits SQL without a live connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (against a live DB connection)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
