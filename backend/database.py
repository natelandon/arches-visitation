from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

# SQLite database
DATABASE_URL = "sqlite:///./arches.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)
