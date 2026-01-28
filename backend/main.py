from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import logging

from database import init_db, get_db, VisitationRecord
from data_loader import load_all_csv_data

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Arches Visitation API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize database and load data on startup"""
    logger.info("Initializing database...")
    init_db()
    logger.info("Loading CSV data...")
    load_all_csv_data()
    logger.info("Startup complete")

@app.get("/")
async def root():
    return {"message": "Arches Visitation API", "version": "0.1.0"}

@app.get("/visitation/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get overall statistics"""
    try:
        total = db.query(func.sum(VisitationRecord.visitors)).scalar() or 0
        count = db.query(func.count(VisitationRecord.id)).scalar() or 0
        avg = db.query(func.avg(VisitationRecord.visitors)).scalar() or 0
        
        # Peak year
        peak_year_record = db.query(
            VisitationRecord.year,
            func.sum(VisitationRecord.visitors).label('total')
        ).group_by(VisitationRecord.year).order_by(func.sum(VisitationRecord.visitors).desc()).first()
        
        # Peak month
        peak_month_record = db.query(
            VisitationRecord.month,
            func.sum(VisitationRecord.visitors).label('total')
        ).group_by(VisitationRecord.month).order_by(func.sum(VisitationRecord.visitors).desc()).first()
        
        # Year range
        min_year = db.query(func.min(VisitationRecord.year)).scalar() or 1974
        max_year = db.query(func.max(VisitationRecord.year)).scalar() or 2024
        
        stats = {
            "total_visitors": int(total),
            "average_daily": float(avg),
            "peak_year": int(peak_year_record[0]) if peak_year_record else None,
            "peak_month": int(peak_month_record[0]) if peak_month_record else None,
            "years_covered": [int(min_year), int(max_year)],
            "data_points": int(count)
        }
        
        return stats
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return {}

@app.get("/visitation/timeseries")
async def get_timeseries(start_year: int = None, end_year: int = None, db: Session = Depends(get_db)):
    """Get time series data for D3 visualization"""
    try:
        query = db.query(VisitationRecord)
        
        if start_year:
            query = query.filter(VisitationRecord.year >= start_year)
        if end_year:
            query = query.filter(VisitationRecord.year <= end_year)
        
        records = query.order_by(VisitationRecord.date).all()
        
        # Convert to DataFrame for easy aggregation
        if not records:
            return []
        
        df = pd.DataFrame([{
            'date': r.date,
            'visitors': r.visitors
        } for r in records])
        
        # Aggregate by month
        df['date'] = pd.to_datetime(df['date'])
        monthly = df.groupby(df['date'].dt.to_period('M'))['visitors'].sum().reset_index()
        monthly['date'] = monthly['date'].dt.to_timestamp()
        
        data = [
            {
                "date": row['date'].isoformat(),
                "visitors": int(row['visitors'])
            }
            for _, row in monthly.iterrows()
        ]
        
        return data
    except Exception as e:
        logger.error(f"Error getting timeseries: {e}")
        return []

@app.get("/visitation/daily")
async def get_daily_data(year: int = None, month: int = None, db: Session = Depends(get_db)):
    """Get daily visitation data filtered by year/month"""
    try:
        query = db.query(VisitationRecord)
        
        if year:
            query = query.filter(VisitationRecord.year == year)
        if month:
            query = query.filter(VisitationRecord.month == month)
        
        records = query.order_by(VisitationRecord.date).all()
        
        data = [
            {
                "date": r.date.isoformat(),
                "visitors": r.visitors,
                "month": r.month,
                "year": r.year,
                "day_of_week": r.day_of_week
            }
            for r in records
        ]
        
        return data
    except Exception as e:
        logger.error(f"Error getting daily data: {e}")
        return []

@app.get("/visitation/heatmap")
async def get_heatmap_data(db: Session = Depends(get_db)):
    """Get data for D3 heatmap (day of week × month)"""
    try:
        records = db.query(VisitationRecord).all()
        
        if not records:
            return []
        
        df = pd.DataFrame([{
            'month': r.month,
            'day_of_week': r.day_of_week,
            'visitors': r.visitors
        } for r in records])
        
        heatmap = df.groupby(['month', 'day_of_week'])['visitors'].mean().reset_index()
        
        data = [
            {
                "month": int(row['month']),
                "day_of_week": int(row['day_of_week']),
                "visitors": float(row['visitors'])
            }
            for _, row in heatmap.iterrows()
        ]
        
        return data
    except Exception as e:
        logger.error(f"Error getting heatmap data: {e}")
        return []

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check with database status"""
    try:
        count = db.query(func.count(VisitationRecord.id)).scalar() or 0
        return {"status": "healthy", "records_in_db": count}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
