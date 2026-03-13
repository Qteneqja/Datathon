"""
Transit proximity utilities.

Calculates the distance from any location to the nearest Winnipeg Transit stop
using the haversine formula. Used by the scoring module to compute
transit_accessibility scores.
"""

import numpy as np
import pandas as pd


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth
    using the haversine formula.

    Parameters
    ----------
    lat1, lon1 : float
        Latitude and longitude of the first point in decimal degrees.
    lat2, lon2 : float
        Latitude and longitude of the second point in decimal degrees.

    Returns
    -------
    float
        Distance in meters.
    """
    R = 6_371_000  # Earth radius in meters
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return R * 2 * np.arcsin(np.sqrt(a))


def calculate_nearest_transit_stop(lat: float, lon: float, transit_df: pd.DataFrame) -> float:
    """
    Find the distance (in meters) from a single point to the nearest transit stop.

    Parameters
    ----------
    lat : float
        Latitude of the location.
    lon : float
        Longitude of the location.
    transit_df : pd.DataFrame
        DataFrame of transit stops with 'latitude' and 'longitude' columns.

    Returns
    -------
    float
        Distance in meters to the nearest transit stop.
        Returns np.inf if transit_df is empty.
    """
    if transit_df.empty:
        return np.inf

    # Vectorised haversine against all transit stops
    stop_lats = transit_df["latitude"].values
    stop_lons = transit_df["longitude"].values

    R = 6_371_000
    lat_r = np.radians(lat)
    lon_r = np.radians(lon)
    stop_lats_r = np.radians(stop_lats)
    stop_lons_r = np.radians(stop_lons)

    dlat = stop_lats_r - lat_r
    dlon = stop_lons_r - lon_r
    a = (
        np.sin(dlat / 2) ** 2
        + np.cos(lat_r) * np.cos(stop_lats_r) * np.sin(dlon / 2) ** 2
    )
    distances = R * 2 * np.arcsin(np.sqrt(a))
    return float(np.min(distances))


def add_transit_distances(locations_df: pd.DataFrame, transit_df: pd.DataFrame) -> pd.DataFrame:
    """
    Add a 'distance_to_transit_stop' column (in meters) to a locations DataFrame.

    Parameters
    ----------
    locations_df : pd.DataFrame
        Merged locations with 'latitude' and 'longitude' columns.
    transit_df : pd.DataFrame
        Transit stops DataFrame with 'latitude' and 'longitude' columns.

    Returns
    -------
    pd.DataFrame
        Copy of locations_df with added 'distance_to_transit_stop' column.
    """
    df = locations_df.copy()

    if transit_df.empty:
        df["distance_to_transit_stop"] = np.inf
        return df

    # Pre-compute radians for all transit stops once
    R = 6_371_000
    stop_lats_r = np.radians(transit_df["latitude"].values)
    stop_lons_r = np.radians(transit_df["longitude"].values)

    distances = []
    for _, row in df.iterrows():
        lat_r = np.radians(row["latitude"])
        lon_r = np.radians(row["longitude"])
        dlat = stop_lats_r - lat_r
        dlon = stop_lons_r - lon_r
        a = (
            np.sin(dlat / 2) ** 2
            + np.cos(lat_r) * np.cos(stop_lats_r) * np.sin(dlon / 2) ** 2
        )
        dists = R * 2 * np.arcsin(np.sqrt(a))
        distances.append(float(np.min(dists)))

    df["distance_to_transit_stop"] = distances
    return df
