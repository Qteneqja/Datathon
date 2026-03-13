# Winnipeg Stride

**An AI-powered tourism platform that helps visitors and locals discover the best of Winnipeg through intelligent itinerary planning, real-time recommendations, and interactive mapping.**

Built with a full-stack architecture spanning a **Python analytics engine**, a **React Native mobile app**, and a **Node.js API server** — all powered by 1,000+ geolocated points of interest and a grounded LLM assistant.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Scoring Algorithms](#scoring-algorithms)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Datasets](#datasets)
- [Security](#security)
- [License](#license)

---

## Overview

Winnipeg Stride was built for **Datathon 2025** to answer one question: *"What's the best way to experience Winnipeg?"*

The platform combines **open civic data** (parks, transit, restaurants, public art, recreation) with a **composite tourism scoring model** and an **AI chat assistant (Winnie)** that generates personalized, grounded itineraries — never hallucinated recommendations.

### What makes it different

- **Data-first design** — Every recommendation is backed by a quantifiable tourism score, not vibes
- **Grounded AI** — Winnie only suggests real, verified Winnipeg locations with two-pass hallucination detection
- **Two interfaces** — A Streamlit analytics dashboard for exploration + a React Native mobile app for on-the-go use
- **Smart routing** — Nearest-neighbour ordering, time-slot mapping, and walk/drive mode detection based on Haversine distance

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     WINNIPEG STRIDE                         │
├──────────────────────┬──────────────────────────────────────┤
│   Analytics Engine   │         Mobile Platform              │
│   (Python)           │   (React Native + Express)           │
│                      │                                      │
│  ┌────────────────┐  │  ┌──────────┐    ┌───────────────┐  │
│  │  Streamlit UI  │  │  │ Expo App │◄──►│ Express API   │  │
│  │  (app.py)      │  │  │ (Tabs)   │    │ (server/)     │  │
│  └───────┬────────┘  │  └──────────┘    └──────┬────────┘  │
│          │           │                         │            │
│  ┌───────▼────────┐  │                  ┌──────▼────────┐  │
│  │ Scoring Engine │  │                  │  Data Loader  │  │
│  │ Itinerary Gen  │  │                  │  RAG-lite     │  │
│  │ LLM Interface  │  │                  │  Chat Engine  │  │
│  └───────┬────────┘  │                  └──────┬────────┘  │
│          │           │                         │            │
├──────────▼───────────┴─────────────────────────▼────────────┤
│                    Shared CSV Datasets                       │
│        (parks, restaurants, arts, recreation, transit)       │
├─────────────────────────────────────────────────────────────┤
│                  DeepSeek LLM API (optional)                │
│            Winnipeg Transit API  ·  Weather API             │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Analytics Dashboard** | Python 3.11+, Streamlit, Pandas, NumPy, GeoPandas, Folium, Plotly, scikit-learn |
| **Mobile Frontend** | React Native (Expo), TypeScript, Expo Router, AsyncStorage |
| **API Server** | Node.js, Express, CORS, dotenv, csv-parse |
| **AI / NLP** | DeepSeek Chat API with grounded RAG-lite retrieval |
| **Data Sources** | Winnipeg Open Data, OpenStreetMap Overpass API |
| **Geospatial** | Haversine distance, KMeans clustering, Folium heatmaps |

---

## Features

### AI Chat Assistant ("Winnie")
- Conversational itinerary planning with natural language input
- **RAG-lite grounding** — retrieves relevant locations by keyword, scores by tourist appeal, injects top-15 into LLM context
- **Two-pass hallucination detection** — validates LLM output against verified location database; retries with stricter constraints if fabricated names appear
- Intent detection: *"night out"* filters parks, *"surprise me"* picks a random neighbourhood, *"driving"* switches to drive-mode
- Graceful degradation: works fully without API key via templated responses

### Smart Itinerary Engine
- **One-day optimizer** — greedy selection by tourism score with category diversity enforcement (max 2 per category)
- **Multi-day planner** — generates N-day plans by iteratively filtering used locations
- **Time-slot mapping** — coffee shops → morning, restaurants → evening, arts → afternoon
- **Nearest-neighbour routing** — orders stops to minimize backtracking across the city
- **Transport mode detection** — Haversine-based: <800m triggers walk mode, >800m suggests driving with time estimates

### Interactive Analytics Dashboard
- Folium heatmap with per-category layer toggle
- Real-time scoring weight sliders (adjust the 4 tourism-score components live)
- Neighbourhood labels across 40+ Winnipeg areas
- Time-of-day and season filters (Morning/Afternoon/Evening, Summer/Winter/All-Season)
- User preference profiles: outdoor, indoor, family-friendly, transit-close, hidden gems

### Mobile App (React Native)
- **5-tab interface** — Chat, Explore, Map, Saved, Profile
- Full-text search with category and neighbourhood filtering
- Bookmark system with AsyncStorage persistence
- Itinerary cards showing stops, walk times, and per-stop category reasoning
- Follow-up quick-action chips (*"Add dinner"*, *"Show parking"*, *"Replace a stop"*)
- Weather-aware context injection

---

## Scoring Algorithms

### Per-Location Tourism Score (0–100)

A composite index that quantifies how visit-worthy each location is:

```
tourism_score =  0.35 × popularity
               + 0.25 × transit_accessibility
               + 0.20 × category_diversity
               + 0.20 × location_cluster_density
```

| Component | Calculation |
|-----------|-------------|
| **Popularity** | Count of non-transit attractions within 1 km, min-max normalized |
| **Transit Accessibility** | Inverse distance to nearest transit stop (capped at 3 km) |
| **Category Diversity** | Count of unique attraction types within 1 km |
| **Cluster Density** | Total neighbour count within 1 km |

All weights are tunable in real time via the dashboard or in `src/config.py`.

### Grid-Based Experience Score

Divides Winnipeg into a 30×30 grid and scores each cell by weighted category density:

```
Experience Score = 3.0 × Parks + 3.0 × Recreation + 2.5 × Arts & Culture
                 + 2.0 × Public Art + 2.0 × Restaurants + 1.0 × Transit
```

### Hotspot Detection

KMeans clustering (k=8) identifies Winnipeg's top activity centres, each labelled with a dominant category.

---

## Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |

### Option A — Analytics Dashboard (Python)

```bash
# Clone the repository
git clone https://github.com/<your-username>/winnipeg-stride.git
cd winnipeg-stride

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# (Optional) Add your DeepSeek API key for AI features
# Create .streamlit/secrets.toml:
#   DEEPSEEK_API_KEY = "sk-..."

# Launch the dashboard
streamlit run app.py
```

### Option B — Mobile App (React Native + Express)

```bash
# Install frontend dependencies
cd winnipeg-stride
npm install

# Install backend dependencies
cd server
npm install
cd ..

# Configure environment
cp .env.example .env
# Edit .env and add your API keys

# Start the Express API (port 3001)
npm run server

# In a new terminal — start the Expo app
npm run web
```

The app opens at **http://localhost:8081**.

---

## Project Structure

```
├── app.py                        # Streamlit analytics dashboard
├── requirements.txt              # Python dependencies
├── src/                          # Python analytics engine
│   ├── config.py                 #   Scoring weights & constants
│   ├── load_data.py              #   API fetchers + CSV caching
│   ├── clean.py                  #   Coordinate extraction & merging
│   ├── scoring.py                #   Tourism Score + Experience Grid
│   ├── itinerary.py              #   Smart multi-day planner
│   ├── mapping.py                #   Folium maps + Plotly charts
│   ├── llm_interface.py          #   DeepSeek LLM with hallucination guard
│   ├── filters.py                #   Time-of-day & season filters
│   ├── neighbourhoods.py         #   40+ neighbourhood assignment
│   ├── preferences.py            #   User preference scoring
│   ├── routing.py                #   Walking-time estimates
│   └── transit_utils.py          #   Nearest transit-stop calculator
├── data/                         # Open datasets (CSV)
│   ├── all_locations_merged.csv
│   ├── parks.csv
│   ├── restaurants.csv
│   ├── arts_culture.csv
│   ├── recreation.csv
│   └── transit_stops.csv
├── winnipeg-stride/              # React Native mobile app
│   ├── app/                      #   Expo Router screens (5 tabs)
│   ├── components/               #   Reusable UI components
│   ├── constants/                #   Colours, config, static data
│   ├── services/                 #   API client + AsyncStorage
│   ├── types/                    #   TypeScript interfaces
│   └── server/                   #   Express.js backend
│       ├── index.js              #     Entry point + middleware
│       ├── data-loader.js        #     CSV ingestion + scoring
│       └── routes/               #     REST API endpoints
│           ├── chat.js           #       RAG-lite chat
│           ├── itinerary.js      #       Itinerary generation
│           ├── locations.js      #       Location search/filter
│           └── weather.js        #       Weather proxy + cache
└── EDA_All_Datasets.ipynb        # Exploratory data analysis
```

---

## API Reference

### Express Server (port 3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send a message to Winnie (RAG-lite grounded chat) |
| `POST` | `/api/itinerary` | Generate an optimized itinerary with preferences |
| `POST` | `/api/itinerary/surprise` | Random neighbourhood itinerary |
| `GET` | `/api/locations` | Browse/filter 1,000+ locations |
| `GET` | `/api/weather` | Current Winnipeg weather (10-min cache) |

### Chat Request

```json
{
  "message": "Plan a night out downtown",
  "history": [{ "role": "user", "content": "..." }],
  "preferences": ["outdoor", "family"]
}
```

### Itinerary Request

```json
{
  "preferences": ["outdoor", "hidden_gems"],
  "neighbourhood": "Exchange District",
  "numStops": 5,
  "radius": 2
}
```

---

## Datasets

| Dataset | Source | Records | Category |
|---------|--------|---------|----------|
| Parks | Winnipeg Open Data | 300+ | Park |
| Restaurants | OpenStreetMap Overpass | 400+ | Restaurant |
| Arts & Culture | Winnipeg Open Data | 100+ | Arts & Culture |
| Recreation | Winnipeg Open Data | 100+ | Recreation |
| Transit Stops | Winnipeg Open Data | 200+ | Transit |

All data is publicly available. CSV files are included in `data/` for offline use.

---

## Security

- **API keys** are stored in `.env` / `.streamlit/secrets.toml` (git-ignored, never committed)
- **CORS** is restricted to known development origins
- **Input validation** on all API endpoints (message length, history size, coordinate bounds)
- **LLM grounding** prevents the AI from recommending non-existent locations
- **Security headers** applied (X-Content-Type-Options, X-Frame-Options)
- **Weather proxy** avoids exposing third-party API keys to the client

See [winnipeg-stride/SECURITY.md](winnipeg-stride/SECURITY.md) for the full CIA triad analysis.

---

## License

Datathon 2025 submission.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | No | Enables AI descriptions and chat assistant |
| `DEEPSEEK_BASE_URL` | No | Override API endpoint (default: `https://api.deepseek.com`) |
| `DEEPSEEK_MODEL` | No | Override model name (default: `deepseek-chat`) |
