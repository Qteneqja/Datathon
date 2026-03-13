"""
Time-of-day and season filters for Explore Winnipeg.

Assigns heuristic tags to locations so users can filter by
'Morning / Afternoon / Evening' and 'Summer / Winter / All-Season'.
"""

from __future__ import annotations

import pandas as pd


# ---------------------------------------------------------------------------
# Heuristic tag definitions
# ---------------------------------------------------------------------------

_TIME_TAGS: dict[str, list[str]] = {
    "Park": ["Morning", "Afternoon"],
    "Recreation": ["Morning", "Afternoon"],
    "Arts & Culture": ["Afternoon", "Evening"],
    "Restaurant": ["Afternoon", "Evening"],
    "Public Art": ["Morning", "Afternoon"],
}

_SEASON_TAGS: dict[str, list[str]] = {
    "Park": ["Summer", "All-Season"],
    "Recreation": ["All-Season"],
    "Arts & Culture": ["All-Season"],
    "Restaurant": ["All-Season"],
    "Public Art": ["Summer", "All-Season"],
}

ALL_TIMES = ["Morning", "Afternoon", "Evening"]
ALL_SEASONS = ["Summer", "Winter", "All-Season"]


# ---------------------------------------------------------------------------
# Tag assignment
# ---------------------------------------------------------------------------

def infer_time_of_day_tags(df: pd.DataFrame) -> pd.DataFrame:
    """Add a ``best_time`` column (list of strings) based on category heuristics."""
    df = df.copy()
    df["best_time"] = df["category"].map(lambda c: _TIME_TAGS.get(c, ALL_TIMES))
    return df


def infer_season_tags(df: pd.DataFrame) -> pd.DataFrame:
    """Add a ``best_season`` column (list of strings) based on category heuristics."""
    df = df.copy()
    df["best_season"] = df["category"].map(lambda c: _SEASON_TAGS.get(c, ["All-Season"]))
    return df


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------

def apply_time_filter(df: pd.DataFrame, time_of_day: str | None) -> pd.DataFrame:
    """Keep only rows whose ``best_time`` list contains *time_of_day*.

    If *time_of_day* is None or 'Any', all rows pass.
    Automatically adds the column if missing.
    """
    if time_of_day is None or time_of_day == "Any":
        return df

    if "best_time" not in df.columns:
        df = infer_time_of_day_tags(df)

    return df[df["best_time"].apply(lambda tags: time_of_day in tags)].reset_index(drop=True)


def apply_season_filter(df: pd.DataFrame, season: str | None) -> pd.DataFrame:
    """Keep only rows whose ``best_season`` list contains *season*.

    If *season* is None or 'Any', all rows pass.
    Automatically adds the column if missing.
    """
    if season is None or season == "Any":
        return df

    if "best_season" not in df.columns:
        df = infer_season_tags(df)

    return df[df["best_season"].apply(lambda tags: season in tags or "All-Season" in tags)].reset_index(drop=True)


def apply_time_season_filters(
    df: pd.DataFrame,
    time_of_day: str | None = None,
    season: str | None = None,
) -> pd.DataFrame:
    """Convenience wrapper: apply both filters in sequence."""
    df = apply_time_filter(df, time_of_day)
    df = apply_season_filter(df, season)
    return df
