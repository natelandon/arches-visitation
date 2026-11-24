# Arches Visitation Analytics Dashboard

A modern, full-stack analytics dashboard for visualizing park visitation data with interactive charts and AI-powered insights. Built with React, TypeScript, FastAPI, D3.js, and Three.js.

## 🚀 Features

- **Interactive Visualizations**: D3.js time-series charts, monthly heatmaps, and Three.js 3D rankings
- **AI-Powered Insights**: Natural language explanations of chart data using Ollama/Mistral
- **Modern Tech Stack**: React 18, TypeScript, Vite, FastAPI, and SQLite
- **Comprehensive Testing**: Vitest unit tests + Playwright E2E tests
- **Responsive Design**: Tailwind CSS with dark/light theme support
- **Efficient State Management**: Zustand for lightweight, performant state handling
- **Docker Support**: Full containerization with Docker Compose
- **Auto-Initialized Database**: SQLite with automatic data loading

## 🛠️ Technologies Used

### Frontend
- **React** 18.2.0 - UI library
- **TypeScript** 5.2.2 - Type-safe JavaScript
- **Vite** 6.4.1 - Fast build tool and dev server
- **D3.js** 7.8.5 - Data visualization library
- **Three.js** 0.160.0 - 3D graphics library
- **Zustand** 4.4.1 - State management
- **Tailwind CSS** 3.3.5 - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library

### Backend
- **Python** 3.8+
- **FastAPI** 0.104.1 - Modern Python web framework
- **Uvicorn** 0.24.0 - ASGI server
- **Pandas** 2.1.1 - Data manipulation
- **NumPy** 1.26.2 - Numerical computing
- **Pydantic** 2.5.0 - Data validation
- **SQLAlchemy** 2.0.23 - SQL toolkit and ORM
- **Alembic** 1.12.1 - Database migrations

### Testing
- **Vitest** 4.0.18 - Unit testing framework
- **Playwright** 1.50.1 - End-to-end testing
- **Testing Library** - React component testing

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **SQLite** - Embedded database
- **Ollama** - Local LLM inference (optional)

## 📋 Prerequisites

- **Node.js 22.12+** (see `.nvmrc`)
- **Python 3.8+**
- **Docker & Docker Compose** (optional, for containerized deployment)
- **Ollama** (optional, for AI explanations)

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
docker-compose up

# Or run in detached mode
docker-compose up -d
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Option 2: Manual Setup

#### Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python3 -m uvicorn main:app --reload
```

Backend runs at http://localhost:8000

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173

## 🤖 AI Explanations (Optional)

To enable AI-powered chart explanations, install and run Ollama with the Mistral model:

```bash
# Install Ollama (macOS/Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull the Mistral model
ollama pull mistral

# Start Ollama server
ollama serve
```

The application will automatically connect to Ollama and enable:
- Natural language explanations for charts
- Trend analysis and insights
- Interactive data interpretation

### How explanations are checked

The model isn't trusted to get numbers right. Each explanation goes through these steps (see `backend/ai_service.py`):

1. **Structured output.** Ollama is given a JSON schema, so the model must return a `summary` plus a list of `claims`. Each claim names a number and the data field it came from (for example `stats.visitors`). Temperature is 0 so results are consistent.
2. **Number checking.** Every claim is compared with the actual value in the chart data. Numbers written in the summary are checked too, allowing for rounding (so "1.2 million" matches 1,234,567).
3. **One retry with feedback.** If a claim is wrong or points to a field that doesn't exist, the model is told exactly what was wrong and tries once more.
4. **Shown in the UI.** Each explanation shows whether every number matched, some couldn't be checked, or some didn't match. Click it to see each claim.

The prompts also tell the model to present causes (weather, holidays) as likely factors rather than facts.

Expect 1-2 minutes per explanation on a laptop CPU with Mistral, and twice that when a retry happens.

### Caching

Each explanation is saved in the `explanation_cache` table in `backend/arches.db` (see `backend/explanation_cache.py`), so a chart is only sent to the model once. After that it loads instantly, survives backend restarts, and is still shown if Ollama is stopped.

- The cache key covers the model name and the full prompt, which includes the chart data. New data, a different `OLLAMA_MODEL`, or an edited prompt get a fresh explanation automatically. If you change how results are processed after the model answers, bump `CACHE_VERSION` in `explanation_cache.py`.
- If two requests for the same chart arrive together, they share one model run. If the browser leaves mid-request, the run still finishes and is saved.
- Errors and timeouts are not cached.
- To clear the cache: `sqlite3 backend/arches.db "DELETE FROM explanation_cache"`.

API endpoints:
- `POST /api/ai/explain-chart` - Generate chart explanations
- `GET /api/ai/status` - Check AI service availability

## 📁 Project Structure

```
arches-visitation/
├── backend/               # FastAPI backend
│   ├── main.py           # Application entry point
│   ├── ai_service.py     # AI/LLM integration
│   ├── data_loader.py    # CSV data processing
│   ├── database.py       # SQLAlchemy models
│   ├── requirements.txt  # Python dependencies
│   └── data/             # Parsed data cache
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── store/        # Zustand stores
│   │   ├── hooks/        # Custom React hooks
│   │   ├── types/        # TypeScript definitions
│   │   └── utils/        # Utility functions
│   ├── e2e/              # Playwright tests
│   ├── package.json      # Node dependencies
│   └── vite.config.js    # Vite configuration
├── data/                 # Source CSV files
├── docker-compose.yml    # Docker orchestration
└── .nvmrc                # Node version specification

