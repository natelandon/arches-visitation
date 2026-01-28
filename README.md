# Arches National Park Visitation Analytics

A full-stack data visualization project showcasing 50+ years of visitation data from Arches National Park using React, D3.js, and FastAPI.

## Features

- **React + Vite**: Fast, modern frontend development
- **D3.js**: Interactive time-series and monthly heatmap visualizations
- **Tailwind CSS + shadcn/ui**: Professional, accessible UI with dark mode
- **FastAPI**: High-performance Python backend with SQLite database
- **SQLAlchemy ORM**: Type-safe database queries
- **Automatic CSV parsing**: Loads all CSV files from data directory on startup
- **Docker Compose**: One-command deployment

## Quick Start

### With Docker (Recommended)

```bash
docker-compose up
```

Frontend: http://localhost:5173  
Backend: http://localhost:8000  
Database: SQLite (auto-initialized)

### Manual Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python main.py
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Using Development Script

```bash
chmod +x dev.sh

# Install all dependencies
./dev.sh install

# Run locally (frontend + backend)
./dev.sh dev

# Run with Docker
./dev.sh dev-docker

# Check database status
./dev.sh db-status

# Reset database
./dev.sh db-reset

# Clean up
./dev.sh clean
```

## Project Structure

```
arches-visitation/
├── frontend/          # React + Vite application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── store/       # Zustand state management
│   │   └── App.jsx
│   └── package.json
├── backend/           # FastAPI + SQLAlchemy server
│   ├── main.py        # FastAPI app & endpoints
│   ├── database.py    # SQLAlchemy models & setup
│   ├── data_loader.py # CSV parsing & database loading
│   └── requirements.txt
├── data/              # CSV data files
│   └── *.csv          # Your Arches visitation CSVs
├── docker-compose.yml
├── dev.sh            # Development helper script
└── README.md
```

## Data Format

Place your Arches visitation CSVs in the `data/` directory. The backend will auto-detect and parse them on startup.

Supported columns (any case-insensitive):
- `date` - Date in any format pandas can parse (required)
- `visitors` / `recreation visitors` - Number of visitors (required)
- `month`, `year`, `day_of_week` - Optional, auto-calculated if missing

The loader will intelligently detect column names and skip invalid rows.

## Database

- **Type**: SQLite
- **Location**: `backend/arches.db` (created automatically)
- **Auto-initialization**: Database tables created on first startup
- **Auto-loading**: All CSV files in `data/` directory loaded on startup
- **Duplicate prevention**: Already-loaded files are skipped

### Database Schema

```
visitation_records
├── id (Integer, PK)
├── date (DateTime, indexed)
├── visitors (Integer)
├── month (Integer)
├── year (Integer, indexed)
├── day_of_week (Integer)
├── data_source (String) - Which CSV file
└── created_at (DateTime)
```

## API Endpoints

- `GET /` - API info
- `GET /health` - Health check with record count
- `GET /visitation/stats` - Summary statistics
- `GET /visitation/timeseries?start_year=YYYY&end_year=YYYY` - Monthly aggregated data for D3
- `GET /visitation/heatmap` - Heatmap data by year and month

## Development

- React code updates hot-reload via Vite
- Backend changes require container restart
- D3 visualizations update via shared Zustand store
- Database persists across restarts

## Troubleshooting

**Database not loading data:**
```bash
./dev.sh db-status  # Check if records are loaded
./dev.sh db-reset   # Clear and reload
```
**Port already in use:**
Edit `docker-compose.yml` or kill existing processes:
```bash
lsof -i :5173  # Check frontend
lsof -i :8000  # Check backend
```

**CSV not being parsed:**
Check backend logs for column detection. Ensure CSV has `date` and `visitors`/`recreation` columns.

## License

MIT
