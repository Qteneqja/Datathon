"""
User preference scoring for Explore Winnipeg.

Applies bonus / penalty modifiers to the tourism_score based on
user-selected preferences such as 'outdoor-focused', 'family-friendly',
or 'close to transit'.
"""

from __future__ import annotations

import pandas as pd

# ---------------------------------------------------------------------------
# Preference definitions
# ---------------------------------------------------------------------------

PREFERENCE_OPTIONS = {
    "outdoor": "Outdoor-focused",
    "indoor": "Indoor-focused",
    "family": "Family-friendly",
    "transit": "Close to transit",
    "hidden_gems": "Hidden gems (lower-traffic)",
}

# Category → indoor / outdoor tag
_OUTDOOR_CATS = {"Park", "Recreation", "Public Art"}
_INDOOR_CATS = {"Arts & Culture", "Restaurant"}


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def _outdoor_bonus(row: pd.Series) -> float:
    return 10.0 if row["category"] in _OUTDOOR_CATS else -5.0


def _indoor_bonus(row: pd.Series) -> float:
    return 10.0 if row["category"] in _INDOOR_CATS else -5.0


def _family_bonus(row: pd.Series) -> float:
    # Parks and Recreation are generally family-friendly
    if row["category"] in {"Park", "Recreation"}:
        return 8.0
    return 0.0


def _transit_bonus(row: pd.Series) -> float:
    dist = row.get("distance_to_transit_stop")
    if pd.isna(dist):
        return 0.0
    if dist <= 300:
        return 10.0
    if dist <= 600:
        return 5.0
    return -5.0


def _hidden_gems_bonus(row: pd.Series) -> float:
    score = row.get("tourism_score", 50)
    if pd.isna(score):
        return 0.0
    # Prefer mid-range scores (not overly popular)
    if 20 <= score <= 55:
        return 12.0
    if score > 75:
        return -8.0
    return 0.0


_BONUS_FNS = {
    "outdoor": _outdoor_bonus,
    "indoor": _indoor_bonus,
    "family": _family_bonus,
    "transit": _transit_bonus,
    "hidden_gems": _hidden_gems_bonus,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def apply_preferences(
    df: pd.DataFrame,
    preferences: list[str],
) -> pd.DataFrame:
    """Return a copy of *df* with an adjusted ``adjusted_score`` column.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain ``tourism_score`` and ``category``.
    preferences : list[str]
        Keys from ``PREFERENCE_OPTIONS`` (e.g. ``["outdoor", "transit"]``).

    Returns
    -------
    pd.DataFrame
        Copy with ``preference_bonus`` and ``adjusted_score`` columns.
    """
    if not preferences:
        df = df.copy()
        df["preference_bonus"] = 0.0
        df["adjusted_score"] = df.get("tourism_score", 0.0)
        return df

    df = df.copy()
    bonus = pd.Series(0.0, index=df.index)

    for pref in preferences:
        fn = _BONUS_FNS.get(pref)
        if fn is not None:
            bonus += df.apply(fn, axis=1)

    df["preference_bonus"] = bonus.round(2)
    base = df["tourism_score"] if "tourism_score" in df.columns else 0.0
    df["adjusted_score"] = (base + bonus).clip(lower=0).round(2)
    return df
