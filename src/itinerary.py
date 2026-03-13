"""
Itinerary generators.

- generate_itinerary:          Original simple greedy itinerary.
- generate_one_day_itinerary:  Smart single-day planner using tourism_score,
                               category diversity, and geographic proximity.
- generate_multi_day_itinerary: Extends the one-day planner to 2–3 days.
- generate_itinerary_description: Templated narrative summary.
"""

import pandas as pd
import numpy as np
import folium


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in km between two points."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return R * 2 * np.arcsin(np.sqrt(a))


def find_nearby(
    locations: pd.DataFrame,
    lat: float,
    lon: float,
    radius_km: float = 2.0,
    categories: list[str] | None = None,
) -> pd.DataFrame:
    """Find locations within radius_km of a point."""
    df = locations.copy()
    df["distance_km"] = df.apply(
        lambda r: haversine(lat, lon, r["latitude"], r["longitude"]), axis=1
    )
    df = df[df["distance_km"] <= radius_km]
    if categories:
        df = df[df["category"].isin(categories)]
    return df.sort_values("distance_km").reset_index(drop=True)


def generate_itinerary(
    locations: pd.DataFrame,
    start_lat: float = 49.8954,
    start_lon: float = -97.1385,
    radius_km: float = 3.0,
    max_stops: int = 6,
    preferred_categories: list[str] | None = None,
) -> pd.DataFrame:
    """
    Generate a simple greedy itinerary:
      1. Find all locations within radius of start
      2. Pick one from each category (diversified)
      3. Order by nearest-neighbor traversal

    Returns DataFrame with ordered stops.
    """
    nearby = find_nearby(locations, start_lat, start_lon, radius_km, preferred_categories)

    if nearby.empty:
        print("  No locations found nearby. Try increasing the radius.")
        return pd.DataFrame()

    # Pick diverse stops: one per category, preferring the closest
    selected = []
    for cat in nearby["category"].unique():
        cat_df = nearby[nearby["category"] == cat]
        selected.append(cat_df.iloc[0])  # closest in that category
        if len(selected) >= max_stops:
            break

    # If we have room, add more from closest overall
    if len(selected) < max_stops:
        remaining = nearby[~nearby.index.isin([s.name for s in selected])]
        extra = remaining.head(max_stops - len(selected))
        selected.extend([row for _, row in extra.iterrows()])

    itinerary = pd.DataFrame(selected).reset_index(drop=True)

    # Nearest-neighbor ordering starting from the start point
    itinerary = _order_nearest_neighbor(itinerary, start_lat, start_lon)

    itinerary["stop_number"] = range(1, len(itinerary) + 1)
    cols = ["stop_number", "name", "category", "latitude", "longitude", "distance_km"]
    return itinerary[[c for c in cols if c in itinerary.columns]]


def _order_nearest_neighbor(df: pd.DataFrame, start_lat: float, start_lon: float) -> pd.DataFrame:
    """Order stops using nearest-neighbor heuristic."""
    remaining = df.copy()
    ordered = []
    current_lat, current_lon = start_lat, start_lon

    while len(remaining) > 0:
        dists = remaining.apply(
            lambda r: haversine(current_lat, current_lon, r["latitude"], r["longitude"]),
            axis=1,
        )
        nearest_idx = dists.idxmin()
        nearest = remaining.loc[nearest_idx]
        ordered.append(nearest)
        current_lat, current_lon = nearest["latitude"], nearest["longitude"]
        remaining = remaining.drop(nearest_idx)

    return pd.DataFrame(ordered).reset_index(drop=True)


def format_itinerary(itinerary: pd.DataFrame, title: str = "Explore Winnipeg Itinerary") -> str:
    """Pretty-print an itinerary."""
    lines = [f"\n{'=' * 50}", f"  {title}", f"{'=' * 50}"]
    for _, row in itinerary.iterrows():
        lines.append(
            f"  Stop {int(row['stop_number'])}: {row['name']}\n"
            f"    Category: {row['category']}\n"
            f"    Distance: {row['distance_km']:.2f} km"
        )
    lines.append(f"{'=' * 50}\n")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Smart one-day itinerary (Task 4)
