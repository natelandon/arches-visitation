# Arches Visitation Analytics

A dashboard of visitor numbers for Arches National Park, from 1929 to the latest full year. It shows yearly trends, a month-by-month heatmap, and a breakdown of the most recent year, and it explains each chart in plain language using a local AI model (Mistral, via Ollama). Every number in an AI explanation is checked against the data before it is shown.

- **Frontend:** React 18, TypeScript 5, Vite 6, D3 7, Zustand 4, Tailwind CSS 3
- **Backend:** FastAPI, SQLAlchemy 2, pandas, SQLite
- **AI (optional):** Ollama running Mistral locally

## What's on the dashboard

| Tab | Shows |
| --- | --- |
| **Overview** | Total visitors, 10-year average, biggest growth and decline years, and a chart of yearly totals |
| **Monthly Heatmap** | Every month of every year as a grid, colored by visitor count. It can switch to show each year's peak and low months |
| **Stats** (labeled "2025 Stats") | The latest full year: annual summary, a month picker with that month's figures, and a "Visitors by month" chart. Click a column to select its month |
| **Add Data** | Add, edit, or delete daily visitor counts for the current year. During the first week of January, last year's dates are allowed too |

Each chart tab ends with **Key Insights**, the AI explanation (see [AI explanations](#ai-explanations)).

## Requirements

- **Node.js 22.12 or newer** (see `.nvmrc`)
- **Python 3.11 or 3.12.** Python 3.13 won't work: the pinned pandas 2.1.1 doesn't build on it.
- **Ollama with Mistral** (optional): only needed for AI explanations. Everything else works without it.

## Getting started

### 1. Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --timeout-graceful-shutdown 5
```

The API runs at <http://localhost:8000>, with interactive docs at <http://localhost:8000/docs>.

`--timeout-graceful-shutdown 5` matters during development: an AI explanation can take minutes, and without it, auto-reload waits for that request to finish before restarting.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

### 3. AI explanations (optional)

```bash
# Install Ollama from https://ollama.com, then:
ollama pull mistral
ollama serve        # skip if the Ollama app is already running
```

The backend finds Ollama at `http://localhost:11434` automatically. Without it, each chart shows how to set it up, and everything else still works.

### Shortcut script

`./dev.sh` wraps a few common commands: `install`, `dev` (starts backend and frontend together), `dev-docker`, `db-status`, `db-reset`, and `clean`. Note that `install` uses whatever `pip` is on your path rather than a virtual environment, and that `db-reset` and `clean` **delete the database** (see [Data](#data)).

## AI explanations

Explanations run on your own machine. On a laptop CPU, Mistral takes about **1–2 minutes** per explanation, and up to twice that if it needs a retry. After that the explanation is cached and loads instantly.

### How explanations are checked

The model isn't trusted to get numbers right (see `backend/ai_service.py`):

1. **Clear data in.** Each chart sends the model a small summary with plainly named fields (for example `biggest_drop.visitors_lost`, or `average_per_year_last_10_years`), not raw API output.
2. **Structured answer out.** Ollama is given a JSON schema, so the model must return a short `summary` and up to 4 `claims`. Each claim states a number and names the data field it came from. Temperature is 0, so the same data gets the same answer.
3. **Every number is checked.** A claim passes only if the number written in its sentence matches the field it cites, allowing for rounding ("1.8 million" matches 1,806,865). Any other number in the summary is checked against the data too.
4. **One retry.** If a claim is wrong or cites a field that doesn't exist, the model is told exactly what was wrong and tries once more.
5. **Shown honestly.** Each explanation says whether every number matched, some couldn't be checked, or some didn't match. Click that line to see each claim.

The backend also:

- **Removes field names** the model copies into its text, such as "(record_year.visitors)".
- **Explains 2020.** Any explanation that covers 2020 says that year's drop was an aberration caused by the park's two-month COVID-19 closure, not part of the long-term trend.
- **Treats other causes as likely.** The model is told to present other causes, such as weather or holidays, as likely factors rather than facts.

### Caching

Explanations are saved in the `explanation_cache` table of `backend/arches.db` (see `backend/explanation_cache.py`):

- **Only fully verified explanations are saved.** Anything with an unmatched or unchecked number is generated again next time.
- **They update themselves.** The cache key covers the model name and the full prompt, which includes the chart data. New data, a different `OLLAMA_MODEL`, or an edited prompt get a fresh explanation. If you change how answers are processed after the model replies, bump `CACHE_VERSION` in `explanation_cache.py`.
- **One run per chart.** Two requests for the same chart share one model run, and a run that's already started finishes and is saved even if the browser leaves the page.
- **Cached explanations still load when Ollama is stopped.**
- **To clear the cache:** `sqlite3 backend/arches.db "DELETE FROM explanation_cache"`

## Data

The figures are National Park Service visitation statistics for Arches National Park:

- **Monthly visitors, 1979 onward:** `Recreation Visitors By Month (1979 - Last Calendar Year).csv`
- **Yearly totals for earlier years:** `Annual Park Recreation Visitation (1904 - Last Calendar Year).csv`. These fill in the years before monthly figures exist.

On startup, the backend loads any CSV in `data/` that isn't in the database yet.

**The database is the copy in git.** The CSVs in `data/` are git-ignored, but `backend/arches.db` is committed. So on a fresh clone, the database is the only copy of the data. `./dev.sh db-reset` and `./dev.sh clean` delete it, and with no CSVs it can't be rebuilt. To get it back:

```bash
git checkout backend/arches.db
```

**Corrections:** January 2025 is 31,944 visitors. The NPS CSV this project was built from says 31,870.

## Development

### Commands

```bash
# Frontend (in frontend/)
npm run dev          # dev server on http://localhost:5173
npm run build        # production build into dist/
npm run preview      # serve the production build
npm run lint         # ESLint 9 (config: eslint.config.js)
npm run test         # unit tests (Vitest), watch mode
npx vitest run       # unit tests, once
npm run test:e2e     # end-to-end tests (Playwright)

# Backend (in backend/, with the virtual environment active)
pip install -r requirements-dev.txt
python -m pytest     # unit tests
```

### Tests

- **Frontend unit tests** (Vitest + Testing Library) cover components, stores, and the data summaries sent to the AI.
- **Backend tests** (pytest) cover the number checker, the explanation service, the cache, and the API endpoint. They use a fake Ollama server and an in-memory database, so no model is needed and your real database isn't touched.
- **End-to-end tests** (Playwright) cover the tabs (including keyboard use), each chart, selecting a month from the chart, the data entry form, the theme toggle, and phone width. They need the backend running on port 8000, and they start the frontend dev server if it isn't running. The AI endpoints are mocked, so the tests take seconds rather than minutes. Run `npx playwright install chromium` once to download the browser they use.

### Project structure

```
arches-visitation/
├── backend/
│   ├── main.py               # FastAPI app and endpoints
│   ├── ai_service.py         # prompts, Ollama calls, number checking
│   ├── explanation_cache.py  # SQLite cache for verified explanations
│   ├── data_loader.py        # loads the CSVs into SQLite
│   ├── database.py           # SQLAlchemy models
│   ├── arches.db             # the data (committed)
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/       # dashboard, charts, AI explanation, data entry
│   │   ├── utils/            # data summaries for the AI, formatting
│   │   ├── store/            # Zustand stores (data, theme, explanations)
│   │   ├── config/api.ts     # API endpoints and the GET response cache
│   │   └── types/
│   ├── tests/e2e/            # Playwright tests
│   └── eslint.config.js
├── data/                     # NPS CSVs (git-ignored)
├── dev.sh
└── docker-compose.yml
```

## Configuration

**Frontend:** copy `frontend/.env.example` to `frontend/.env.local`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:8000` | Backend address |
| `VITE_API_CACHE_TTL_MS` | `30000` | How long GET responses are reused in the browser |

**Backend:** all optional:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Where Ollama runs |
| `OLLAMA_MODEL` | `mistral` | Model used for explanations |
| `OLLAMA_TIMEOUT_SECONDS` | `240` | Per-request limit. Ollama handles one request at a time, so a request can wait behind another |

## Docker

```bash
docker compose up --build
```

This runs the frontend on port 5173 (Node 22) and the backend on port 8000 (Python 3.11), using the same `backend/arches.db` as a local setup. Stop any local dev servers first, because they use the same ports.

For AI explanations, run Ollama on your own machine as usual: the backend container reaches it at `host.docker.internal:11434`.

## API

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/visitation/stats` | Headline statistics (excludes the current year) |
| GET | `/visitation/annual` | Total visitors per year |
| GET | `/visitation/timeseries` | Total visitors per month |
| GET | `/visitation/heatmap` | Month-by-year grid |
| GET | `/visitation/daily?year=` | Daily entries for a year |
| POST | `/visitation/entry` | Add or update a daily entry |
| DELETE | `/visitation/entry/{id}` | Delete a daily entry |
| POST | `/api/ai/explain-chart` | AI explanation for a chart, with its checks |
| GET | `/api/ai/status` | Whether Ollama is reachable |
| GET | `/health` | Backend health and record count |

## License

[MIT](LICENSE)
