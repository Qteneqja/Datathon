"""
Central configuration for Explore Winnipeg.

Keeps all tunable weights and constants in one place so the Streamlit
sidebar sliders can override them at runtime.
"""

# ---------------------------------------------------------------------------
# Per-location Tourism Score weights (must sum to 1.0)
# ---------------------------------------------------------------------------

TOURISM_WEIGHTS = {
    "popularity": 0.35,
    "transit_accessibility": 0.25,
    "category_diversity": 0.20,
    "location_cluster": 0.20,
}

# ---------------------------------------------------------------------------
# Grid-based Experience Score category weights
# ---------------------------------------------------------------------------

GRID_WEIGHTS = {
    "Park": 3.0,
    "Recreation": 3.0,
    "Public Art": 2.0,
    "Restaurant": 2.0,
    "Transit": 1.0,
    "Arts & Culture": 2.5,
}

# ---------------------------------------------------------------------------
# Scoring radius (km)
# ---------------------------------------------------------------------------

DEFAULT_RADIUS_KM = 1.0
