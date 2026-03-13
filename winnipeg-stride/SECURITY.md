# Winnipeg Stride — Security Architecture & CIA Triad

---

## 1. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     WINNIPEG STRIDE ARCHITECTURE                    │
│                    (CIA Security Model Applied)                     │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────┐
  │   📱 Mobile App /    │   React Native (Expo)
  │      Web Client      │   • No API keys or secrets
  │                      │   • All requests → backend
  └──────────┬───────────┘
             │  HTTPS (recommended)
             ▼
  ┌──────────────────────────────────────────────┐
  │         🔒 SECURE BACKEND API GATEWAY        │
  │              (Node.js / Express)              │
  │                                              │
  │  ┌────────────┐ ┌──────────┐ ┌────────────┐ │
  │  │   CORS     │ │  Input   │ │  Security  │ │
  │  │  Control   │ │ Validate │ │  Headers   │ │
  │  └────────────┘ └──────────┘ └────────────┘ │
  │                                              │
  │  ┌──────────────────────────────────────┐    │
  │  │        .env (secrets vault)          │    │
  │  │  DEEPSEEK_API_KEY                    │    │
  │  │  WEATHER_API_KEY                     │    │
  │  │  WINNIPEG_TRANSIT_API_KEY            │    │
  │  └──────────────────────────────────────┘    │
  └────┬─────────┬──────────┬───────────┬────────┘
       │         │          │           │
       ▼         ▼          ▼           ▼
  ┌─────────┐ ┌──────┐ ┌────────┐ ┌──────────┐
  │Validated│ │ LLM  │ │Weather │ │ Cached   │
  │Open Data│ │Engine│ │ Proxy  │ │Responses │
  │ (CSV)   │ │(Deep │ │(10min  │ │(Fallback)│
  │         │ │ Seek)│ │ cache) │ │          │
  └─────────┘ └──────┘ └────────┘ └──────────┘
       │         │          │           │
       ▼         ▼          ▼           ▼
  ┌──────────────────────────────────────────┐
  │         TRUSTED DATA SOURCES             │
  │                                          │
  │  🏛️ Winnipeg Open Data Portal            │
  │     Parks · Recreation · Public Art      │
  │                                          │
  │  🗺️ OpenStreetMap (Overpass API)          │
  │     Restaurants · Arts & Culture         │
  │                                          │
  │  🤖 DeepSeek LLM API                     │
  │     Chat · Itinerary Narratives          │
  │                                          │
  │  🌤️ WeatherAPI.com                        │
  │     Current Winnipeg conditions          │
  └──────────────────────────────────────────┘
