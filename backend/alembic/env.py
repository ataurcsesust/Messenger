"""
Alembic migration environment.

Pulls the DB URL and model metadata from the app itself rather than
duplicating configuration in alembic.ini, so migrations always reflect
the same models the running app uses. Uses the sync (psycopg2) URL
because Alembic's migration runner is synchronous.
"""
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# Make the `app` package importable when alembic is run from the project root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.database.session import Base  # noqa: E402
import app.models  # noqa: E402  (registers all model classes on Base.metadata)

config = context.config

# Inject the sync DB URL from our own settings instead of alembic.ini.
db_url = settings.DATABASE_URL
if db_url and "+asyncpg" in db_url:
    db_url = db_url.replace("+asyncpg", "")

config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
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
    connect_args = {}
    if "sslmode=require" in db_url:
        connect_args["sslmode"] = "require"
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
