"""
Neighbourhood assignment for Explore Winnipeg.

Uses a lightweight reverse-geocoding approach based on known Winnipeg
neighbourhood centroids.  No external GeoJSON required — the centroid
table is embedded so the feature works out of the box.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Winnipeg neighbourhood centroids (name, lat, lon)
# Source: approximated from Winnipeg Open Data neighbourhood boundaries.
# ---------------------------------------------------------------------------

_NEIGHBOURHOOD_CENTROIDS: list[tuple[str, float, float]] = [
    ("Downtown", 49.8951, -97.1384),
    ("Exchange District", 49.8990, -97.1370),
    ("The Forks", 49.8875, -97.1313),
    ("Osborne Village", 49.8795, -97.1438),
    ("Wolseley", 49.8830, -97.1860),
    ("River Heights", 49.8635, -97.1700),
    ("Crescentwood", 49.8680, -97.1570),
    ("St. Boniface", 49.8885, -97.1165),
    ("St. Vital", 49.8440, -97.1120),
    ("Transcona", 49.8930, -97.0140),
    ("Kildonan Park", 49.9360, -97.0940),
    ("North Kildonan", 49.9260, -97.0470),
    ("West Kildonan", 49.9310, -97.1470),
    ("Garden City", 49.9420, -97.1380),
    ("Maples", 49.9500, -97.1560),
    ("Fort Garry", 49.8310, -97.1570),
    ("Whyte Ridge", 49.8230, -97.2010),
    ("Linden Woods", 49.8350, -97.2280),
    ("Charleswood", 49.8550, -97.2710),
    ("Tuxedo", 49.8685, -97.2330),
    ("St. James", 49.8920, -97.2230),
    ("Polo Park", 49.8810, -97.2050),
    ("Corydon", 49.8740, -97.1590),
    ("South Osborne", 49.8570, -97.1370),
    ("Point Douglas", 49.9100, -97.1240),
    ("Elmwood", 49.9050, -97.1020),
    ("East Kildonan", 49.9170, -97.0720),
    ("Old St. Vital", 49.8590, -97.1120),
    ("University of Manitoba", 49.8077, -97.1365),
    ("Bridgwater", 49.8100, -97.1780),
    ("Sage Creek", 49.8350, -97.0650),
    ("Island Lakes", 49.8380, -97.0830),
    ("Windsor Park", 49.8600, -97.0880),
    ("Norwood Flats", 49.8770, -97.1150),
    ("River-Osborne", 49.8830, -97.1380),
    ("Spence", 49.8930, -97.1550),
    ("West End", 49.8890, -97.1720),
    ("Sargent Park", 49.8920, -97.1920),
    ("Brooklands", 49.8970, -97.2330),
    ("Inkster", 49.9180, -97.1620),
]

# Pre-compute as NumPy arrays
_NH_NAMES = [n[0] for n in _NEIGHBOURHOOD_CENTROIDS]
_NH_COORDS = np.radians(np.array([[n[1], n[2]] for n in _NEIGHBOURHOOD_CENTROIDS]))


# ---------------------------------------------------------------------------
# Haversine helper
# ---------------------------------------------------------------------------

def _haversine_vec(point_rad: np.ndarray, array_rad: np.ndarray) -> np.ndarray:
    """Vectorised haversine from one point to an array (km)."""
    R = 6371.0
    dlat = array_rad[:, 0] - point_rad[0]
    dlon = array_rad[:, 1] - point_rad[1]
    a = (
        np.sin(dlat / 2) ** 2
        + np.cos(point_rad[0]) * np.cos(array_rad[:, 0]) * np.sin(dlon / 2) ** 2
    )
    return R * 2 * np.arcsin(np.sqrt(a))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def assign_neighbourhood(df: pd.DataFrame, max_dist_km: float = 3.0) -> pd.DataFrame:
    """Add a ``neighbourhood`` column by nearest-centroid lookup.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain ``latitude`` and ``longitude`` columns.
    max_dist_km : float
        Maximum distance to a centroid.  Locations farther than this get
        ``'Winnipeg (outer)'``.

    Returns
    -------
    pd.DataFrame
        Copy of *df* with the new ``neighbourhood`` column.
    """
    df = df.copy()
    coords_rad = np.radians(df[["latitude", "longitude"]].values)

    names = []
    for pt in coords_rad:
        dists = _haversine_vec(pt, _NH_COORDS)
        idx = int(np.argmin(dists))
        if dists[idx] <= max_dist_km:
            names.append(_NH_NAMES[idx])
        else:
            names.append("Winnipeg (outer)")

    df["neighbourhood"] = names
    return df
