import os
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings

load_dotenv()

DATABASE_URL = settings.DATABASE_URL
engine_kwargs = {"connect_args": {"check_same_thread": False}} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
