"""
Data loading utilities for Explore Winnipeg.
Fetches datasets from the Winnipeg Open Data Portal and Google Places API.
"""

import pandas as pd
import requests
import json
import os
import time

# ---------------------------------------------------------------------------
# Winnipeg Open Data Portal endpoints (CKAN / Socrata style)
# Update these resource IDs once you confirm them on the portal.
# ---------------------------------------------------------------------------

WINNIPEG_DATA = {
    "parks": {
        "url": "https://data.winnipeg.ca/resource/tx3d-pfxq.json",
        "label": "Parks",
        "format": "json",
    },
    "recreation": {
        "url": "https://data.winnipeg.ca/resource/bmi4-vvs2.json",
        "label": "Recreation Facilities",
        "format": "json",
    },
    "public_art": {
        "url": "https://data.winnipeg.ca/resource/dkdk-hn3c.json",
        "label": "Public Art",
        "format": "json",
    },
}

# ---------------------------------------------------------------------------
# Google Places API config
# Set your API key here or via environment variable GOOGLE_PLACES_API_KEY
# ---------------------------------------------------------------------------

GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "YOUR_API_KEY_HERE")

# ---------------------------------------------------------------------------
# Winnipeg Transit API
# ---------------------------------------------------------------------------

WINNIPEG_TRANSIT_API_KEY = os.environ.get("WINNIPEG_TRANSIT_API_KEY", "")
WINNIPEG_TRANSIT_BASE = "https://api.winnipegtransit.com/v3"

# ---------------------------------------------------------------------------
# OpenStreetMap Overpass queries
# ---------------------------------------------------------------------------

OVERPASS_URLS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]
OVERPASS_URL = OVERPASS_URLS[0]

# Place types to search — extend this list to pull more categories
GOOGLE_PLACE_TYPES = {
    "restaurants": "restaurant",
    "cafes": "cafe",
    "bars": "bar",
}

# Fallback: OpenStreetMap Overpass query (used if Google API key not set)
RESTAURANT_QUERY = """
[out:json][timeout:30];
area["name"="Winnipeg"]["admin_level"="6"]->.wpg;
(
  node["amenity"="restaurant"](area.wpg);
  way["amenity"="restaurant"](area.wpg);
);
out center;
"""

# Arts, culture & attractions in Winnipeg (bbox approach — faster)
ARTS_CULTURE_QUERY = """
[out:json][timeout:60];
(
  node["tourism"="artwork"](49.75,-97.35,49.99,-96.95);
  node["tourism"="museum"](49.75,-97.35,49.99,-96.95);
  node["tourism"="gallery"](49.75,-97.35,49.99,-96.95);
  node["tourism"="attraction"](49.75,-97.35,49.99,-96.95);
  node["amenity"="arts_centre"](49.75,-97.35,49.99,-96.95);
  node["amenity"="theatre"](49.75,-97.35,49.99,-96.95);
  node["amenity"="cinema"](49.75,-97.35,49.99,-96.95);
  way["tourism"="museum"](49.75,-97.35,49.99,-96.95);
  way["tourism"="attraction"](49.75,-97.35,49.99,-96.95);
  way["amenity"="theatre"](49.75,-97.35,49.99,-96.95);
);
out center;
"""

# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------

def fetch_geojson(url: str, label: str) -> pd.DataFrame:
    """Fetch a GeoJSON endpoint and flatten into a DataFrame with lat/lon."""
    print(f"  Fetching {label} (GeoJSON)...")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    rows = []
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})
        coords = geom.get("coordinates")

        # GeoJSON coordinates are [lon, lat] (or nested for polygons)
        if geom.get("type") == "Point" and coords:
            props["longitude"] = coords[0]
            props["latitude"] = coords[1]
        elif geom.get("type") in ("Polygon", "MultiPolygon") and coords:
            # Use centroid of first ring for polygons
            ring = coords[0] if geom["type"] == "Polygon" else coords[0][0]
            lons = [c[0] for c in ring]
            lats = [c[1] for c in ring]
            props["longitude"] = sum(lons) / len(lons)
            props["latitude"] = sum(lats) / len(lats)

        rows.append(props)

    df = pd.DataFrame(rows)
    print(f"  -> {len(df)} rows")
    return df


def fetch_winnipeg_dataset(key: str, limit: int = 50000) -> pd.DataFrame:
    """Fetch a single dataset from the Winnipeg Open Data Portal."""
    info = WINNIPEG_DATA[key]
    fmt = info.get("format", "json")

    if fmt == "geojson":
        return fetch_geojson(info["url"], info["label"])

    url = f"{info['url']}?$limit={limit}"
    print(f"  Fetching {info['label']}...")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    df = pd.DataFrame(resp.json())
    print(f"  -> {len(df)} rows")
    return df


