# Arches Visitation Analytics Dashboard

A modern, full-stack analytics dashboard for visualizing park visitation data with AI-powered insights. Built with React, TypeScript, FastAPI, and Three.js for interactive 3D visualizations.

## 🚀 Features

- **React 18 + TypeScript**: Type-safe, modern frontend
- **Vite**: Lightning-fast build tool and dev server
- **D3.js & Three.js**: Interactive data visualizations and 3D charts
- **AI-Powered Insights**: Mistral LLM integration with explanation caching
- **Zustand State Management**: Efficient, lightweight state management
- **Tailwind CSS**: Beautiful, responsive design
- **FastAPI Backend**: High-performance Python web framework
- **Comprehensive Testing**: Vitest (unit) + Playwright (E2E)
- **SQLite Database**: Auto-initialized data storage
- **Dark/Light Theme**: Accessible UI with theme switching

## 📋 Prerequisites

- **Python 3.8+** (for backend)
- **Node.js 16+** (for frontend# Arches Visitation Analytics Dashboard

A modern, full-stack analytics dk 
A modern, full-stack analytics dashbo`ba
## 🚀 Features

- **React 18 + TypeScript**: Type-safe, modern frontend
- **Vite**: Lightning-fast build tool and dev server
- **D3.js & Three.js**: Interactive data visualizations and 3fsS
- **Re://ollama.a- **Vite**: Lightning-fast build tool and dev server
-ro- **D3.js & Three.js**: Interactive data visualizaton- **AI-Powered Insights**: Mistral LLM integration with explanation in- **Zustand State Management**: Efficient, lightweight state management
-  F- **Tailwind CSS**: Beautiful, responsive design
- **FastAPI Backend**:/- **FastAPI Backend**: High-performance Python : - **Comprehensive Testing**: Vitest (unit) + Playwrightt Test- **SQLite Database**: Auto-initialized data storage
- **Darnd- **Danation caching
- React component behavior
- Sta
## 📋 Prerequisites

- **Python 3.8+** (for backend)
-run
- **Python 3.8+** (ver- **Node.js 16+** (for frontenen
A modern, full-stack analytics dk 
A modern, full-stack analytics da frA modern, full-stack analytics da# ## 🚀 Features

- **React 18 + TypeScta
- **React??─ fr- **Vite**: Lightning-fast build tool and dev server
-ip- **D3.js & Three.js**: Interactive data visualizaten- **Re://ollama.a- **Vite**: Lightning-fast build tool and dev ??ro- **D3.js & Three.js**: Interactive data visualizaton- **AI-Powerha-  F- **Tailwind CSS**: Beautiful, responsive design
- **FastAPI Backend**:/- **FastAPI Backend**: High-performance Python : - **Comprehensive Testing**: Vitest (unit) + Playwrightt Test- **SQLite??- **FastAPI Backend**:/- **FastAPI Backend**: High-I - **Darnd- **Danation caching
- React component behavior
- Sta
## 📋 Prerequisites

- **Python 3.8+** (for backend)
-run
# Arches Visitation Analytics Dashboard

A full-stack analytics dashboard for visualizing park visitation data with interactive charts and AI-powered insights. Built with React, TypeScript, FastAPI, D3, and Three.js.

## Highlights

- React 18 + TypeScript frontend
- Vite build system
- D3 and Three.js visualizations
- AI-powered explanations (Ollama/Mistral)
- Zustand state management
- Tailwind CSS styling
- FastAPI backend
- Vitest unit tests + Playwright E2E tests
- SQLite storage
- Dark/light theme

## Requirements

- Node.js 22.12+ (see .nvmrc)
- Python 3.8+

## Quick Start

### 1) Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn main:app --reload
```

Backend runs at http://localhost:8000

### 2) Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Frontend runs at http://127.0.0.1:5173

## AI Explanations (Optional)

Install Ollama and the Mistral model:

```bash
ollama pull mistral
ollama serve
```

The frontend will call:
- POST /api/ai/explain-chart
- GET /api/ai/status

## Project Layout

```
arches-visitation/
  backend/
  frontend/
  data/
  .nvmrc
```

## Frontend Scripts

```bash
npm run dev          # start dev server
npm run build        # production build
npm run preview      # preview build
npm run test         # unit tests
npm run test:e2e     # E2E tests
```

## Testing

- Unit tests: Vitest
- E2E tests: Playwright

```bash
cd frontend
npm run test
npm run test:e2e
```

## Environment Variables

Frontend (.env.local):

```
VITE_API_URL=http://localhost:8000
VITE_API_CACHE_TTL_MS=30000
```

## Notes

- The frontend uses proxying for /api requests in dev.
- Production builds are minified and chunked for faster loading.

## License

MIT
- **Python 3.8+** (ver- *um- * }A modeex-ve
