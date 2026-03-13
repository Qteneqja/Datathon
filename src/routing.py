"""
Walking-time estimates between itinerary stops.

Uses haversine straight-line distance scaled by a detour factor
(default 1.3) to approximate real walking distance, then converts
to minutes at average walking speed (5 km/h).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Average walking speed in km/h
_WALK_SPEED_KMH = 5.0

# Straight-line to actual-walk multiplier (accounts for turns / detours)
_DETOUR_FACTOR = 1.3


# ---------------------------------------------------------------------------
# Haversine
# ---------------------------------------------------------------------------

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return R * 2 * np.arcsin(np.sqrt(a))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def estimate_walk_minutes(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    detour_factor: float = _DETOUR_FACTOR,
    speed_kmh: float = _WALK_SPEED_KMH,
) -> float:
    """Estimated walking time in minutes between two points."""
    dist_km = haversine_km(lat1, lon1, lat2, lon2) * detour_factor
    return (dist_km / speed_kmh) * 60


def add_walk_times(itinerary: pd.DataFrame) -> pd.DataFrame:
    """Add ``walk_min`` and ``walk_dist_m`` columns to an ordered itinerary.

    ``walk_min`` for stop *i* is the walking time **from** stop *i-1*
    **to** stop *i*.  The first stop gets 0.

    Also adds a human-readable ``walk_label`` like "~12 min (900 m)" or
    "Far — consider transit" for distances > 3 km.

    Parameters
    ----------
    itinerary : pd.DataFrame
        Must contain ``latitude`` and ``longitude``, ordered by stop sequence.

    Returns
    -------
    pd.DataFrame
        Copy with ``walk_min``, ``walk_dist_m``, and ``walk_label`` columns.
    """
    df = itinerary.copy()
    mins: list[float] = [0.0]
    dists: list[float] = [0.0]

    for i in range(1, len(df)):
        prev = df.iloc[i - 1]
        cur = df.iloc[i]
        wm = estimate_walk_minutes(
            prev["latitude"], prev["longitude"],
            cur["latitude"], cur["longitude"],
        )
        dist_m = haversine_km(
            prev["latitude"], prev["longitude"],
            cur["latitude"], cur["longitude"],
        ) * _DETOUR_FACTOR * 1000
        mins.append(round(wm, 1))
        dists.append(round(dist_m))

    df["walk_min"] = mins
    df["walk_dist_m"] = dists

    labels = []
    for m, d in zip(mins, dists):
        if d == 0:
            labels.append("")
        elif d > 3000:
            labels.append(f"Far — consider transit ({d:.0f} m)")
        else:
            labels.append(f"~{m:.0f} min ({d:.0f} m)")
    df["walk_label"] = labels

    return df