```

---

## 2. CIA Triad — How Winnipeg Stride Applies It

### 🔐 CONFIDENTIALITY — "Keep secrets secret"

| What we did | Where |
|---|---|
| All API keys stored in `.env`, git-ignored | `server/.env` |
| Frontend **never** holds API keys | `services/api.ts` — no secrets |
| Weather API proxied through backend | `server/routes/weather.js` |
| LLM calls made server-side only | `server/routes/chat.js` |
| Security headers (X-Content-Type-Options, X-Frame-Options) | `server/index.js` |
| CORS restricted to known origins | `server/index.js` |
| `.env.example` provided (no real keys) | `winnipeg-stride/.env.example` |

**Production recommendation:** Enforce HTTPS via TLS termination at the load balancer.

---

### 🛡️ INTEGRITY — "Trust but verify"

| What we did | Where |
|---|---|
| Coordinate bounds validation (Winnipeg bbox) | `server/data-loader.js` |
| Name length sanitization (max 200 chars) | `server/data-loader.js` |
| Chat message validation (type, length ≤1000) | `server/routes/chat.js` |
| Itinerary input validation (bounded stops, typed params) | `server/routes/itinerary.js` |
| Request body size limit (100kb) | `server/index.js` |
| LLM grounded to dataset — Winnie only recommends verified locations | `SYSTEM_PROMPT` in chat.js |
| Open Data treated as trusted source with schema validation | Data pipeline |

**Production recommendation:** Add checksum verification for CSV data files.

---

### 🟢 AVAILABILITY — "Always respond, never crash"

| What we did | Where |
|---|---|
| Weather API cached (10-minute TTL) | `server/routes/weather.js` |
| Static weather fallback if API is down | `server/routes/weather.js` |
| LLM fallback — template responses if DeepSeek fails | `server/routes/chat.js` |
| Graceful boot — server starts even if data load fails | `server/index.js` |
| CSV data loaded to memory (no runtime I/O) | `server/data-loader.js` |
| Multiple Overpass API fallback servers | `src/load_data.py` |
| Frontend fallback for all API errors | `services/api.ts` |

**Production recommendation:** Deploy behind a load balancer with auto-scaling. Add Redis cache layer for high-traffic scenarios.

---

## 3. Slide Content (for Presentation Deck)

### Slide Title: **Security by Design — CIA Triad**

**Visual:** Three pillars or shield icon

| Pillar | Principle | Winnipeg Stride Implementation |
|---|---|---|
| 🔐 **Confidentiality** | Protect sensitive data | API keys stored server-side only. Frontend never sees secrets. All external API calls proxied through our backend gateway. |
| 🛡️ **Integrity** | Ensure data accuracy | Open Data datasets validated on load (coordinate bounds, schema checks). User inputs sanitized. LLM grounded to verified Winnipeg locations only. |
| 🟢 **Availability** | Always be responsive | Cached responses (weather: 10min TTL). Graceful fallbacks if LLM or APIs fail. In-memory data for instant queries. Designed for cloud horizontal scaling. |

**Footer:** *"Enterprise-grade security patterns applied to a datathon prototype — ready to scale."*

---

## 4. Presentation Script (20–30 seconds)

> "Winnipeg Stride follows the CIA security model — Confidentiality, Integrity, and Availability.
>
> For **Confidentiality**, all API keys live on the server — the mobile app never touches secrets. External APIs like weather and our LLM are proxied through our backend gateway.
>
> For **Integrity**, we validate every dataset on load — coordinates must fall within Winnipeg bounds, and Winnie only recommends locations from verified Open Data sources.
>
> For **Availability**, we cache weather data, provide fallback responses when the LLM is offline, and load all location data into memory for instant queries. The architecture is stateless and ready to scale horizontally in the cloud."

---

## 5. Recommended Future Improvements

| Improvement | Effort | Impact |
|---|---|---|
| Rate limiting (express-rate-limit) | 5 min | Prevents API abuse |
| HTTPS enforcement | Config-only | Encrypts data in transit |
| Redis caching layer | 30 min | Handles high traffic |
| JWT authentication for user profiles | 2 hrs | Per-user data isolation |
| CSV checksum verification | 15 min | Detects data tampering |
| Structured logging (winston/pino) | 30 min | Security audit trail |
| Content Security Policy header | 5 min | Prevents XSS |

---

## 6. Files Changed (Summary)

### New Files
- `winnipeg-stride/server/routes/weather.js` — Weather proxy with caching + fallback
- `winnipeg-stride/.env.example` — Template for environment variables
- `winnipeg-stride/SECURITY.md` — This document

### Modified Files
- `winnipeg-stride/.env` — Consolidated all API keys
- `winnipeg-stride/.gitignore` — Added `.env` exclusion rules
- `winnipeg-stride/server/index.js` — CORS restriction, security headers, body size limit, weather route
- `winnipeg-stride/server/data-loader.js` — Coordinate bounds validation, name sanitization
- `winnipeg-stride/server/routes/chat.js` — Input type/length validation
- `winnipeg-stride/server/routes/itinerary.js` — Input bounds validation
- `winnipeg-stride/services/api.ts` — Removed hardcoded weather API key, proxied through backend
- `src/load_data.py` — Removed hardcoded transit API key fallback