# ---------------------------------------------------------------------------

TIME_SLOTS = ["Morning", "Late Morning", "Lunch", "Afternoon", "Late Afternoon", "Evening"]

# Preferred category for each time slot
SLOT_CATEGORY_PREFERENCE = {
    "Morning": ["Park", "Recreation"],
    "Late Morning": ["Arts & Culture", "Public Art", "Recreation"],
    "Lunch": ["Restaurant"],
    "Afternoon": ["Arts & Culture", "Public Art", "Park"],
    "Late Afternoon": ["Recreation", "Park", "Arts & Culture"],
    "Evening": ["Restaurant", "Arts & Culture"],
}


def generate_one_day_itinerary(
    locations_df: pd.DataFrame,
    preferred_categories: list[str] | None = None,
    max_stops: int = 6,
) -> pd.DataFrame:
    """
    Generate a smart one-day itinerary.

    Logic:
      1. Select top-ranked attractions by tourism_score.
      2. Ensure category diversity (no more than 2 from same category).
      3. Ensure geographic proximity via nearest-neighbour ordering.
      4. Limit to 5–6 stops mapped to time slots (Morning → Evening).

    Parameters
    ----------
    locations_df : pd.DataFrame
        Scored locations (must include 'tourism_score' column).
    preferred_categories : list[str], optional
        Filter to these categories only. Defaults to all non-Transit.
    max_stops : int
        Number of stops (default 6).

    Returns
    -------
    pd.DataFrame with columns: stop_number, time_slot, name, category,
    latitude, longitude, tourism_score, distance_to_transit_stop
    """
    df = locations_df.copy()

    # Filter to non-Transit locations
    df = df[df["category"] != "Transit"]

    if preferred_categories:
        df = df[df["category"].isin(preferred_categories)]

    if df.empty:
        return pd.DataFrame()

    # Sort by tourism_score descending
    score_col = "tourism_score" if "tourism_score" in df.columns else "experience_score"
    df = df.sort_values(score_col, ascending=False).reset_index(drop=True)

    # Greedy selection: pick top-scored, enforce max 2 per category
    selected = []
    cat_counts: dict[str, int] = {}
    slots = TIME_SLOTS[:max_stops]

    for slot in slots:
        preferred = SLOT_CATEGORY_PREFERENCE.get(slot, [])
        # Try preferred categories first, then fall back to any
        candidates = df[~df.index.isin([s.name for s in selected])]
        if candidates.empty:
            break

        picked = None
        # Attempt to pick from preferred categories
        for pcat in preferred:
            cat_cands = candidates[
                (candidates["category"] == pcat)
                & (candidates["category"].map(lambda c: cat_counts.get(c, 0)) < 2)
            ]
            if not cat_cands.empty:
                picked = cat_cands.iloc[0]
                break

        # Fallback: pick highest scoring that maintains diversity
        if picked is None:
            diverse_cands = candidates[
                candidates["category"].map(lambda c: cat_counts.get(c, 0)) < 2
            ]
            if not diverse_cands.empty:
                picked = diverse_cands.iloc[0]
            else:
                picked = candidates.iloc[0]

        selected.append(picked)
        cat_counts[picked["category"]] = cat_counts.get(picked["category"], 0) + 1

    if not selected:
        return pd.DataFrame()

    itinerary = pd.DataFrame(selected).reset_index(drop=True)

    # Order by nearest-neighbour starting from first stop
    itinerary = _order_nearest_neighbor(
        itinerary,
        itinerary.iloc[0]["latitude"],
        itinerary.iloc[0]["longitude"],
    )

    itinerary["stop_number"] = range(1, len(itinerary) + 1)
    itinerary["time_slot"] = slots[: len(itinerary)]

    cols = ["stop_number", "time_slot", "name", "category", "latitude", "longitude"]
    if "tourism_score" in itinerary.columns:
        cols.append("tourism_score")
    if "distance_to_transit_stop" in itinerary.columns:
        cols.append("distance_to_transit_stop")
    if "neighbourhood" in itinerary.columns:
        cols.append("neighbourhood")
    if "adjusted_score" in itinerary.columns:
        cols.append("adjusted_score")

    itin_out = itinerary[[c for c in cols if c in itinerary.columns]]

    # Add walking-time estimates between consecutive stops
    try:
        from src.routing import add_walk_times
        itin_out = add_walk_times(itin_out)
    except Exception:
        pass

    return itin_out


