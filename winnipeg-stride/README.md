# Winnipeg Stride 🦬

**AI-powered walking-tour companion for Winnipeg, MB.**  
Built for Datathon 2025 with React Native (Expo), Express.js, and DeepSeek.

---

## Prerequisites

| Tool    | Version |
|---------|---------|
| Node.js | ≥ 18    |
| npm     | ≥ 9     |

## Quick Start

```bash
# 1  Install frontend dependencies
cd winnipeg-stride
npm install

# 2  Install backend dependencies
cd server
npm install
cd ..

# 3  Add your DeepSeek API key  (edit .env)
#    DEEPSEEK_API_KEY=sk-...

# 4  Start the Express API server (port 3001)
npm run server

# 5  In another terminal, start the Expo web app
npm run web
```

The app opens at **http://localhost:8081** (or the port Expo selects).

## Project Structure

```
winnipeg-stride/
├── app/                  # Expo Router screens
│   ├── _layout.tsx       # Root stack
│   └── (tabs)/
│       ├── _layout.tsx   # Bottom tab navigator
│       ├── index.tsx     # Winnie Chat (home)
│       ├── explore.tsx   # Location discovery feed
│       ├── map.tsx       # Map view
│       ├── saved.tsx     # Saved itineraries & bookmarks
│       └── profile.tsx   # User preferences
├── components/           # Reusable UI components
├── constants/            # Colors (Winnipeg flag palette) & config
├── services/             # API client & AsyncStorage helpers
├── types/                # TypeScript interfaces
└── server/               # Express backend
    ├── index.js          # Entry point
    ├── data-loader.js    # CSV loading + scoring
    └── routes/           # REST endpoints
```

## Key Features

- **Winnie** — AI chat assistant powered by DeepSeek with RAG-lite context
- **Explore** — Browse 1 000+ Winnipeg locations with category & neighbourhood filters
- **Map** — Category-coloured markers with walking directions
- **Saved** — Persist itineraries & bookmark favourite locations
- **Profile** — Interest toggles that personalise Winnie's recommendations

## Data

CSV datasets live in `../data/` (the parent Datathon folder):
- `all_locations_merged.csv`
- `parks.csv`, `restaurants.csv`, `arts_culture.csv`, `recreation.csv`
- `transit_stops.csv`

## Colour Palette (Winnipeg Flag)

| Swatch | Hex       | Usage           |
|--------|-----------|-----------------|
| 🟦     | `#3D5BA7` | Primary blue    |
| 🟡     | `#F5B312` | Accent gold     |
| 🔵     | `#213167` | Navy / dark     |
| ⬜     | `#FFFFFF` | Background      |
| 🟢     | `#08C44A` | Park category   |
| 🟣     | `#9484BE` | Arts category   |

## Scripts

| Script        | Description                          |
|---------------|--------------------------------------|
| `npm start`   | Start Expo dev server                |
| `npm run web` | Start Expo for web                   |
| `npm run server` | Start Express API on port 3001    |

## License

Datathon 2025 submission — not licensed for redistribution.
