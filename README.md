# Explore Winnipeg — Smart City Discovery Tool

A data-driven prototype that identifies areas with the highest density of experiences in Winnipeg and helps users find things to do nearby.

## Quick Start

```bash
# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the Streamlit dashboard
streamlit run app.py

# Or run the notebook
jupyter notebook explore_winnipeg.ipynb
```

## Project Structure

```
Datathon/
├── assets/                  # Background images (optional — graceful fallback)
├── data/                    # Cached datasets (auto-populated on first run)
├── output/                  # Generated maps & reports
├── src/
│   ├── __init__.py
│   ├── config.py            # Central weights & constants
│   ├── load_data.py         # API fetchers + CSV caching
│   ├── clean.py             # Coordinate extraction & data merging
│   ├── scoring.py           # Experience Score grid + Tourism Score (0–100)
│   ├── mapping.py           # Folium maps + Plotly charts
│   ├── itinerary.py         # Smart itinerary generators (1-day / multi-day)
│   ├── transit_utils.py     # Nearest transit-stop distance calculator
│   ├── filters.py           # Time-of-day & season heuristic filters
│   ├── neighbourhoods.py    # Neighbourhood assignment by nearest centroid
│   ├── preferences.py       # User preference scoring (outdoor, family, etc.)
│   ├── routing.py           # Walking-time estimates between stops
│   └── llm_interface.py     # DeepSeek LLM for AI descriptions & chat
├── app.py                   # Streamlit dashboard
├── explore_winnipeg.ipynb   # Main notebook — run this
├── requirements.txt
└── README.md
```

## Datasets

| Dataset | Source | Category |
|---------|--------|----------|
| Parks | Winnipeg Open Data | Park |
| Recreation Facilities | Winnipeg Open Data | Recreation |
| Public Art | Winnipeg Open Data | Public Art |
| Transit Stops | Winnipeg Open Data | Transit |
| Restaurants | OpenStreetMap Overpass | Restaurant |

Data is fetched from APIs on first run and cached locally in `data/`.

## Scoring

### Per-Location Tourism Score (0–100)

```
tourism_score =
    0.35 × popularity
  + 0.25 × transit_accessibility
  + 0.20 × category_diversity
  + 0.20 × location_cluster
```

Weights are tunable via sidebar sliders or in `src/config.py`.

### Grid-based Experience Score

```
Experience Score = 3×Parks + 3×Recreation + 2×Public Art + 2×Restaurants + 1×Transit + 2.5×Arts & Culture
```

## Features

- **Interactive heatmap** with per-category layer toggle
- **Multi-day itinerary generator** with nearest-neighbour routing
- **One-day trip planner** with time-slot mapping (Morning → Evening)
- **Neighbourhood labels** for every location (40+ Winnipeg neighbourhoods)
- **Walking time estimates** between itinerary stops
- **Time-of-day & season filters** (Morning/Afternoon/Evening, Summer/Winter/All-Season)
- **User preferences** (outdoor, indoor, family-friendly, transit-close, hidden gems)
- **Scoring weight sliders** — adjust the four tourism-score components in real time
- **AI descriptions** powered by DeepSeek (optional; templated fallback)
- **Chat assistant** — ask questions about Winnipeg attractions

## Outputs

- **Interactive map** (`output/explore_winnipeg_map.html`)
- **Itinerary maps** (`output/itinerary_day{N}_map.html`)
- **Plotly charts** — category breakdown, score density

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | No | Enables AI descriptions and chat assistant |
| `DEEPSEEK_BASE_URL` | No | Override API endpoint (default: `https://api.deepseek.com`) |
| `DEEPSEEK_MODEL` | No | Override model name (default: `deepseek-chat`) |