def fetch_google_places(
    place_type: str = "restaurant",
    radius_m: int = 15000,
    api_key: str | None = None,
) -> pd.DataFrame:
    """
    Fetch places in Winnipeg using Google Places API (Nearby Search).

    Uses pagination (next_page_token) to get up to 60 results per type.
    For broader coverage, call this with multiple grid points or types.
    """
    key = api_key or GOOGLE_PLACES_API_KEY
    if key == "YOUR_API_KEY_HERE":
        return pd.DataFrame()  # Caller handles fallback

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{WINNIPEG_LAT},{WINNIPEG_LON}",
        "radius": radius_m,
        "type": place_type,
        "key": key,
    }

    rows = []
    print(f"  Fetching {place_type}s (Google Places API)...")

    while True:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            print(f"  ⚠ Google API error: {data.get('status')} - {data.get('error_message', '')}")
            break

        for place in data.get("results", []):
            loc = place.get("geometry", {}).get("location", {})
            rows.append({
                "name": place.get("name", "Unknown"),
                "latitude": loc.get("lat"),
                "longitude": loc.get("lng"),
                "rating": place.get("rating"),
                "user_ratings_total": place.get("user_ratings_total"),
                "price_level": place.get("price_level"),
                "vicinity": place.get("vicinity", ""),
                "place_type": place_type,
            })

        # Google returns up to 20 results per page, 3 pages max
        next_token = data.get("next_page_token")
        if not next_token:
            break
        # Google requires a short delay before using next_page_token
        time.sleep(2)
        params = {"pagetoken": next_token, "key": key}

    df = pd.DataFrame(rows)
    print(f"  -> {len(df)} rows")
    return df


def fetch_all_google_places(api_key: str | None = None) -> pd.DataFrame:
    """Fetch all configured Google place types and combine. Falls back to OSM."""
    key = api_key or GOOGLE_PLACES_API_KEY
    if key == "YOUR_API_KEY_HERE":
        print("  ⚠ No Google API key set — falling back to OpenStreetMap")
        return fetch_restaurants_osm()

    frames = []
    for label, ptype in GOOGLE_PLACE_TYPES.items():
        df = fetch_google_places(place_type=ptype, api_key=key)
        frames.append(df)
    if not frames:
        return pd.DataFrame()
    combined = pd.concat(frames, ignore_index=True)
    # Deduplicate by name + location
    combined = combined.drop_duplicates(subset=["name", "latitude", "longitude"])
    print(f"  Total Google Places (deduplicated): {len(combined)}")
    return combined


def fetch_restaurants_osm() -> pd.DataFrame:
    """Fallback: Fetch restaurants from OpenStreetMap via Overpass API."""
    print("  Fetching Restaurants (OpenStreetMap fallback)...")
    resp = None
    for url in OVERPASS_URLS:
        try:
            resp = requests.post(url, data={"data": RESTAURANT_QUERY}, timeout=60)
            resp.raise_for_status()
            break
        except Exception:
            resp = None
    if resp is None:
        raise RuntimeError("All Overpass servers failed for restaurants")
    elements = resp.json().get("elements", [])

    rows = []
    for el in elements:
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        name = el.get("tags", {}).get("name", "Unnamed Restaurant")
        cuisine = el.get("tags", {}).get("cuisine", "")
        rows.append({"name": name, "latitude": lat, "longitude": lon, "cuisine": cuisine})

    df = pd.DataFrame(rows)
    print(f"  -> {len(df)} rows")
    return df


# ---------------------------------------------------------------------------
# Winnipeg Transit API loader
# ---------------------------------------------------------------------------

def fetch_transit_stops(api_key: str | None = None) -> pd.DataFrame:
    """
    Fetch all transit stops in Winnipeg by querying a grid of points.
    The API returns stops near a lat/lon, so we tile the city.
    """
    key = api_key or WINNIPEG_TRANSIT_API_KEY
    print("  Fetching Transit Stops (Winnipeg Transit API)...")

    import numpy as np
    # Grid covering Winnipeg
    lats = np.linspace(49.78, 49.96, 8)
    lons = np.linspace(-97.27, -97.05, 8)

    seen_keys = set()
    rows = []

    for lat in lats:
        for lon in lons:
            try:
                resp = requests.get(
                    f"{WINNIPEG_TRANSIT_BASE}/stops.json",
                    params={"api-key": key, "lat": f"{lat:.5f}", "lon": f"{lon:.5f}", "distance": "2000"},
                    timeout=15,
                )
                if resp.status_code != 200:
                    continue
                stops = resp.json().get("stops", [])
                for s in stops:
                    stop_key = s.get("key")
                    if stop_key in seen_keys:
                        continue
                    seen_keys.add(stop_key)
                    geo = s.get("centre", {}).get("geographic", {})
                    rows.append({
                        "name": s.get("name", "Unknown Stop"),
                        "latitude": float(geo.get("latitude", 0)),
                        "longitude": float(geo.get("longitude", 0)),
                        "stop_number": stop_key,
                        "direction": s.get("direction", ""),
                        "street": s.get("street", {}).get("name", ""),
                    })
            except Exception:
                continue

    df = pd.DataFrame(rows)
    print(f"  -> {len(df)} unique stops")
    return df


