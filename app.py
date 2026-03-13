"""
Explore Winnipeg — Smart Tourism Planner
Streamlit application for the Winnipeg Smart City Datathon.

Run with:
    streamlit run app.py
"""

import os
import base64
import pathlib
import streamlit as st
import pandas as pd
from streamlit_folium import st_folium


# ---------------------------------------------------------------------------
# Image helper — loads assets as base64 data-URIs for CSS backgrounds
# ---------------------------------------------------------------------------

ASSETS_DIR = pathlib.Path(__file__).parent / "assets"


@st.cache_data(show_spinner=False)
def _img_to_data_uri(filename: str) -> str:
    """Return a base64 data URI for *filename* inside assets/, or '' if missing."""
    path = ASSETS_DIR / filename
    if not path.exists():
        return ""
    data = path.read_bytes()
    ext = path.suffix.lstrip(".").lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "webp": "image/webp", "svg": "image/svg+xml"}.get(ext, "image/jpeg")
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="Explore Winnipeg — Smart Tourism Planner",
    page_icon="🍁",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Imports from local pipeline
# ---------------------------------------------------------------------------

from src.load_data import load_from_csv
from src.clean import merge_all
from src.transit_utils import add_transit_distances
from src.scoring import compute_tourism_scores, score_grid, find_hotspots
from src.mapping import (
    create_base_map,
    add_locations,
    add_heatmap,
    CATEGORY_COLORS,
)
from src.itinerary import (
    generate_one_day_itinerary,
    generate_multi_day_itinerary,
    build_itinerary_map,
    generate_itinerary_description,
    generate_smart_description,
    format_one_day_itinerary,
)
from src.llm_interface import deepseek_available, chat_reply
from src.config import TOURISM_WEIGHTS as DEFAULT_TOURISM_WEIGHTS
from src.filters import apply_time_season_filters, ALL_TIMES, ALL_SEASONS
from src.neighbourhoods import assign_neighbourhood
from src.preferences import apply_preferences, PREFERENCE_OPTIONS
from src.routing import add_walk_times

# ---------------------------------------------------------------------------
# Load background images (graceful fallback to CSS gradients)
# ---------------------------------------------------------------------------
# Place your Winnipeg images in assets/:
#   hero_skyline.jpg   — Esplanade Riel / sunset skyline (header background)
#   night_skyline.jpg  — nighttime aerial view (page background)
#   city_grid.jpg      — digital smart-city grid (map section accent)
#   downtown.jpg       — downtown close-up (sidebar accent)
# ---------------------------------------------------------------------------

_hero_uri = _img_to_data_uri("hero_skyline.jpg")
_night_uri = _img_to_data_uri("night_skyline.jpg")
_grid_uri = _img_to_data_uri("city_grid.jpg")
_downtown_uri = _img_to_data_uri("downtown.jpg")

# Build dynamic CSS fragments (image vs gradient fallback)
_page_bg_image = (
    f'background-image: url("{_night_uri}");'
    if _night_uri
    else ""
)

_hero_bg_image = (
    f'background-image: url("{_hero_uri}");'
    if _hero_uri
    else ""
)

_grid_bg_image = (
    f'background-image: url("{_grid_uri}");'
    if _grid_uri
    else ""
)

_sidebar_bg_image = (
    f'background-image: url("{_downtown_uri}");'
    if _downtown_uri
    else ""
)

# ---------------------------------------------------------------------------
# CSS — Dark Glassmorphism Theme with Imagery
# ---------------------------------------------------------------------------

