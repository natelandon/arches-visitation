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
- Ollama service URL (defaults to `http://localhost:11434`)

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
