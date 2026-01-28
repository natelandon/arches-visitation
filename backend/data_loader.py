from pathlib import Path
import pandas as pd
from datetime import datetime
from database import SessionLocal, VisitationRecord
import logging

logger = logging.getLogger(__name__)

def load_all_csv_data():
    """Parse all CSV files from data directory and load into database"""
    db = SessionLocal()
    
    # Try multiple possible paths for data directory
    possible_paths = [
        Path(__file__).parent.parent / "data",  # Local development
        Path("/app/data"),  # Docker container
        Path("../data"),  # Relative
    ]
    
    data_dir = None
    for path in possible_paths:
        if path.exists():
            data_dir = path
            logger.info(f"Using data directory: {data_dir}")
            break
    
    if data_dir is None:
        logger.warning(f"Data directory not found. Tried: {possible_paths}")
        return
    
    csv_files = sorted([f for f in data_dir.glob("*.csv") if f.is_file()])
    
    if not csv_files:
        logger.warning("No CSV files found in data directory")
        return
    
    for csv_file in csv_files:
        try:
            logger.info(f"Loading {csv_file.name}...")
            load_single_csv(db, csv_file)
        except Exception as e:
            logger.error(f"Error loading {csv_file.name}: {e}")
    
    db.close()
    logger.info("Data loading complete")

def load_single_csv(db, csv_path: Path):
    """Load a single CSV file with intelligent header detection"""
    # Skip if already loaded
    existing = db.query(VisitationRecord).filter(
        VisitationRecord.data_source == csv_path.name
    ).first()
    if existing:
        logger.info(f"Skipping {csv_path.name} - already loaded")
        return
    
    # Try different skip rows to find proper headers
    df = None
    skip_rows_used = None
    
    for skip_rows in range(5):
        try:
            df_temp = pd.read_csv(csv_path, skiprows=skip_rows, nrows=10)
            if len(df_temp.columns) > 1:
                # Check if this looks like usable data
                cols_str = " ".join(df_temp.columns).lower()
                if any(x in cols_str for x in ['visitor', 'recreation', 'year', 'month', 'date']):
                    df = pd.read_csv(csv_path, skiprows=skip_rows)
                    skip_rows_used = skip_rows
                    break
        except:
            continue
    
    if df is None or len(df) == 0:
        logger.info(f"Could not parse {csv_path.name}")
        return
    
    # Normalize column names
    df.columns = df.columns.str.lower().str.strip()
    
    # Find the relevant columns
    date_col = None
    visitor_col = None
    month_col = None
    year_col = None
    
    for col in df.columns:
        col_lower = col.lower()
        if 'year' in col_lower:
            year_col = col
        if 'month' in col_lower or col_lower == 'textbox33':
            month_col = col
        if 'date' in col_lower:
            date_col = col
        if 'visitor' in col_lower or 'recreation' in col_lower:
            if visitor_col is None:  # Take first matching column
                visitor_col = col
    
    # If no visitor column found, skip
    if visitor_col is None:
        logger.info(f"Skipping {csv_path.name} - no visitor column found")
        return
    
    records = []
    
    for idx, row in df.iterrows():
        try:
            # Parse visitors
            visitors_val = row[visitor_col]
            if pd.isna(visitors_val):
                continue
                
            visitors_str = str(visitors_val).strip()
            # Remove commas and other formatting
            visitors_str = visitors_str.replace(',', '').replace('%', '')
            
            try:
                visitors = int(float(visitors_str))
            except:
                continue
            
            if visitors < 0:
                continue
            
            # Determine date
            date = None
            
            if year_col and not pd.isna(row.get(year_col)):
                try:
                    year = int(float(row[year_col]))
                    # Check if we have month
                    if month_col and not pd.isna(row.get(month_col)):
                        month_val = row[month_col]
                        # Try to parse month from textbox33 format (e.g., "12/2025")
                        if isinstance(month_val, str) and '/' in month_val:
                            parts = month_val.split('/')
                            month = int(parts[0])
                            date = datetime(year, month, 1)
                        else:
                            try:
                                month = int(float(month_val))
                                date = datetime(year, month, 1)
                            except:
                                # Use July 1 as default for annual data
                                date = datetime(year, 7, 1)
                    else:
                        # No month, use July 1st for annual data
                        date = datetime(year, 7, 1)
                except:
                    continue
            elif date_col and not pd.isna(row.get(date_col)):
                try:
                    date = pd.to_datetime(row[date_col])
                except:
                    continue
            
            if date is None:
                continue
            
            record = VisitationRecord(
                date=date,
                visitors=visitors,
                month=date.month,
                year=date.year,
                day_of_week=date.weekday(),
                data_source=csv_path.name
            )
            records.append(record)
            
        except Exception as e:
            logger.debug(f"Skipping row {idx} in {csv_path.name}: {str(e)[:50]}")
            continue
    
    if records:
        # Remove duplicates based on (date, data_source)
        unique_records = {}
        for record in records:
            key = (record.date, record.data_source)
            if key not in unique_records or record.visitors > unique_records[key].visitors:
                unique_records[key] = record
        
        records = list(unique_records.values())
        db.add_all(records)
        db.commit()
        logger.info(f"Loaded {len(records)} records from {csv_path.name}")
    else:
        logger.info(f"No valid records found in {csv_path.name}")