st.markdown(
    f"""
<style>
/* ---- Google Fonts ---- */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

/* ---- Root variables ---- */
:root {{
    --bg-primary: #060a14;
    --bg-secondary: #0b1024;
    --bg-card: rgba(12, 18, 36, 0.72);
    --bg-glass: rgba(14, 20, 42, 0.62);
    --bg-glass-light: rgba(25, 35, 65, 0.45);
    --border-glass: rgba(100, 130, 220, 0.12);
    --border-glass-hover: rgba(124, 92, 252, 0.3);
    --text-primary: #edf0f7;
    --text-secondary: #8b95b0;
    --text-muted: #525e78;
    --accent-purple: #7c5cfc;
    --accent-purple-glow: rgba(124, 92, 252, 0.3);
    --accent-orange: #f97316;
    --accent-orange-glow: rgba(249, 115, 22, 0.35);
    --accent-cyan: #22d3ee;
    --accent-cyan-glow: rgba(34, 211, 238, 0.2);
    --accent-green: #34d399;
    --accent-pink: #f472b6;
    --shadow-card: 0 8px 32px rgba(0,0,0,0.5);
    --shadow-glow: 0 0 40px rgba(124,92,252,0.15);
    --shadow-deep: 0 16px 64px rgba(0,0,0,0.6);
    --radius-xl: 20px;
    --radius-lg: 16px;
    --radius-md: 12px;
    --radius-sm: 8px;
}}

/* ============================================================
   PAGE BACKGROUND — night skyline with dark overlay
   ============================================================ */
.stApp {{
    {_page_bg_image}
    background-size: cover;
    background-position: center top;
    background-attachment: fixed;
    background-repeat: no-repeat;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}}

/* Dark overlay so text stays readable over photo */
.stApp::before {{
    content: "";
    position: fixed;
    inset: 0;
    background: linear-gradient(
        175deg,
        rgba(6,10,20,0.88) 0%,
        rgba(10,16,32,0.82) 30%,
        rgba(8,12,24,0.86) 70%,
        rgba(6,10,20,0.92) 100%
    );
    z-index: 0;
    pointer-events: none;
}}

/* Ensure content renders above the overlay */
[data-testid="stAppViewContainer"] {{
    position: relative;
    z-index: 1;
}}
[data-testid="stHeader"] {{
    background: transparent !important;
}}

/* Container tuning */
.block-container {{
    padding-top: 0.5rem !important;
    padding-bottom: 1rem !important;
    max-width: 100% !important;
}}

/* ============================================================
   SIDEBAR — with optional downtown skyline accent
   ============================================================ */
[data-testid="stSidebar"] {{
    background: linear-gradient(180deg, #080d1e 0%, #0c1228 100%) !important;
    border-right: 1px solid var(--border-glass) !important;
    position: relative;
    z-index: 2;
}}

/* Faint photo at sidebar bottom */
[data-testid="stSidebar"]::after {{
    content: "";
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 200px;
    {_sidebar_bg_image}
    background-size: cover;
    background-position: center bottom;
    opacity: 0.08;
    mask-image: linear-gradient(to bottom, transparent 0%, black 100%);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 100%);
    pointer-events: none;
}}

[data-testid="stSidebar"] [data-testid="stMarkdown"] {{
    color: var(--text-primary) !important;
}}
[data-testid="stSidebar"] .stSelectbox label,
[data-testid="stSidebar"] .stCheckbox label,
[data-testid="stSidebar"] .stRadio label {{
    color: var(--text-secondary) !important;
    font-weight: 500 !important;
}}

/* ---- Sidebar logo ---- */
.sidebar-logo {{
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.5px;
    margin-bottom: 0.2rem;
    line-height: 1.15;
}}
.sidebar-subtitle {{
    color: var(--text-muted);
    font-size: 0.75rem;
    margin-bottom: 1.5rem;
    line-height: 1.4;
}}

/* Sidebar section dividers */
.sidebar-section-label {{
    color: var(--text-secondary);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-top: 1.4rem;
    margin-bottom: 0.4rem;
    padding-bottom: 0.3rem;
    border-bottom: 1px solid var(--border-glass);
}}

/* ---- Buttons ---- */
[data-testid="stSidebar"] .stButton > button,
.stButton > button[kind="primary"] {{
    background: linear-gradient(135deg, var(--accent-orange), #e05a00) !important;
    color: #fff !important;
    border: none !important;
    border-radius: var(--radius-sm) !important;
    font-weight: 600 !important;
    font-size: 0.88rem !important;
    padding: 0.65rem 1.5rem !important;
    box-shadow: 0 6px 20px var(--accent-orange-glow) !important;
    transition: all 0.2s ease !important;
    width: 100% !important;
    letter-spacing: 0.2px;
}}
[data-testid="stSidebar"] .stButton > button:hover,
.stButton > button[kind="primary"]:hover {{
    transform: translateY(-2px) !important;
    box-shadow: 0 10px 32px var(--accent-orange-glow) !important;
    filter: brightness(1.08);
}}

/* ---- Toggle ---- */
[data-testid="stSidebar"] .stToggle label span {{
    color: var(--text-secondary) !important;
}}

/* ============================================================
   HERO HEADER — full-width with skyline photo
   ============================================================ */
.hero-header {{
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-xl);
    margin-bottom: 1.2rem;
    box-shadow: var(--shadow-deep);
    border: 1px solid var(--border-glass);
}}

/* Background image layer */
.hero-header .hero-bg {{
    position: absolute;
    inset: 0;
    {_hero_bg_image}
    background-size: cover;
    background-position: center 35%;
    background-color: #0d1225;
    z-index: 0;
}}

/* Gradient overlay for readability */
.hero-header .hero-overlay {{
    position: absolute;
    inset: 0;
    background: linear-gradient(
        135deg,
        rgba(6,10,20,0.82) 0%,
        rgba(12,18,36,0.65) 45%,
        rgba(6,10,20,0.78) 100%
    );
    z-index: 1;
}}

/* Animated accent line */
.hero-header .hero-accent {{
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg,
        transparent 0%,
        var(--accent-purple) 20%,
        var(--accent-cyan) 50%,
        var(--accent-orange) 80%,
        transparent 100%
    );
    z-index: 3;
    opacity: 0.8;
}}

/* Content */
.hero-content {{
    position: relative;
    z-index: 2;
    padding: 2.2rem 2.5rem 1.8rem;
}}
.hero-content h1 {{
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 2rem;
    font-weight: 700;
    background: linear-gradient(135deg, #ffffff 0%, #c8d0e8 60%, var(--accent-cyan) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 0.35rem 0;
    letter-spacing: -0.8px;
    line-height: 1.15;
}}
.hero-content p {{
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin: 0;
    max-width: 600px;
    line-height: 1.5;
}}

/* Quick-stat chips in hero */
.hero-stats {{
    display: flex;
    gap: 0.6rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}}
.hero-chip {{
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 5px 14px;
    font-size: 0.75rem;
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    gap: 5px;
}}
.hero-chip strong {{
    color: var(--text-primary);
    font-weight: 600;
}}

/* ============================================================
   GLASS PANELS — universal glass effect
   ============================================================ */
.glass-panel {{
    background: var(--bg-glass);
    backdrop-filter: blur(16px) saturate(1.2);
    -webkit-backdrop-filter: blur(16px) saturate(1.2);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    transition: border-color 0.3s;
}}
.glass-panel:hover {{
    border-color: var(--border-glass-hover);
}}

/* Glass Card (smaller) */
.glass-card {{
    background: var(--bg-glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-md);
    padding: 1rem 1.25rem;
    box-shadow: var(--shadow-card);
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.3s;
}}
.glass-card:hover {{
    transform: translateY(-2px);
    box-shadow: var(--shadow-glow);
    border-color: var(--border-glass-hover);
}}

/* ============================================================
   MAP SECTION — smart-city grid overlay
   ============================================================ */
.map-glass-wrap {{
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-glass);
    box-shadow: var(--shadow-deep);
}}
/* Smart city grid texture behind map */
.map-glass-wrap::before {{
    content: "";
    position: absolute;
    inset: 0;
    {_grid_bg_image}
    background-size: cover;
    background-position: center;
    opacity: 0.06;
    z-index: 0;
    pointer-events: none;
}}
.map-glass-wrap iframe {{
    position: relative;
    z-index: 1;
}}

/* Glow line under map */
.map-glow-line {{
    height: 2px;
    margin-top: -2px;
    background: linear-gradient(90deg,
        transparent 0%,
        var(--accent-cyan) 30%,
        var(--accent-purple) 70%,
        transparent 100%
    );
    opacity: 0.4;
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}}

/* ============================================================
   STAT CARDS
   ============================================================ */
.stat-card {{
    background: var(--bg-glass);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-md);
    padding: 1.3rem 1rem;
    text-align: center;
    box-shadow: var(--shadow-card);
    transition: transform 0.2s, border-color 0.3s;
    position: relative;
    overflow: hidden;
}}
.stat-card:hover {{
    transform: translateY(-3px);
    border-color: var(--border-glass-hover);
}}
/* Top accent bar per card */
.stat-card::before {{
    content: "";
    position: absolute;
    top: 0; left: 20%; right: 20%;
    height: 2px;
    border-radius: 0 0 4px 4px;
    background: var(--stat-accent, var(--accent-purple));
    opacity: 0.6;
}}
.stat-value {{
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 2.2rem;
    font-weight: 700;
    letter-spacing: -1.5px;
    margin: 0.3rem 0;
}}
.stat-label {{
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
}}
.stat-sub {{
    font-size: 0.68rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
}}

/* ============================================================
   ATTRACTION CARDS
   ============================================================ */
.attraction-card {{
    background: var(--bg-glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-md);
    padding: 0.85rem 1.1rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.85rem;
    box-shadow: var(--shadow-card);
    transition: transform 0.15s, border-color 0.2s;
}}
.attraction-card:hover {{
    transform: translateX(4px);
    border-color: var(--border-glass-hover);
}}
.attraction-rank {{
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-muted);
    min-width: 28px;
    text-align: center;
}}
.attraction-info {{ flex: 1; }}
.attraction-name {{
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
    line-height: 1.3;
}}
.attraction-cat {{
    font-size: 0.72rem;
    font-weight: 500;
}}
.attraction-score {{
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 1rem;
    font-weight: 700;
    color: var(--accent-cyan);
    text-align: right;
}}
.attraction-transit {{
    font-size: 0.68rem;
    color: var(--text-muted);
    margin-top: 2px;
    text-align: right;
}}

/* ============================================================
   ITINERARY TIMELINE
   ============================================================ */
.itin-stop {{
    background: var(--bg-glass);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--border-glass);
    border-left: 3px solid var(--accent-purple);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    padding: 0.85rem 1.1rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    transition: border-left-color 0.2s, transform 0.15s;
}}
.itin-stop:hover {{
    border-left-color: var(--accent-cyan);
    transform: translateX(3px);
}}
.itin-time {{
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--accent-purple);
    text-transform: uppercase;
    min-width: 85px;
    letter-spacing: 0.3px;
}}
.itin-name {{
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.3;
}}
.itin-cat {{
    font-size: 0.7rem;
    font-weight: 500;
}}
.itin-score-badge {{
    margin-left: auto;
    background: rgba(124, 92, 252, 0.15);
    color: var(--accent-purple);
    padding: 4px 12px;
    border-radius: 14px;
    font-size: 0.73rem;
    font-weight: 600;
    white-space: nowrap;
}}

/* ============================================================
   SECTION TITLES
   ============================================================ */
.section-title {{
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
    letter-spacing: -0.3px;
    display: flex;
    align-items: center;
    gap: 8px;
}}
.section-title::before {{
    content: "";
    width: 3px;
    height: 18px;
    background: linear-gradient(180deg, var(--accent-purple), var(--accent-cyan));
    border-radius: 2px;
    flex-shrink: 0;
}}

/* ============================================================
   DAY BADGE / DESC BOX
   ============================================================ */
.day-badge {{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, var(--accent-purple), #5b3fcc);
    color: #fff;
    padding: 5px 16px;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    box-shadow: 0 4px 16px var(--accent-purple-glow);
}}
.desc-box {{
    background: rgba(124, 92, 252, 0.06);
    border: 1px solid rgba(124, 92, 252, 0.18);
    border-radius: var(--radius-md);
    padding: 1rem 1.25rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
    line-height: 1.6;
    margin-bottom: 1rem;
}}

/* ============================================================
   TOTALS STRIP
   ============================================================ */
.totals-strip {{
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
}}
.total-chip {{
    background: var(--bg-glass);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 0.6rem 1rem;
    text-align: center;
    min-width: 80px;
    transition: border-color 0.2s;
}}
.total-chip:hover {{ border-color: var(--border-glass-hover); }}
.total-chip-value {{
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--accent-cyan);
}}
.total-chip-label {{
    font-size: 0.62rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.8px;
}}

/* ============================================================
   AI BADGE
   ============================================================ */
.ai-badge {{
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 4px 11px;
    border-radius: 14px;
}}
.ai-badge-on {{
    background: rgba(52, 211, 153, 0.12);
    color: var(--accent-green);
    border: 1px solid rgba(52, 211, 153, 0.2);
}}
.ai-badge-off {{
    background: rgba(90, 100, 120, 0.12);
    color: var(--text-muted);
    border: 1px solid rgba(90, 100, 120, 0.2);
}}

/* ============================================================
   CHAT PANEL
   ============================================================ */
.chat-panel {{
    background: var(--bg-glass);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-lg);
    padding: 1.2rem 1.5rem 0.6rem;
    box-shadow: var(--shadow-card);
    margin-top: 0.5rem;
}}
.chat-header-inner {{
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 0.75rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--border-glass);
}}
.chat-title {{
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
}}
.chat-subtitle {{
    color: var(--text-muted);
    font-size: 0.75rem;
}}

/* ============================================================
   STREAMLIT OVERRIDES
   ============================================================ */

/* Metric cards */
[data-testid="stMetric"] {{
    background: var(--bg-glass) !important;
    border: 1px solid var(--border-glass) !important;
    border-radius: var(--radius-md) !important;
    padding: 1rem !important;
    box-shadow: var(--shadow-card) !important;
}}
[data-testid="stMetric"] [data-testid="stMetricValue"] {{
    color: var(--text-primary) !important; font-weight: 700 !important;
}}
[data-testid="stMetric"] [data-testid="stMetricLabel"] {{
    color: var(--text-secondary) !important;
}}

/* Tabs */
.stTabs [data-baseweb="tab-list"] {{
    background: transparent !important;
    gap: 0.5rem;
    border-bottom: 1px solid var(--border-glass) !important;
    padding-bottom: 0 !important;
}}
.stTabs [data-baseweb="tab"] {{
    background: transparent !important;
    border: 1px solid transparent !important;
    border-bottom: 2px solid transparent !important;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0 !important;
    color: var(--text-muted) !important;
    font-weight: 500 !important;
    padding: 0.6rem 1.3rem !important;
    transition: all 0.2s !important;
}}
.stTabs [data-baseweb="tab"]:hover {{
    color: var(--text-secondary) !important;
    background: rgba(124,92,252,0.06) !important;
}}
.stTabs [aria-selected="true"] {{
    background: rgba(124, 92, 252, 0.1) !important;
    color: #fff !important;
    border-color: transparent !important;
    border-bottom: 2px solid var(--accent-purple) !important;
    font-weight: 600 !important;
}}

/* Expander */
[data-testid="stExpander"] {{
    background: var(--bg-glass) !important;
    border: 1px solid var(--border-glass) !important;
    border-radius: var(--radius-md) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}}
[data-testid="stExpander"] summary {{
    color: var(--text-primary) !important;
    font-weight: 600 !important;
}}

/* Dataframe */
[data-testid="stDataFrame"] {{
    border-radius: var(--radius-md) !important;
    overflow: hidden;
}}

/* Headings */
h1, h2, h3, .stMarkdown h1, .stMarkdown h2, .stMarkdown h3 {{
    color: var(--text-primary) !important;
}}

/* Chat messages */
[data-testid="stChatMessage"] {{
    background: var(--bg-glass) !important;
    border: 1px solid var(--border-glass) !important;
    border-radius: var(--radius-md) !important;
}}

/* Chat input */
[data-testid="stChatInput"] {{
    border: 1px solid var(--border-glass) !important;
    border-radius: var(--radius-md) !important;
}}
[data-testid="stChatInput"] textarea {{
    color: var(--text-primary) !important;
}}

/* Spinner */
.stSpinner > div {{ color: var(--accent-purple) !important; }}

/* Alert boxes */
[data-testid="stAlert"] {{
    background: var(--bg-glass) !important;
    border: 1px solid var(--border-glass) !important;
    border-radius: var(--radius-md) !important;
    color: var(--text-secondary) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}}

/* Scrollbar */
::-webkit-scrollbar {{ width: 6px; }}
::-webkit-scrollbar-track {{ background: transparent; }}
::-webkit-scrollbar-thumb {{ background: rgba(100,120,200,0.18); border-radius: 3px; }}

/* Folium iframe rounding */
iframe {{ border-radius: var(--radius-md) !important; }}
</style>
""",
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Data loading (cached)
# ---------------------------------------------------------------------------

DATA_DIR = "data"
OUTPUT_DIR = "output"


@st.cache_data(show_spinner="Loading Winnipeg tourism data…")
def load_and_score():
    """Load datasets, merge, compute transit distances, tourism scores, and neighbourhoods."""
    datasets = load_from_csv(DATA_DIR)

    # Separate transit stops before merging
    transit_df = datasets.get("transit_stops", pd.DataFrame())

    locations = merge_all(datasets)

    # Exclude transit stops from the tourist-facing view
    tourist_locations = locations[locations["category"] != "Transit"].reset_index(drop=True)

    # Add transit proximity
    if not transit_df.empty:
        tourist_locations = add_transit_distances(tourist_locations, transit_df)

    # Compute tourism scores
    tourist_locations = compute_tourism_scores(tourist_locations)

    # Assign neighbourhood names
    tourist_locations = assign_neighbourhood(tourist_locations)

    return tourist_locations, transit_df


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALL_CATEGORIES = ["Park", "Arts & Culture", "Restaurant", "Recreation"]

CAT_ICONS = {
    "Park": "🌳",
    "Arts & Culture": "🎭",
    "Restaurant": "🍽️",
    "Recreation": "⛷️",
}

CAT_COLORS_HEX = {
    "Park": "#34d399",
    "Arts & Culture": "#a78bfa",
    "Restaurant": "#f97316",
    "Recreation": "#22d3ee",
}

SLOT_ICON = {
    "Morning": "🌅",
    "Late Morning": "☀️",
    "Lunch": "🍴",
    "Afternoon": "🏙️",
    "Late Afternoon": "🌇",
    "Evening": "🌙",
}

# ---------------------------------------------------------------------------
# Sidebar — Control Panel
# ---------------------------------------------------------------------------

with st.sidebar:
    st.markdown(
        '<div class="sidebar-logo">Explore<br>Winnipeg</div>'
        '<div class="sidebar-subtitle">Smart Tourism Planner — powered by open data</div>',
        unsafe_allow_html=True,
    )

    # ---- Interest Filters ----
    st.markdown('<div class="sidebar-section-label">Explore</div>', unsafe_allow_html=True)
    selected_cats = []
    for cat in ALL_CATEGORIES:
        icon = CAT_ICONS.get(cat, "📍")
        color = CAT_COLORS_HEX.get(cat, "#888")
        checked = st.checkbox(f"{icon}  {cat}", value=True, key=f"cat_{cat}")
        if checked:
            selected_cats.append(cat)

    # ---- Constraints ----
    st.markdown('<div class="sidebar-section-label">Constraints</div>', unsafe_allow_html=True)
    trip_days = st.radio("Trip length", [1, 2, 3], index=0, horizontal=True, format_func=lambda d: f"{d} Day{'s' if d > 1 else ''}")

    # ---- Time / Season Filters ----
    st.markdown('<div class="sidebar-section-label">Time &amp; Season</div>', unsafe_allow_html=True)
    time_filter = st.selectbox(
        "Best time of day",
        ["Any"] + ALL_TIMES,
        index=0,
        key="time_filter",
    )
    season_filter = st.selectbox(
        "Season",
        ["Any"] + ALL_SEASONS,
        index=0,
        key="season_filter",
    )

    # ---- User Preferences ----
    st.markdown('<div class="sidebar-section-label">Preferences</div>', unsafe_allow_html=True)
    active_prefs: list[str] = []
    for pkey, plabel in PREFERENCE_OPTIONS.items():
        if st.checkbox(plabel, value=False, key=f"pref_{pkey}"):
            active_prefs.append(pkey)

    # ---- Scoring Weight Tuning ----
    with st.expander("⚖️  Scoring Weights", expanded=False):
        w_pop = st.slider("Popularity", 0.0, 1.0, DEFAULT_TOURISM_WEIGHTS["popularity"], 0.05, key="w_pop")
        w_transit = st.slider("Transit Access", 0.0, 1.0, DEFAULT_TOURISM_WEIGHTS["transit_accessibility"], 0.05, key="w_transit")
        w_div = st.slider("Category Diversity", 0.0, 1.0, DEFAULT_TOURISM_WEIGHTS["category_diversity"], 0.05, key="w_div")
        w_clust = st.slider("Location Cluster", 0.0, 1.0, DEFAULT_TOURISM_WEIGHTS["location_cluster"], 0.05, key="w_clust")
        total_w = w_pop + w_transit + w_div + w_clust
        if total_w > 0:
            custom_weights = {
                "popularity": w_pop / total_w,
                "transit_accessibility": w_transit / total_w,
                "category_diversity": w_div / total_w,
                "location_cluster": w_clust / total_w,
            }
        else:
            custom_weights = DEFAULT_TOURISM_WEIGHTS.copy()
        st.caption(f"Normalised total = {sum(custom_weights.values()):.2f}")

    # ---- AI Toggle ----
    st.markdown('<div class="sidebar-section-label">AI</div>', unsafe_allow_html=True)
    ai_available = deepseek_available()
    use_ai = st.toggle(
        "Use AI descriptions (DeepSeek)",
        value=ai_available,
        disabled=not ai_available,
    )
    if ai_available:
        st.markdown(
            '<div class="ai-badge ai-badge-on">● AI Enabled</div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<div class="ai-badge ai-badge-off">○ AI Disabled — no key</div>',
            unsafe_allow_html=True,
        )

    st.markdown("---")
    generate_btn = st.button("🚀  Generate Itinerary", type="primary", width="stretch")

# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------

locations_df, transit_df = load_and_score()

# ---------------------------------------------------------------------------
# Apply sidebar filters and preferences
# ---------------------------------------------------------------------------

# Re-score with custom weights if changed from defaults
_weights_changed = custom_weights != DEFAULT_TOURISM_WEIGHTS
if _weights_changed:
    locations_df = compute_tourism_scores(locations_df, weights=custom_weights)

# Time / season filters
locations_df = apply_time_season_filters(
    locations_df,
    time_of_day=time_filter if time_filter != "Any" else None,
    season=season_filter if season_filter != "Any" else None,
)

# User preference scoring
if active_prefs:
    locations_df = apply_preferences(locations_df, active_prefs)
else:
    locations_df["adjusted_score"] = locations_df["tourism_score"]
    locations_df["preference_bonus"] = 0.0

# ---------------------------------------------------------------------------
# Hero Header — skyline background
# ---------------------------------------------------------------------------

# Quick dataset counts for hero chips
_total_locations = len(locations_df)
_total_cats = locations_df["category"].nunique()
_avg_score = locations_df["tourism_score"].mean() if "tourism_score" in locations_df.columns else 0
_n_neighbourhoods = locations_df["neighbourhood"].nunique() if "neighbourhood" in locations_df.columns else 0

st.markdown(
    f"""
    <div class="hero-header">
        <div class="hero-bg"></div>
        <div class="hero-overlay"></div>
        <div class="hero-accent"></div>
        <div class="hero-content">
            <h1>Explore Winnipeg — Smart Tourism Planner</h1>
            <p>Discover Winnipeg's parks, culture, restaurants, and recreation — powered by open data.</p>
            <div class="hero-stats">
                <div class="hero-chip"><strong>{_total_locations}</strong> Locations</div>
                <div class="hero-chip"><strong>{_total_cats}</strong> Categories</div>
                <div class="hero-chip"><strong>{_n_neighbourhoods}</strong> Neighbourhoods</div>
                <div class="hero-chip">Avg Score <strong>{_avg_score:.1f}</strong></div>
                <div class="hero-chip">🍁 Winnipeg, MB</div>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Tabs: Explore · Itinerary · One-Day Trip
# ---------------------------------------------------------------------------

tab_explore, tab_itinerary, tab_oneday = st.tabs(["🗺️  Explore", "📋  Itinerary", "⏱️  One-Day Trip"])

# ===== TAB 1: EXPLORE =====================================================

with tab_explore:
    # ---- Map + Top Attractions in two columns ----
    map_col, right_col = st.columns([3, 1], gap="medium")

    with map_col:
        st.markdown('<div class="section-title">Tourism Heatmap</div>', unsafe_allow_html=True)

        # Heatmap layer toggle
        heatmap_options = ["All Selected"] + [c for c in selected_cats]
        heatmap_view = st.radio(
            "Heatmap layer",
            heatmap_options,
            index=0,
            horizontal=True,
            key="heatmap_layer",
        )

        # Filter locations to sidebar selection
        filtered = (
            locations_df[locations_df["category"].isin(selected_cats)]
            if selected_cats
            else locations_df
        )

        # Determine which subset feeds the heatmap
        if heatmap_view == "All Selected":
            heat_filtered = filtered
        else:
            heat_filtered = locations_df[locations_df["category"] == heatmap_view]

        # Build Folium map — markers for all selected, heatmap for chosen layer
        m = create_base_map(zoom=12)
        m = add_locations(m, filtered, use_clusters=True)
        m = add_heatmap(m, heat_filtered)

        # Map in glass container with smart-city grid overlay
        st.markdown('<div class="map-glass-wrap">', unsafe_allow_html=True)
        st_folium(m, width=None, height=550, returned_objects=[], key="explore_map")
        st.markdown('</div><div class="map-glow-line"></div>', unsafe_allow_html=True)

    with right_col:
        st.markdown('<div class="section-title">Top Attractions</div>', unsafe_allow_html=True)

        top_attractions = (
            locations_df[locations_df["category"].isin(selected_cats)]
            .nlargest(8, "tourism_score")
            .reset_index(drop=True)
        ) if selected_cats else locations_df.nlargest(8, "tourism_score").reset_index(drop=True)

        for rank, (_, row) in enumerate(top_attractions.iterrows(), start=1):
            score = row.get("tourism_score", 0)
            transit_dist = row.get("distance_to_transit_stop", None)
            transit_str = f"{transit_dist:.0f}m to transit" if pd.notna(transit_dist) else ""
            neighbourhood = row.get("neighbourhood", "")
            nh_str = f"📍 {neighbourhood}" if neighbourhood else ""
            cat_color = CAT_COLORS_HEX.get(row["category"], "#888")
            cat_icon = CAT_ICONS.get(row["category"], "📍")
            st.markdown(
                f"""
                <div class="attraction-card">
                    <div class="attraction-rank">{rank}</div>
                    <div class="attraction-info">
                        <div class="attraction-name">{cat_icon} {row['name']}</div>
                        <div class="attraction-cat" style="color:{cat_color}">{row['category']}</div>
                        <div class="attraction-transit">{nh_str}  {transit_str}</div>
                    </div>
                    <div class="attraction-score">{score:.1f}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    # ---- Stats Row ----
    st.markdown('<div class="section-title" style="margin-top:1.2rem;">Dataset Overview</div>', unsafe_allow_html=True)
    stat_cols = st.columns(4, gap="medium")

    for i, cat in enumerate(ALL_CATEGORIES):
        count = len(locations_df[locations_df["category"] == cat])
        avg_score = locations_df[locations_df["category"] == cat]["tourism_score"].mean()
        avg_score_str = f"Avg score: {avg_score:.1f}" if pd.notna(avg_score) else ""
        color = CAT_COLORS_HEX.get(cat, "#888")
        icon = CAT_ICONS.get(cat, "📍")
        with stat_cols[i]:
            st.markdown(
                f"""
                <div class="stat-card" style="--stat-accent:{color}">
                    <div class="stat-label">{icon} {cat}</div>
                    <div class="stat-value" style="color:{color}">{count}</div>
                    <div class="stat-sub">{avg_score_str}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    # ---- Detailed table ----
    with st.expander("📊  Full Attraction Rankings", expanded=False):
        _rank_cols = ["name", "category", "tourism_score", "distance_to_transit_stop"]
        if "neighbourhood" in locations_df.columns:
            _rank_cols.insert(2, "neighbourhood")
        top_full = (
            locations_df[locations_df["category"].isin(selected_cats)]
            .nlargest(20, "tourism_score")
            [_rank_cols]
            .reset_index(drop=True)
        )
        top_full.index = top_full.index + 1
        _col_names = {"name": "Name", "category": "Category", "neighbourhood": "Neighbourhood",
                       "tourism_score": "Tourism Score", "distance_to_transit_stop": "Transit Distance (m)"}
        top_full.columns = [_col_names.get(c, c) for c in top_full.columns]
        st.dataframe(top_full, width="stretch")


# ===== TAB 2: ITINERARY (multi-day) =======================================

with tab_itinerary:
    if generate_btn:
        if not selected_cats:
            st.warning("Please select at least one interest category in the sidebar.")
        else:
            filtered = locations_df[locations_df["category"].isin(selected_cats)]

            if filtered.empty:
                st.error("No locations match your selected categories.")
            else:
                itineraries = generate_multi_day_itinerary(
                    filtered, days=trip_days, preferred_categories=selected_cats
                )

                user_prefs = {"interests": selected_cats, "trip_days": trip_days}

                for day, itin in itineraries.items():
                    st.markdown(
                        f'<div class="day-badge">📅 Day {day}</div>',
                        unsafe_allow_html=True,
                    )

                    # ---- Description ----
                    with st.spinner("Writing itinerary summary…"):
                        desc = generate_smart_description(
                            itin,
                            locations_df=locations_df,
                            user_prefs=user_prefs,
                            use_llm=use_ai,
                        )
                    st.markdown(
                        f'<div class="desc-box">{desc}</div>',
                        unsafe_allow_html=True,
                    )

                    # ---- Map + Timeline side by side ----
                    itin_map_col, itin_timeline_col = st.columns([2, 1], gap="medium")

                    with itin_map_col:
                        save_path = os.path.join(OUTPUT_DIR, f"itinerary_day{day}_map.html")
                        os.makedirs(OUTPUT_DIR, exist_ok=True)
                        day_map = build_itinerary_map(itin, save_path=save_path)
                        st.markdown('<div class="map-glass-wrap">', unsafe_allow_html=True)
                        st_folium(day_map, width=None, height=420, returned_objects=[], key=f"itin_day{day}_map")
                        st.markdown('</div><div class="map-glow-line"></div>', unsafe_allow_html=True)

                    with itin_timeline_col:
                        st.markdown(
                            '<div class="section-title">Timeline</div>',
                            unsafe_allow_html=True,
                        )
                        for _, stop in itin.iterrows():
                            slot = stop.get("time_slot", "")
                            slot_icon = SLOT_ICON.get(slot, "📍")
                            score = stop.get("tourism_score", 0)
                            score_str = f"{score:.0f}" if pd.notna(score) else "—"
                            cat_color = CAT_COLORS_HEX.get(stop["category"], "#888")
                            walk_lbl = stop.get("walk_label", "")
                            walk_html = (
                                f'<div style="font-size:0.65rem; color:var(--text-muted); margin:2px 0 6px 95px;">🚶 {walk_lbl}</div>'
                                if walk_lbl else ""
                            )
                            nh = stop.get("neighbourhood", "")
                            nh_html = f'<span style="font-size:0.65rem; color:var(--text-muted);"> · {nh}</span>' if nh else ""
                            st.markdown(
                                f"""
                                {walk_html}
                                <div class="itin-stop">
                                    <div class="itin-time">{slot_icon} {slot}</div>
                                    <div>
                                        <div class="itin-name">{stop['name']}{nh_html}</div>
                                        <div class="itin-cat" style="color:{cat_color}">{stop['category']}</div>
                                    </div>
                                    <div class="itin-score-badge">★ {score_str}</div>
                                </div>
                                """,
                                unsafe_allow_html=True,
                            )

                    # ---- Summary totals ----
                    total_score = itin["tourism_score"].sum() if "tourism_score" in itin.columns else 0
                    avg_transit = itin["distance_to_transit_stop"].mean() if "distance_to_transit_stop" in itin.columns else 0
                    n_cats = itin["category"].nunique()
                    st.markdown(
                        f"""
                        <div class="totals-strip">
                            <div class="total-chip">
                                <div class="total-chip-value">{len(itin)}</div>
                                <div class="total-chip-label">Stops</div>
                            </div>
                            <div class="total-chip">
                                <div class="total-chip-value">{total_score:.0f}</div>
                                <div class="total-chip-label">Total Score</div>
                            </div>
                            <div class="total-chip">
                                <div class="total-chip-value">{n_cats}</div>
                                <div class="total-chip-label">Categories</div>
                            </div>
                            <div class="total-chip">
                                <div class="total-chip-value">{avg_transit:.0f}m</div>
                                <div class="total-chip-label">Avg Transit</div>
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )
                    st.markdown("<br>", unsafe_allow_html=True)

                # Save Day 1 map as default output
                if 1 in itineraries:
                    build_itinerary_map(
                        itineraries[1],
                        save_path=os.path.join(OUTPUT_DIR, "itinerary_map.html"),
                    )
    else:
        st.markdown(
            """
            <div class="glass-card" style="text-align:center; padding:3rem 2rem;">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">🗺️</div>
                <div class="section-title" style="margin-bottom:0.5rem;">No itinerary generated yet</div>
                <div style="color:var(--text-secondary); font-size:0.88rem;">
                    Select your interests in the sidebar and click <strong>Generate Itinerary</strong> to build your personalised Winnipeg trip.
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )


# ===== TAB 3: ONE-DAY TRIP ================================================

with tab_oneday:
    st.markdown(
        '<div class="section-title">One-Day Trip Itinerary</div>',
        unsafe_allow_html=True,
    )
    st.markdown(
        '<p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:1rem;">'
        "Discover Winnipeg's finest attractions — a quick, optimised one-day route.</p>",
        unsafe_allow_html=True,
    )

    # Generate a one-day itinerary automatically from current filters
    oneday_filtered = (
        locations_df[locations_df["category"].isin(selected_cats)]
        if selected_cats
        else locations_df
    )

    if not oneday_filtered.empty:
        oneday_itin = generate_one_day_itinerary(
            oneday_filtered,
            preferred_categories=selected_cats if selected_cats else None,
            max_stops=6,
        )

        if not oneday_itin.empty:
            oneday_map_col, oneday_info_col = st.columns([2, 1], gap="medium")

            with oneday_map_col:
                oneday_map = build_itinerary_map(
                    oneday_itin,
                    save_path=os.path.join(OUTPUT_DIR, "itinerary_oneday_map.html"),
                )
                st.markdown('<div class="map-glass-wrap">', unsafe_allow_html=True)
                st_folium(oneday_map, width=None, height=460, returned_objects=[], key="oneday_map")
                st.markdown('</div><div class="map-glow-line"></div>', unsafe_allow_html=True)

            with oneday_info_col:
                st.markdown(
                    '<div class="section-title">Your Stops</div>',
                    unsafe_allow_html=True,
                )
                for _, stop in oneday_itin.iterrows():
                    slot = stop.get("time_slot", "")
                    slot_icon = SLOT_ICON.get(slot, "📍")
                    score = stop.get("tourism_score", 0)
                    score_str = f"{score:.0f}" if pd.notna(score) else "—"
                    transit_val = stop.get("distance_to_transit_stop", None)
                    transit_str = f"{transit_val:.0f}m" if pd.notna(transit_val) else "—"
                    cat_color = CAT_COLORS_HEX.get(stop["category"], "#888")
                    walk_lbl = stop.get("walk_label", "")
                    walk_html = (
                        f'<div style="font-size:0.65rem; color:var(--text-muted); margin:2px 0 6px 95px;">🚶 {walk_lbl}</div>'
                        if walk_lbl else ""
                    )
                    nh = stop.get("neighbourhood", "")
                    nh_html = f'<span style="font-size:0.65rem; color:var(--text-muted);"> · {nh}</span>' if nh else ""
                    st.markdown(
                        f"""
                        {walk_html}
                        <div class="itin-stop">
                            <div class="itin-time">{slot_icon} {slot}</div>
                            <div style="flex:1">
                                <div class="itin-name">{stop['name']}{nh_html}</div>
                                <div class="itin-cat" style="color:{cat_color}">{stop['category']}</div>
                            </div>
                            <div style="text-align:right;">
                                <div class="itin-score-badge">★ {score_str}</div>
                                <div style="font-size:0.68rem; color:var(--text-muted); margin-top:3px;">🚌 {transit_str}</div>
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )

            # Summary totals
            total_score = oneday_itin["tourism_score"].sum() if "tourism_score" in oneday_itin.columns else 0
            avg_transit = oneday_itin["distance_to_transit_stop"].mean() if "distance_to_transit_stop" in oneday_itin.columns else 0
            st.markdown(
                f"""
                <div class="totals-strip">
                    <div class="total-chip">
                        <div class="total-chip-value">{len(oneday_itin)}</div>
                        <div class="total-chip-label">Stops</div>
                    </div>
                    <div class="total-chip">
                        <div class="total-chip-value">{total_score:.0f}</div>
                        <div class="total-chip-label">Total Score</div>
                    </div>
                    <div class="total-chip">
                        <div class="total-chip-value">{avg_transit:.0f}m</div>
                        <div class="total-chip-label">Avg Transit</div>
                    </div>
                    <div class="total-chip">
                        <div class="total-chip-value">{oneday_itin['category'].nunique()}</div>
                        <div class="total-chip-label">Categories</div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        else:
            st.info("Not enough locations to build a one-day itinerary with your current filters.")
    else:
        st.info("Select at least one category to see a one-day trip.")


# ---------------------------------------------------------------------------
# AI Chat Assistant
# ---------------------------------------------------------------------------

st.markdown("<br>", unsafe_allow_html=True)
st.markdown(
    """
    <div class="chat-panel">
        <div class="chat-header-inner">
            <span class="chat-title">💬  Ask About Winnipeg</span>
            <span class="chat-subtitle">Chat with our AI assistant about attractions, itineraries, and local tips</span>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

if not ai_available:
    st.caption("Chat requires a DeepSeek API key. Set `DEEPSEEK_API_KEY` to enable.")
else:
    # Initialise chat history in session state
    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []

    # Display prior messages
    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # Chat input
    if prompt := st.chat_input("Ask about these places…"):
        # Show user message
        st.session_state.chat_history.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Get assistant reply
        with st.chat_message("assistant"):
            with st.spinner("Thinking…"):
                reply = chat_reply(
                    prompt,
                    locations_df=locations_df,
                    conversation_history=st.session_state.chat_history[:-1],
                    categories=selected_cats if selected_cats else None,
                )
            st.markdown(reply)
        st.session_state.chat_history.append({"role": "assistant", "content": reply})
