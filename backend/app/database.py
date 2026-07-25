"""
SQLAlchemy database setup for FleetFlow.

Exposes:
    engine        - the SQLAlchemy Engine bound to PostgreSQL
    SessionLocal  - a session factory for request-scoped DB sessions
    Base          - the declarative base every ORM model inherits from
    get_db()      - a FastAPI dependency that yields a scoped session
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

if not settings.DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and configure it "
        "before starting the application."
    )

engine = create_engine(settings.DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Session:
    """FastAPI dependency that provides a database session per request.

    Guarantees the session is closed once the request finishes, even if
    an exception is raised while handling it.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