def generate_multi_day_itinerary(
    locations_df: pd.DataFrame,
    days: int = 1,
    preferred_categories: list[str] | None = None,
    max_stops_per_day: int = 6,
) -> dict[int, pd.DataFrame]:
    """
    Generate itineraries for multiple days.

    Each subsequent day excludes locations already used in previous days
    and focuses on a different geographic area.

    Returns
    -------
    dict mapping day number (1-indexed) -> itinerary DataFrame.
    """
    remaining = locations_df.copy()
    result = {}

    for day in range(1, days + 1):
        itin = generate_one_day_itinerary(
            remaining,
            preferred_categories=preferred_categories,
            max_stops=max_stops_per_day,
        )
        if itin.empty:
            break
        result[day] = itin
        # Remove used locations from remaining pool
        used_names = set(itin["name"].values)
        remaining = remaining[~remaining["name"].isin(used_names)]

    return result


# ---------------------------------------------------------------------------
# Itinerary map builder
# ---------------------------------------------------------------------------

def build_itinerary_map(
    itinerary: pd.DataFrame,
    save_path: str = "output/itinerary_map.html",
) -> folium.Map:
    """
    Build a Folium map for an itinerary with numbered markers and a route line.
    """
    center_lat = itinerary["latitude"].mean()
    center_lon = itinerary["longitude"].mean()
    m = folium.Map(location=[center_lat, center_lon], zoom_start=13, tiles="CartoDB positron")

    MARKER_COLORS = ["darkblue", "green", "red", "purple", "orange", "cadetblue"]
    route_coords = []

    for _, row in itinerary.iterrows():
        idx = int(row["stop_number"]) - 1
        color = MARKER_COLORS[idx % len(MARKER_COLORS)]

        popup_lines = [
            f"<b>Stop {int(row['stop_number'])}: {row['name']}</b>",
            f"<em>{row['category']}</em>",
        ]
        if "time_slot" in row.index and pd.notna(row.get("time_slot")):
            popup_lines.insert(0, f"<small>{row['time_slot']}</small>")
        if "tourism_score" in row.index and pd.notna(row.get("tourism_score")):
            popup_lines.append(f"Score: {row['tourism_score']:.1f}")
        if "neighbourhood" in row.index and pd.notna(row.get("neighbourhood")):
            popup_lines.append(f"📍 {row['neighbourhood']}")
        if "walk_label" in row.index and row.get("walk_label"):
            popup_lines.append(f"🚶 {row['walk_label']}")

        folium.Marker(
            [row["latitude"], row["longitude"]],
            popup=folium.Popup("<br>".join(popup_lines), max_width=250),
            tooltip=f"Stop {int(row['stop_number'])}: {row['name']}",
            icon=folium.Icon(color=color, icon="flag", prefix="glyphicon"),
        ).add_to(m)
        route_coords.append([row["latitude"], row["longitude"]])

    if len(route_coords) > 1:
        folium.PolyLine(route_coords, weight=3, color="#3388ff", opacity=0.7).add_to(m)

    m.save(save_path)
    print(f"  Itinerary map saved to {save_path}")
    return m