## 📜 Available Scripts

### Frontend

```bash
npm run dev          # Start development server
npm run build        # Create production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test         # Run unit tests with Vitest
npm run test:e2e     # Run end-to-end tests with Playwright
npm run test:e2e:ui  # Run E2E tests in UI mode
```

### Backend

```bash
# In virtual environment
uvicorn main:app --reload              # Development server with hot reload
uvicorn main:app --host 0.0.0.0        # Expose on all interfaces
python3 -m pytest                       # Run backend tests (if available)
```

## 🧪 Testing

The project includes comprehensive testing at multiple levels:

### Unit Tests (Vitest)
```bash
cd frontend
npm run test

# Run with coverage
npm run test -- --coverage
```

Tests include:
- Component rendering and behavior
- State management (Zustand stores)
- Utility functions
- Data formatting

### End-to-End Tests (Playwright)
```bash
cd frontend
npm run test:e2e

# Run in UI mode for debugging
npm run test:e2e:ui
```

### Backend Tests (pytest)
```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

Backend tests cover the number checker and the explanation service, using a fake Ollama server, so no model is needed.

E2E tests cover:
- Dashboard navigation
- Data entry workflows
- Chart interactions
- Theme switching

## ⚙️ Environment Variables

### Frontend (.env.local)

```env
VITE_API_URL=http://localhost:8000
VITE_API_CACHE_TTL_MS=30000
```

### Backend

No environment variables required for basic operation. Optional configuration:
- Database path (defaults to SQLite in project directory)
- `OLLAMA_BASE_URL`: Ollama service URL (defaults to `http://localhost:11434`). In Docker, use `http://host.docker.internal:11434` to reach Ollama on your machine.
- `OLLAMA_MODEL`: model name (defaults to `mistral`)
- `OLLAMA_TIMEOUT_SECONDS`: per-request timeout (defaults to `240`; Ollama handles one request at a time, so a request can wait behind another)

## 🎯 Key Features Explained

### Data Visualizations
- **Time Series Chart**: Interactive line charts showing visitation trends over time
- **Monthly Heatmap**: Calendar heatmap displaying monthly patterns
- **3D Rankings**: Three.js-powered 3D visualization of monthly park rankings

### Data Management
- Automatic CSV data import and processing
- SQLite database with efficient querying
- Pandas-based data transformation and aggregation

### State Management
- Zustand stores for theme and data state
- Persistent theme preference (localStorage)
- Optimized re-rendering with selectors

### Performance Optimizations
- Code splitting with dynamic imports
- Lazy loading of visualizations
- API response caching
- Debounced user inputs
- Minified production builds

## 🐳 Docker Deployment

The application is fully containerized for easy deployment:

```bash
# Build and start containers
docker-compose up --build

# Stop containers
docker-compose down

# View logs
docker-compose logs -f

# Rebuild specific service
docker-compose up --build frontend
```

Services configured:
- **frontend**: Vite dev server on port 5173
- **backend**: Uvicorn on port 8000
- **network**: Bridge network for inter-container communication

## 📊 Data Sources

The dashboard processes National Park Service visitation data from CSV files:
- Annual recreation visitation (1904-present)
- Monthly public use statistics
- Overnight stays data
- Recreation visitors by month

Data files are located in the `/data` directory and automatically loaded on backend startup.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🔗 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Vite Guide](https://vitejs.dev/guide/)
- [D3.js Examples](https://observablehq.com/@d3/gallery)
- [Three.js Documentation](https://threejs.org/docs/)
- [Ollama Documentation](https://ollama.ai/)
