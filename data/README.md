# Data Directory

All visitation data has been loaded into the SQLite database (`backend/arches.db`).

**CSV files have been removed** - the data is now persisted in the database.

## Data Status

- **Database**: SQLite (96+ records loaded)
- **Auto-loading**: Happens on backend startup
- **Location**: `backend/arches.db`

## Adding More Data

To add more CSV files with visitation data:

1. Place CSV files in this directory
2. Restart the backend (or run `./dev.sh dev`)
3. The data loader will auto-detect and parse them

The loader intelligently handles:
- Different header row positions
- Various column name formats  
- Year/month/date combinations
- Duplicate prevention

## CSV Format

Your CSVs should contain at minimum:
- A visitor count column (`visitors`, `recreation visitors`, etc.)
- A date column or year column

The parser will auto-detect column names (case-insensitive).