# ---------------------------------------------------------------------------
# OpenStreetMap arts & culture loader
# ---------------------------------------------------------------------------

def fetch_arts_culture() -> pd.DataFrame:
    """Fetch public art, museums, galleries, theatres, and attractions from OSM."""
    print("  Fetching Arts & Culture (OpenStreetMap)...")
    resp = None
    for url in OVERPASS_URLS:
        try:
            print(f"    Trying {url} ...")
            resp = requests.post(url, data={"data": ARTS_CULTURE_QUERY}, timeout=90)
            resp.raise_for_status()
            break
        except Exception as e:
            print(f"    Failed: {e}")
            resp = None
    if resp is None:
        raise RuntimeError("All Overpass servers failed")
    elements = resp.json().get("elements", [])

    rows = []
    for el in elements:
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        tags = el.get("tags", {})
        name = tags.get("name", "Unnamed")
        # Determine sub-type
        art_type = (
            tags.get("tourism")
            or tags.get("amenity")
            or "artwork"
        )
        rows.append({
            "name": name,
            "latitude": lat,
            "longitude": lon,
            "art_type": art_type,
        })

    df = pd.DataFrame(rows)
    print(f"  -> {len(df)} rows")
    return df


def load_all_datasets(cache_dir: str = "data") -> dict[str, pd.DataFrame]:
    """
    Load all datasets. Caches to CSV so you only hit the API once.
    Returns dict mapping category -> DataFrame.
    """
    os.makedirs(cache_dir, exist_ok=True)
    datasets = {}

    # Winnipeg portal datasets
    for key in WINNIPEG_DATA:
        cache_path = os.path.join(cache_dir, f"{key}.csv")
        if os.path.exists(cache_path):
            print(f"  Loading cached {key}...")
            datasets[key] = pd.read_csv(cache_path)
        else:
            try:
                datasets[key] = fetch_winnipeg_dataset(key)
                datasets[key].to_csv(cache_path, index=False)
            except Exception as e:
                print(f"  ⚠ Failed to fetch {key}: {e}")
                print(f"    Skipping — add a CSV to data/{key}.csv or update the URL")

    # Transit stops (Winnipeg Transit API)
    cache_path = os.path.join(cache_dir, "transit_stops.csv")
    if os.path.exists(cache_path):
        print("  Loading cached transit_stops...")
        datasets["transit_stops"] = pd.read_csv(cache_path)
    else:
        try:
            datasets["transit_stops"] = fetch_transit_stops()
            datasets["transit_stops"].to_csv(cache_path, index=False)
        except Exception as e:
            print(f"  ⚠ Failed to fetch transit stops: {e}")

    # Restaurants / food places (Google Places → OSM fallback)
    cache_path = os.path.join(cache_dir, "restaurants.csv")
    if os.path.exists(cache_path):
        print("  Loading cached restaurants...")
        datasets["restaurants"] = pd.read_csv(cache_path)
    else:
        try:
            datasets["restaurants"] = fetch_all_google_places()
            datasets["restaurants"].to_csv(cache_path, index=False)
        except Exception as e:
            print(f"  ⚠ Failed to fetch restaurants: {e}")
            print(f"    Skipping — add a CSV to data/restaurants.csv or set GOOGLE_PLACES_API_KEY")

    # Arts & culture (replaces public_art — from OpenStreetMap)
    cache_path = os.path.join(cache_dir, "arts_culture.csv")
    if os.path.exists(cache_path):
        print("  Loading cached arts_culture...")
        datasets["arts_culture"] = pd.read_csv(cache_path)
    else:
        try:
            df = fetch_arts_culture()
            if not df.empty:
                datasets["arts_culture"] = df
                df.to_csv(cache_path, index=False)
        except Exception as e:
            print(f"  ⚠ Failed to fetch arts & culture: {e}")

    return datasets


# ---------------------------------------------------------------------------
# Fallback: load from local CSVs if APIs are unavailable
# ---------------------------------------------------------------------------

def load_from_csv(data_dir: str = "data") -> dict[str, pd.DataFrame]:
    """Load all datasets from local CSV files in data/."""
    datasets = {}
    for filename in os.listdir(data_dir):
        if filename.endswith(".csv"):
            key = filename.replace(".csv", "")
            datasets[key] = pd.read_csv(os.path.join(data_dir, filename))
            print(f"  Loaded {key}: {len(datasets[key])} rows")
    return datasets
