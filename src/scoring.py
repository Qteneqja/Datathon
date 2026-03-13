"""
Experience Score calculator.

Two scoring systems:

1. **Grid-based Experience Score** (original)
   Divides Winnipeg into a grid and scores each cell based on the
   density of nearby experiences.

2. **Per-location Tourism Score** (new)
   Assigns a 0–100 score to each individual location using:

       tourism_score =
           0.35 * popularity_score
         + 0.25 * transit_accessibility
         + 0.20 * category_diversity
         + 0.20 * location_cluster_score

   Where:
   - popularity_score:        Proxy derived from how many other attractions
                              cluster nearby (density within 1 km).
   - transit_accessibility:   Inverse-distance score to the nearest transit
                              stop (closer = higher score). Uses transit_stops.csv
                              via src/transit_utils.py.
   - category_diversity:      Rewards locations surrounded by a diverse mix
                              of attraction categories within 1 km.
   - location_cluster_score:  Rewards locations in high-density clusters
                              (more neighbours within 1 km = higher score).
"""

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans

from src.config import GRID_WEIGHTS as _CFG_GRID_WEIGHTS
from src.config import TOURISM_WEIGHTS as _CFG_TOURISM_WEIGHTS

# ---------------------------------------------------------------------------
# Grid-based scoring
# ---------------------------------------------------------------------------

# Kept as module-level aliases so existing imports still work.
DEFAULT_WEIGHTS = _CFG_GRID_WEIGHTS


def build_grid(
    lat_min: float = 49.80,
    lat_max: float = 49.95,
    lon_min: float = -97.25,
    lon_max: float = -97.05,
    resolution: int = 30,
) -> pd.DataFrame:
    """Create a grid of cells covering Winnipeg."""
    lats = np.linspace(lat_min, lat_max, resolution)
    lons = np.linspace(lon_min, lon_max, resolution)
    grid = pd.DataFrame(
        [(lat, lon) for lat in lats for lon in lons],
        columns=["grid_lat", "grid_lon"],
    )
    return grid


def score_grid(
    locations: pd.DataFrame,
    grid: pd.DataFrame | None = None,
    radius_km: float = 1.0,
    weights: dict[str, float] | None = None,
) -> pd.DataFrame:
    """
    For each grid cell, count nearby locations by category and compute
    a weighted Experience Score.

    Parameters
    ----------
    locations : merged DataFrame (name, latitude, longitude, category)
    grid : grid DataFrame; built automatically if None
    radius_km : search radius in km
    weights : category -> weight multiplier

    Returns
    -------
    grid DataFrame with added score columns
    """
    if grid is None:
        grid = build_grid()
    if weights is None:
        weights = DEFAULT_WEIGHTS

    # Pre-compute radians for haversine
    loc_rad = np.radians(locations[["latitude", "longitude"]].values)
    categories = locations["category"].values

    scores = []
    for _, cell in grid.iterrows():
        cell_rad = np.radians([cell["grid_lat"], cell["grid_lon"]])
        dists = _haversine_vec(cell_rad, loc_rad)
        nearby = dists <= radius_km

        cell_scores = {}
        total = 0.0
        for cat, w in weights.items():
            count = int(((categories == cat) & nearby).sum())
            cell_scores[f"n_{cat}"] = count
            total += count * w
        cell_scores["experience_score"] = total
        scores.append(cell_scores)

    score_df = pd.DataFrame(scores)
    grid = pd.concat([grid.reset_index(drop=True), score_df], axis=1)
    return grid


def _haversine_vec(point_rad: np.ndarray, array_rad: np.ndarray) -> np.ndarray:
    """Vectorized haversine distance from one point to array of points (km)."""
    R = 6371.0
    dlat = array_rad[:, 0] - point_rad[0]
    dlon = array_rad[:, 1] - point_rad[1]
    a = np.sin(dlat / 2) ** 2 + np.cos(point_rad[0]) * np.cos(array_rad[:, 0]) * np.sin(dlon / 2) ** 2
    return R * 2 * np.arcsin(np.sqrt(a))


# ---------------------------------------------------------------------------
# Clustering hotspots
# ---------------------------------------------------------------------------

def find_hotspots(locations: pd.DataFrame, n_clusters: int = 8) -> pd.DataFrame:
    """
    Use KMeans to find activity hotspot centers.
    Returns DataFrame with cluster centers and counts.
    """
    coords = locations[["latitude", "longitude"]].dropna()
    km = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
    km.fit(coords)

    locations = locations.copy()
    locations["cluster"] = km.predict(coords)

    centers = pd.DataFrame(km.cluster_centers_, columns=["latitude", "longitude"])
    centers["cluster"] = centers.index
    centers["location_count"] = locations.groupby("cluster").size().values

    # Top categories per cluster
    top_cats = (
        locations.groupby("cluster")["category"]
        .agg(lambda x: x.value_counts().index[0])
        .reset_index()
        .rename(columns={"category": "top_category"})
    )
    centers = centers.merge(top_cats, on="cluster")
    return centers


def score_summary(grid: pd.DataFrame) -> pd.DataFrame:
    """Return top-scored grid cells as a human-readable summary."""
    top = grid.nlargest(10, "experience_score").copy()
    top["rank"] = range(1, len(top) + 1)
    return top[["rank", "grid_lat", "grid_lon", "experience_score"]]


