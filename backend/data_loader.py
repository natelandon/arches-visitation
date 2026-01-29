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
    
    # Separate annual and monthly files
    monthly_files = []
    annual_files = []
    other_files = []
    
    for f in csv_files:
        if 'Monthly' in f.name or 'Month' in f.name:
            monthly_files.append(f)
        elif 'Annual' in f.name:
            annual_files.append(f)
        else:
            other_files.append(f)
    
    # Process monthly files first to get their year coverage
    monthly_years = set()
    for csv_file in monthly_files:
        try:
            logger.info(f"Loading {csv_file.name}...")
            years = load_single_csv(db, csv_file)
            if years:
                monthly_years.update(years)
        except Exception as e:
            logger.error(f"Error loading {csv_file.name}: {e}")
    
    # Process annual files, but skip years already covered by monthly data
    for csv_file in annual_files:
        try:
            logger.info(f"Loading {csv_file.name}...")
            load_single_csv(db, csv_file, skip_years=monthly_years)
        except Exception as e:
            logger.error(f"Error loading {csv_file.name}: {e}")
    
    # Process remaining files
    for csv_file in other_files:
        try:
            logger.info(f"Loading {csv_file.name}...")
            load_single_csv(db, csv_file)
        except Exception as e:
            logger.error(f"Error loading {csv_file.name}: {e}")
    
    db.close()
    logger.info("Data loading complete")

def load_single_csv(db, csv_path: Path, skip_years: set = None):
    """Load a single CSV file with intelligent header detection
    
    Args:
        skip_years: Set of years to skip (used to avoid duplicates between annual and monthly data)
    
    Returns:
        Set of years loaded from this file
    """
    if skip_years is None:
        skip_years = set()
    
    # Skip if already loaded
    existing = db.query(VisitationRecord).filter(
        VisitationRecord.data_source == csv_path.name
    ).first()
    if existing:
        logger.info(f"Skipping {csv_path.name} - already loaded")
        return set()
    
    # Try different skip rows to find proper headers
    df = None
    skip_rows_used = None
    
    for skip_rows in range(5):
        try:
            df_temp = pd.read_csv(csv_path, skiprows=skip_rows, nrows=10)
            if len(df_temp.columns) > 1:
                # Check if this looks like usable data
                cols_str = " ".join(df_temp.columns).lower()
                if any(x in cols_str for x in ['visitor', 'recreation', 'year', 'month', 'date', 'jan', 'feb']):
                    df = pd.read_csv(csv_path, skiprows=skip_rows)
                    skip_rows_used = skip_rows
                    break
        except:
            continue
    
    if df is None or len(df) == 0:
        logger.info(f"Could not parse {csv_path.name}")
        return set()
    
    # Normalize column names
    df.columns = df.columns.str.lower().str.strip()
    
    # Check if this is a monthly format (Year + JAN, FEB, MAR, etc.)
    month_names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    has_month_columns = any(month in df.columns for month in month_names)
    
    records = []
    years_loaded = set()
    
    if has_month_columns:
        # Handle monthly data format (Year column + month columns)
        logger.info(f"Detected monthly format for {csv_path.name}")
        
        for idx, row in df.iterrows():
            try:
                if pd.isna(row.get('year')):
                    continue
                    
                year = int(float(row['year']))
                
                # Skip years that should be excluded
                if year in skip_years:
                    continue
                
                years_loaded.add(year)
                
                # Process each month column
                for month_idx, month_name in enumerate(month_names, 1):
                    if month_name not in df.columns:
                        continue
                    
                    visitors_val = row[month_name]
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
                    
                    date = datetime(year, month_idx, 1)
                    
                    record = VisitationRecord(
                        date=date,
                        visitors=visitors,
                        month=month_idx,
                        year=year,
                        day_of_week=date.weekday(),
                        data_source=csv_path.name
                    )
                    records.append(record)
                    
            except Exception as e:
                logger.debug(f"Skipping row {idx} in {csv_path.name}: {str(e)[:50]}")
                continue
    else:
        # Handle annual/other formats
        logger.info(f"Detected other format for {csv_path.name}")
        
        # Find the relevant columns
        visitor_col = None
        year_col = None
        
        for col in df.columns:
            col_lower = col.lower()
            if 'year' in col_lower:
                year_col = col
            if 'visitor' in col_lower or 'recreation' in col_lower:
                if visitor_col is None:  # Take first matching column
                    visitor_col = col
        
        # If no visitor column found, skip
        if visitor_col is None:
            logger.info(f"Skipping {csv_path.name} - no visitor column found")
            return set()
        
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
                        
                        # Skip years that should be excluded
                        if year in skip_years:
                            continue
                        
                        years_loaded.add(year)
                        # Use July 1 as default for annual data
                        date = datetime(year, 7, 1)
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
    
    return years_loaded
