#!/bin/bash
# Development script for Arches Visitation project

set -e

COMMAND=${1:-help}

case $COMMAND in
  install)
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    echo "Installing backend dependencies..."
    cd backend && pip install -r requirements.txt && cd ..
    echo "✓ Dependencies installed"
    ;;
  
  dev)
    echo "Starting development servers..."
    echo "Frontend will run on http://localhost:5173"
    echo "Backend will run on http://localhost:8000"
    
    # Start backend in background
    cd backend
    python main.py &
    BACKEND_PID=$!
    cd ..
    
    # Start frontend
    cd frontend
    npm run dev
    cd ..
    
    # Cleanup on exit
    kill $BACKEND_PID
    ;;
  
  dev-docker)
    echo "Starting with Docker Compose..."
    docker-compose up
    ;;
  
  db-reset)
    echo "Resetting database..."
    rm -f backend/arches.db
    echo "Database reset. Run 'dev' or 'dev-docker' to reload data."
    ;;
  
  db-status)
    echo "Database status..."
    if [ -f backend/arches.db ]; then
      echo "✓ Database exists"
      sqlite3 backend/arches.db "SELECT COUNT(*) as total_records FROM visitation_records;" 2>/dev/null || echo "  (Initialize database first)"
    else
      echo "✗ Database not found. Run 'dev' to initialize."
    fi
    ;;
  
  clean)
    echo "Cleaning up..."
    rm -rf frontend/node_modules frontend/dist
    rm -rf backend/__pycache__ backend/*.db
    echo "✓ Cleaned"
    ;;
  
  *)
    echo "Arches Visitation Development Helper"
    echo ""
    echo "Usage: ./dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  install       Install all dependencies"
    echo "  dev           Run frontend + backend locally"
    echo "  dev-docker    Run with Docker Compose"
    echo "  db-reset      Reset the SQLite database"
    echo "  db-status     Check database status"
    echo "  clean         Remove node_modules, dist, cache"
    echo ""
    ;;
esac