# ---------------------------------------------------------------------------
# Per-location Tourism Score (0–100)
# ---------------------------------------------------------------------------

TOURISM_WEIGHTS = _CFG_TOURISM_WEIGHTS


def _popularity_scores(locations: pd.DataFrame, radius_km: float = 1.0) -> np.ndarray:
    """
    Popularity proxy: count of non-Transit attractions within *radius_km*.
    Normalised to 0–100.
    """
    # Exclude transit stops from counting toward "attractions nearby"
    non_transit = locations[locations["category"] != "Transit"]
    coords_rad = np.radians(locations[["latitude", "longitude"]].values)
    nt_rad = np.radians(non_transit[["latitude", "longitude"]].values)

    counts = np.zeros(len(locations))
    for i, pt in enumerate(coords_rad):
        dists = _haversine_vec(pt, nt_rad)
        # subtract 1 to avoid counting the point itself (if it's non-transit)
        counts[i] = max((dists <= radius_km).sum() - 1, 0)

    mx = counts.max()
    return (counts / mx * 100) if mx > 0 else counts


def _transit_accessibility_scores(locations: pd.DataFrame) -> np.ndarray:
    """
    Transit accessibility: inverse of distance_to_transit_stop.
    If the column is missing, returns zeros.
    Normalised to 0–100 (closest stop = 100).
    """
    if "distance_to_transit_stop" not in locations.columns:
        return np.zeros(len(locations))

    dists = locations["distance_to_transit_stop"].values.copy()
    # Cap at 3 km — anything farther is effectively 0
    dists = np.clip(dists, 0, 3000)
    scores = 1 - (dists / 3000)
    return scores * 100


def _category_diversity_scores(locations: pd.DataFrame, radius_km: float = 1.0) -> np.ndarray:
    """
    Category diversity: number of unique non-Transit categories within *radius_km*,
    normalised to 0–100.
    """
    non_transit = locations[locations["category"] != "Transit"]
    coords_rad = np.radians(locations[["latitude", "longitude"]].values)
    nt_rad = np.radians(non_transit[["latitude", "longitude"]].values)
    nt_cats = non_transit["category"].values

    n_unique_all = len(non_transit["category"].unique())
    scores = np.zeros(len(locations))

    for i, pt in enumerate(coords_rad):
        dists = _haversine_vec(pt, nt_rad)
        nearby_cats = nt_cats[dists <= radius_km]
        n_unique = len(set(nearby_cats))
        scores[i] = n_unique / n_unique_all if n_unique_all > 0 else 0

    return scores * 100


def _location_cluster_scores(locations: pd.DataFrame, radius_km: float = 1.0) -> np.ndarray:
    """
    Location cluster density: total number of locations (all categories)
    within *radius_km*, normalised to 0–100.
    """
    coords_rad = np.radians(locations[["latitude", "longitude"]].values)

    counts = np.zeros(len(locations))
    for i, pt in enumerate(coords_rad):
        dists = _haversine_vec(pt, coords_rad)
        counts[i] = max((dists <= radius_km).sum() - 1, 0)  # exclude self

    mx = counts.max()
    return (counts / mx * 100) if mx > 0 else counts


def compute_tourism_scores(
    locations: pd.DataFrame,
    radius_km: float = 1.0,
    weights: dict[str, float] | None = None,
) -> pd.DataFrame:
    """
    Compute a per-location tourism_score (0–100) and attach component scores.

    Parameters
    ----------
    locations : pd.DataFrame
        Merged locations DataFrame.  Should already contain
        'distance_to_transit_stop' (via transit_utils.add_transit_distances).
    radius_km : float
        Search radius for density calculations.
    weights : dict, optional
        Override the default TOURISM_WEIGHTS.

    Returns
    -------
    pd.DataFrame
        Copy of locations with added columns:
        popularity_score, transit_accessibility, category_diversity,
        location_cluster_score, tourism_score
    """
    if weights is None:
        weights = TOURISM_WEIGHTS

    df = locations.copy()

    print("  Computing popularity scores...")
    pop = _popularity_scores(df, radius_km)
    print("  Computing transit accessibility scores...")
    transit = _transit_accessibility_scores(df)
    print("  Computing category diversity scores...")
    diversity = _category_diversity_scores(df, radius_km)
    print("  Computing location cluster scores...")
    cluster = _location_cluster_scores(df, radius_km)

    df["popularity_score"] = np.round(pop, 2)
    df["transit_accessibility"] = np.round(transit, 2)
    df["category_diversity"] = np.round(diversity, 2)
    df["location_cluster_score"] = np.round(cluster, 2)

    df["tourism_score"] = np.round(
        weights["popularity"] * pop
        + weights["transit_accessibility"] * transit
        + weights["category_diversity"] * diversity
        + weights["location_cluster"] * cluster,
        2,
    )

    print(f"  Tourism scores — min: {df['tourism_score'].min():.1f}, "
          f"max: {df['tourism_score'].max():.1f}, "
          f"mean: {df['tourism_score'].mean():.1f}")

    return df
