from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import logging

from database import init_db, get_db, VisitationRecord
from data_loader import load_all_csv_data
from ai_service import OllamaService

# Pydantic models
class VisitationEntry(BaseModel):
    id: int | None = None
    date: str
    visitors: int

class AIExplanationRequest(BaseModel):
    chart_type: str  # 'annual_trends', 'monthly_breakdown', 'heatmap', 'monthly_rank'
    data: dict

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
    """Get overall statistics excluding current year (until next January 1st)"""
    try:
        current_year = datetime.now().year
        
        # Exclude current year from all statistics
        total = db.query(func.sum(VisitationRecord.visitors)).filter(
            VisitationRecord.year < current_year
        ).scalar() or 0
        count = db.query(func.count(VisitationRecord.id)).filter(
            VisitationRecord.year < current_year
        ).scalar() or 0
        avg = db.query(func.avg(VisitationRecord.visitors)).filter(
            VisitationRecord.year < current_year
        ).scalar() or 0
        
        # Peak year (excluding current year)
        peak_year_record = db.query(
            VisitationRecord.year,
            func.sum(VisitationRecord.visitors).label('total')
        ).filter(
            VisitationRecord.year < current_year
        ).group_by(VisitationRecord.year).order_by(func.sum(VisitationRecord.visitors).desc()).first()
        
        # Peak month (excluding current year)
        peak_month_record = db.query(
            VisitationRecord.month,
            func.sum(VisitationRecord.visitors).label('total')
        ).filter(
            VisitationRecord.year < current_year
        ).group_by(VisitationRecord.month).order_by(func.sum(VisitationRecord.visitors).desc()).first()
        
        # Year range (excluding current year)
        min_year = db.query(func.min(VisitationRecord.year)).filter(
            VisitationRecord.year < current_year
        ).scalar() or 1974
        max_year = db.query(func.max(VisitationRecord.year)).filter(
            VisitationRecord.year < current_year
        ).scalar() or 2024
        
        # Convert month number to name
        month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']
        peak_month_name = month_names[int(peak_month_record[0])] if peak_month_record else None
        
        # Get peak month visitors count (excluding current year)
        peak_month_visitors = db.query(func.sum(VisitationRecord.visitors)).filter(
            VisitationRecord.month == peak_month_record[0],
            VisitationRecord.year < current_year
        ).scalar() if peak_month_record else 0

        # Yearly totals for growth/decline and rolling average (excluding current year)
        yearly_totals = db.query(
            VisitationRecord.year,
            func.sum(VisitationRecord.visitors).label('total')
        ).filter(
            VisitationRecord.year < current_year
        ).group_by(VisitationRecord.year).order_by(VisitationRecord.year.asc()).all()

        highest_growth_year = None
        highest_growth_value = None
        biggest_decline_year = None
        biggest_decline_value = None

        if yearly_totals and len(yearly_totals) > 1:
            previous = yearly_totals[0]
            for current in yearly_totals[1:]:
                delta = int(current.total) - int(previous.total)
                if highest_growth_value is None or delta > highest_growth_value:
                    highest_growth_value = delta
                    highest_growth_year = int(current.year)
                if biggest_decline_value is None or delta < biggest_decline_value:
                    biggest_decline_value = delta
                    biggest_decline_year = int(current.year)
                previous = current

        # 10-year rolling average based on most recent 10 years
        ten_year_avg = None
        if yearly_totals:
            last_ten = yearly_totals[-10:]
            ten_year_avg = int(sum(int(y.total) for y in last_ten) / len(last_ten))

        stats = {
            "total_visitors": int(total),
            "average_daily": float(avg),
            "peak_year": int(peak_year_record[0]) if peak_year_record else None,
            "peak_year_visitors": int(db.query(func.sum(VisitationRecord.visitors)).filter(
                VisitationRecord.year == peak_year_record[0],
                VisitationRecord.year < current_year
            ).scalar() or 0) if peak_year_record else 0,
            "peak_month": peak_month_name,
            "peak_month_visitors": int(peak_month_visitors),
            "highest_growth_year": highest_growth_year,
            "highest_growth_value": highest_growth_value,
            "biggest_decline_year": biggest_decline_year,
            "biggest_decline_value": biggest_decline_value,
            "ten_year_average": ten_year_avg,
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

@app.get("/visitation/annual")
async def get_annual_data(start_year: int = None, end_year: int = None, db: Session = Depends(get_db)):
    """Get annual aggregated data for overview chart"""
    try:
        query = db.query(
            VisitationRecord.year,
            func.sum(VisitationRecord.visitors).label('visitors')
        ).group_by(VisitationRecord.year)
        
        if start_year:
            query = query.filter(VisitationRecord.year >= start_year)
        if end_year:
            query = query.filter(VisitationRecord.year <= end_year)
        
        records = query.order_by(VisitationRecord.year).all()
        
        data = [
            {
                "year": int(r.year) if r.year is not None else 0,
                "visitors": int(r.visitors) if r.visitors is not None else 0
            }
            for r in records if r.year is not None
        ]
        
        return data
    except Exception as e:
        logger.error(f"Error getting annual data: {e}")
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

@app.post("/visitation/entry")
async def add_visitation_entry(entry: VisitationEntry, db: Session = Depends(get_db)):
    """Add a new daily visitation entry or update existing one"""
    try:
        # Parse and validate the date
        entry_date = datetime.strptime(entry.date, "%Y-%m-%d").date()
        
        if entry.id:
            # Updating existing entry by ID
            existing = db.query(VisitationRecord).filter(
                VisitationRecord.id == entry.id
            ).first()
            
            if not existing:
                raise HTTPException(status_code=404, detail="Entry not found")
            
            existing.date = entry_date
            existing.visitors = entry.visitors
            existing.year = entry_date.year
            existing.month = entry_date.month
            existing.day_of_week = entry_date.weekday()
            logger.info(f"Updated entry ID {entry.id} for {entry_date}: {entry.visitors} visitors")
            action = "updated"
        else:
            # Creating new entry - check for duplicates
            existing = db.query(VisitationRecord).filter(
                func.date(VisitationRecord.date) == entry_date
            ).first()
            
            if existing:
                raise HTTPException(
                    status_code=409, 
                    detail=f"An entry already exists for {entry.date}. Please use the edit button to update it."
                )
            
            # Create new entry
            new_record = VisitationRecord(
                date=entry_date,
                visitors=entry.visitors,
                year=entry_date.year,
                month=entry_date.month,
                day_of_week=entry_date.weekday()
            )
            db.add(new_record)
            logger.info(f"Added new entry for {entry_date}: {entry.visitors} visitors")
            action = "created"
        
        db.commit()
        
        return {
            "status": "success",
            "date": entry.date,
            "visitors": entry.visitors,
            "action": action
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/visitation/daily")
async def get_daily_records(year: int = None, db: Session = Depends(get_db)):
    """Get daily visitation records with IDs for data entry management"""
    try:
        query = db.query(VisitationRecord)
        
        if year:
            # Filter by year extracted from date, since year column may be NULL
            query = query.filter(func.extract('year', VisitationRecord.date) == year)
        
        records = query.order_by(VisitationRecord.date.desc()).all()
        
        return [
            {
                "id": r.id,
                "date": r.date.isoformat() if r.date else None,
                "visitors": r.visitors
            }
            for r in records
        ]
    except Exception as e:
        logger.error(f"Error getting daily records: {e}")
        return []

@app.delete("/visitation/entry/{entry_id}")
async def delete_visitation_entry(entry_id: int, db: Session = Depends(get_db)):
    """Delete a visitation entry by ID"""
    try:
        # Find the entry
        entry = db.query(VisitationRecord).filter(
            VisitationRecord.id == entry_id
        ).first()
        
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        entry_date = entry.date
        db.delete(entry)
        db.commit()
        
        logger.info(f"Deleted entry for {entry_date} (ID: {entry_id})")
        
        return {
            "status": "success",
            "message": "Entry deleted successfully",
            "id": entry_id
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting visitation entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/explain-chart")
async def explain_chart(request: AIExplanationRequest):
    """Generate AI explanation for chart data using Ollama"""
    try:
        # Check if Ollama is available
        if not OllamaService.is_available():
            return {
                "explanation": "AI explanation service is not available. Please ensure Ollama is installed and running on localhost:11434",
                "available": False
            }
        
        chart_type = request.chart_type
        data = request.data
        
        # Route to appropriate explanation method
        if chart_type == "annual_trends":
            explanation = OllamaService.explain_annual_trends(data)
        elif chart_type == "monthly_breakdown":
            explanation = OllamaService.explain_monthly_breakdown(
                data.get("stats", data),
                data.get("month", ""),
                data.get("year", 2025)
            )
        elif chart_type == "heatmap":
            explanation = OllamaService.explain_heatmap_patterns(data)
        elif chart_type == "monthly_rank":
            explanation = OllamaService.explain_monthly_rank(
                data,
                data.get("month", ""),
                data.get("rank", 0)
            )
        else:
            explanation = "Unknown chart type"
        
        return {
            "explanation": explanation,
            "available": True
        }
        
    except Exception as e:
        logger.error(f"Error generating AI explanation: {e}")
        return {
            "explanation": "Error generating explanation. Please try again.",
            "available": False,
            "error": str(e)
        }

@app.get("/api/ai/status")
async def ai_status():
    """Check if AI explanation service is available"""
    available = OllamaService.is_available()
    return {
        "available": available,
        "service": "Ollama",
        "endpoint": "http://localhost:11434",
        "default_model": "mistral"
    }

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