# ---------------------------------------------------------------------------
# AI itinerary description (Task 6) — templated narrative
# ---------------------------------------------------------------------------

CATEGORY_DESCRIPTORS = {
    "Park": "green spaces and nature",
    "Recreation": "recreation and active experiences",
    "Arts & Culture": "cultural landmarks and arts venues",
    "Public Art": "public art installations",
    "Restaurant": "local dining and food scenes",
}


def generate_itinerary_description(itinerary: pd.DataFrame) -> str:
    """
    Generate a short, human-readable narrative summary of an itinerary.
    Pure template — no external API.  Used as the fallback for the LLM path.

    Example output:
        "This itinerary highlights Winnipeg's nature, cultural landmarks,
         and vibrant food scene, beginning at Assiniboine Park and ending
         in the Exchange District."
    """
    if itinerary.empty:
        return "No itinerary to describe."

    # Gather unique categories and map to descriptors
    cats = itinerary["category"].unique().tolist()
    descriptors = []
    for cat in cats:
        desc = CATEGORY_DESCRIPTORS.get(cat)
        if desc and desc not in descriptors:
            descriptors.append(desc)

    first_stop = itinerary.iloc[0]["name"]
    last_stop = itinerary.iloc[-1]["name"]
    n_stops = len(itinerary)

    # Build theme string
    if len(descriptors) == 1:
        theme = descriptors[0]
    elif len(descriptors) == 2:
        theme = f"{descriptors[0]} and {descriptors[1]}"
    else:
        theme = ", ".join(descriptors[:-1]) + f", and {descriptors[-1]}"

    # Compose narrative
    narrative = (
        f"This {n_stops}-stop itinerary highlights Winnipeg's {theme}. "
        f"Your day begins at {first_stop} and wraps up at {last_stop}."
    )

    # Add time-slot flavour if available
    if "time_slot" in itinerary.columns:
        lunch_rows = itinerary[itinerary["time_slot"] == "Lunch"]
        if not lunch_rows.empty:
            lunch_name = lunch_rows.iloc[0]["name"]
            narrative += f" Enjoy lunch at {lunch_name}."

    return narrative


def generate_smart_description(
    itinerary: pd.DataFrame,
    locations_df: pd.DataFrame | None = None,
    user_prefs: dict | None = None,
    use_llm: bool = True,
) -> str:
    """
    Generate an itinerary description, optionally powered by DeepSeek LLM.

    Tries the LLM path first (if *use_llm* is True and a key exists),
    otherwise returns the template fallback.  Never crashes.

    Parameters
    ----------
    itinerary : pd.DataFrame
    locations_df : pd.DataFrame, optional — full scored locations (for grounding)
    user_prefs : dict, optional — {"interests": [...], "trip_days": int}
    use_llm : bool — set False to skip the LLM entirely

    Returns
    -------
    str — narrative summary
    """
    if not use_llm or locations_df is None:
        return generate_itinerary_description(itinerary)

    try:
        from src.llm_interface import grounded_itinerary_description
        return grounded_itinerary_description(itinerary, locations_df, user_prefs)
    except Exception:
        # Any import or runtime error — silent fallback
        return generate_itinerary_description(itinerary)


def format_one_day_itinerary(itinerary: pd.DataFrame, title: str = "Your Winnipeg Day") -> str:
    """Pretty-print a one-day itinerary with time slots."""
    lines = [f"\n{'=' * 55}", f"  {title}", f"{'=' * 55}"]
    for _, row in itinerary.iterrows():
        slot = row.get("time_slot", "")
        score_str = ""
        if "tourism_score" in row.index and pd.notna(row.get("tourism_score")):
            score_str = f"  (score: {row['tourism_score']:.1f})"
        lines.append(
            f"  [{slot}] Stop {int(row['stop_number'])}: {row['name']}\n"
            f"    Category: {row['category']}{score_str}"
        )
    lines.append(f"{'=' * 55}\n")
    return "\n".join(lines)
