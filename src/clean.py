"""
Data cleaning and merging utilities.
Standardizes all datasets into a unified locations DataFrame.
"""

import pandas as pd
import numpy as np
import ast

# Winnipeg bounding box for sanity checks
WINNIPEG_BOUNDS = {
    "lat_min": 49.75,
    "lat_max": 49.99,
    "lon_min": -97.35,
    "lon_max": -96.95,
}


def extract_coords(df: pd.DataFrame) -> pd.DataFrame:
    """
    Try to extract latitude / longitude from common column patterns.
    Handles: lat/lon columns, location dict columns, polygon/geometry columns.
    Returns df with clean 'latitude' and 'longitude' float columns.
    """
    df = df.copy()

    # Already has lat/lon
    lat_col = _find_col(df, ["latitude", "lat", "y"])
    lon_col = _find_col(df, ["longitude", "lon", "lng", "long", "x"])

    if lat_col and lon_col:
        df["latitude"] = pd.to_numeric(df[lat_col], errors="coerce")
        df["longitude"] = pd.to_numeric(df[lon_col], errors="coerce")
        return df

    # Nested location dict (Socrata style: {"latitude": ..., "longitude": ...})
    loc_col = _find_col(df, ["location", "location_1", "mapped_location", "geo_point_2d"])
    if loc_col is not None:
        locs = df[loc_col].apply(_parse_location)
        df["latitude"] = locs.apply(lambda x: x[0])
        df["longitude"] = locs.apply(lambda x: x[1])
        if df["latitude"].notna().any():
            return df

    # Polygon / geometry column — compute centroid
    geom_col = _find_col(df, ["polygon", "geometry", "the_geom", "geom"])
    if geom_col is not None:
        centroids = df[geom_col].apply(_centroid_from_geometry)
        df["latitude"] = centroids.apply(lambda x: x[0])
        df["longitude"] = centroids.apply(lambda x: x[1])
        return df

    # If nothing found, leave NaN
    df["latitude"] = np.nan
    df["longitude"] = np.nan
    return df


def _find_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    cols_lower = {c.lower(): c for c in df.columns}
    for c in candidates:
        if c in cols_lower:
            return cols_lower[c]
    return None


def _parse_location(val) -> tuple[float, float]:
    if isinstance(val, dict):
        lat = val.get("latitude") or val.get("lat")
        lon = val.get("longitude") or val.get("lon")
        if lat and lon:
            return (float(lat), float(lon))
    if isinstance(val, str):
        try:
            import json
            d = json.loads(val)
            return _parse_location(d)
        except (json.JSONDecodeError, ValueError):
            try:
                d = ast.literal_eval(val)
                return _parse_location(d)
            except (ValueError, SyntaxError):
                # Try "lat, lon" format
                parts = val.split(",")
                if len(parts) == 2:
                    try:
                        return (float(parts[0].strip()), float(parts[1].strip()))
                    except ValueError:
                        pass
    return (np.nan, np.nan)


def _centroid_from_geometry(val) -> tuple[float, float]:
    """Extract centroid lat/lon from a GeoJSON-style geometry dict or string."""
    if isinstance(val, str):
        try:
            import json
            val = json.loads(val)
        except (json.JSONDecodeError, ValueError):
            try:
                val = ast.literal_eval(val)
            except (ValueError, SyntaxError):
                return (np.nan, np.nan)

    if not isinstance(val, dict):
        return (np.nan, np.nan)

    geom_type = val.get("type", "")
    coords = val.get("coordinates", [])

    try:
        if geom_type == "Point":
            return (coords[1], coords[0])  # [lon, lat] -> (lat, lon)

        # Collect all coordinate points from any geometry type
        all_points = []
        if geom_type == "Polygon":
            for ring in coords:
                all_points.extend(ring)
        elif geom_type == "MultiPolygon":
            for polygon in coords:
                for ring in polygon:
                    all_points.extend(ring)
        elif geom_type in ("LineString", "MultiPoint"):
            all_points = coords
        elif geom_type == "MultiLineString":
            for line in coords:
                all_points.extend(line)

        if all_points:
            lons = [p[0] for p in all_points]
            lats = [p[1] for p in all_points]
            return (sum(lats) / len(lats), sum(lons) / len(lons))
    except (IndexError, TypeError):
        pass

    return (np.nan, np.nan)


def filter_winnipeg(df: pd.DataFrame) -> pd.DataFrame:
    """Drop rows outside the Winnipeg bounding box."""
    b = WINNIPEG_BOUNDS
    mask = (
        df["latitude"].between(b["lat_min"], b["lat_max"])
        & df["longitude"].between(b["lon_min"], b["lon_max"])
    )
    dropped = len(df) - mask.sum()
    if dropped > 0:
        print(f"    Dropped {dropped} rows outside Winnipeg bounds")
    return df[mask].reset_index(drop=True)


def clean_dataset(df: pd.DataFrame, category: str, name_col: str | None = None) -> pd.DataFrame:
    """
    Standardize a single dataset:
      1. Extract coordinates
      2. Filter to Winnipeg bounds
      3. Keep key columns: name, latitude, longitude, category
    """
    df = extract_coords(df)
    df = df.dropna(subset=["latitude", "longitude"])
    df = filter_winnipeg(df)

    # Try to find a name column
    if name_col is None:
        name_col_found = _find_col(df, ["name", "park_name", "facility_name", "title", "asset_name"])
        if name_col_found:
            name_col = name_col_found

    result = pd.DataFrame({
        "name": df[name_col].fillna("Unknown") if name_col and name_col in df.columns else "Unknown",
        "latitude": df["latitude"],
        "longitude": df["longitude"],
        "category": category,
    })
    return result.reset_index(drop=True)


def merge_all(datasets: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Clean and merge all datasets into one unified DataFrame.
    
    Parameters
    ----------
    datasets : dict mapping category name -> raw DataFrame

    Returns
    -------
    pd.DataFrame with columns: name, latitude, longitude, category
    """
    CATEGORY_MAP = {
        "parks": "Park",
        "recreation": "Recreation",
        "public_art": "Public Art",
        "transit_stops": "Transit",
        "restaurants": "Restaurant",
        "arts_culture": "Arts & Culture",
    }

    frames = []
    for key, df in datasets.items():
        cat = CATEGORY_MAP.get(key, key.title())
        print(f"  Cleaning {cat}...")
        cleaned = clean_dataset(df, category=cat)
        print(f"    -> {len(cleaned)} clean rows")
        frames.append(cleaned)

    combined = pd.concat(frames, ignore_index=True)
    print(f"\n  Combined dataset: {len(combined)} locations")
    return combined
