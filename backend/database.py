from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from pathlib import Path
import os

# READ_ONLY=1 for hosts with a read-only filesystem (e.g. Vercel): the committed
# database is opened read-only and nothing is written at startup or by requests.
READ_ONLY = os.getenv("READ_ONLY") == "1"

# Next to this file, so it doesn't depend on the directory the server starts in
DB_PATH = Path(__file__).resolve().parent / "arches.db"


def make_engine(path: Path, read_only: bool = False):
    if read_only:
        # immutable=1: SQLite creates no journal or lock files, which a
        # read-only filesystem would refuse
        return create_engine(
            f"sqlite:///file:{path}?mode=ro&immutable=1&uri=true",
            connect_args={"check_same_thread": False},
        )
    return create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})


engine = make_engine(DB_PATH, READ_ONLY)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class VisitationRecord(Base):
    __tablename__ = "visitation_records"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, index=True, nullable=False)
    visitors = Column(Integer, nullable=False)
    month = Column(Integer, nullable=True)
    year = Column(Integer, index=True, nullable=True)
    day_of_week = Column(Integer, nullable=True)
    data_source = Column(String, nullable=True)  # Which CSV file it came from
    created_at = Column(DateTime, default=datetime.utcnow)

class ExplanationCacheEntry(Base):
    """A checked AI explanation, stored so the same chart isn't sent to the model twice."""
    __tablename__ = "explanation_cache"

    key = Column(String, primary_key=True)  # sha256 of model + prompt; see explanation_cache.py
    chart_type = Column(String, nullable=False)
    model = Column(String, nullable=False)
    result_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)
