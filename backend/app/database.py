import os
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./compo.db")
    # Render / Heroku / Neon peuvent fournir postgres:// — SQLAlchemy attend postgresql://
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]

    # Neon ajoute parfois channel_binding=require, souvent incompatible avec psycopg2.
    if url.startswith("postgresql"):
        parsed = urlparse(url)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        qs.pop("channel_binding", None)
        if "sslmode" not in qs and "neon.tech" in (parsed.hostname or ""):
            qs["sslmode"] = ["require"]
        url = urlunparse(parsed._replace(query=urlencode(qs, doseq=True)))
    return url


DATABASE_URL = _database_url()

_connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
