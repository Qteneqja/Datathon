"""
Mapping and visualization utilities using Folium and Plotly.
"""

import pandas as pd
import numpy as np
import folium
from folium.plugins import HeatMap, MarkerCluster
import plotly.express as px

# Winnipeg center
WINNIPEG_CENTER = [49.8954, -97.1385]

CATEGORY_COLORS = {
    "Park": "green",
    "Recreation": "blue",
    "Public Art": "purple",
    "Restaurant": "red",
    "Transit": "orange",
    "Arts & Culture": "purple",
}

CATEGORY_ICONS = {
    "Park": "tree-deciduous",
    "Recreation": "tower",
    "Public Art": "picture",
    "Restaurant": "cutlery",
    "Transit": "bus",
    "Arts & Culture": "picture",
}


# ---------------------------------------------------------------------------
# Interactive Folium map
# ---------------------------------------------------------------------------

def create_base_map(zoom: int = 12) -> folium.Map:
    """Create a base Folium map centered on Winnipeg."""
    return folium.Map(location=WINNIPEG_CENTER, zoom_start=zoom, tiles="CartoDB positron")


def add_locations(m: folium.Map, locations: pd.DataFrame, use_clusters: bool = True) -> folium.Map:
    """Add location markers to the map, optionally using MarkerCluster.

    Popups display: name, category, tourism score, distance to transit,
    and description (when available).
    """
    if use_clusters:
        cluster = MarkerCluster(name="All Locations")
        target = cluster
    else:
        target = m

    has_score = "tourism_score" in locations.columns
    has_transit = "distance_to_transit_stop" in locations.columns
    has_desc = "description" in locations.columns
    has_neighbourhood = "neighbourhood" in locations.columns

    for _, row in locations.iterrows():
        color = CATEGORY_COLORS.get(row["category"], "gray")
        icon = CATEGORY_ICONS.get(row["category"], "info-sign")

        # Build popup HTML
        popup_lines = [f"<b>{row['name']}</b>", f"<em>{row['category']}</em>"]
        if has_neighbourhood and pd.notna(row.get("neighbourhood")):
            popup_lines.append(f"📍 {row['neighbourhood']}")
        if has_score and pd.notna(row.get("tourism_score")):
            popup_lines.append(f"Tourism Score: <b>{row['tourism_score']:.1f}</b>")
        if has_transit and pd.notna(row.get("distance_to_transit_stop")):
            dist_m = row["distance_to_transit_stop"]
            popup_lines.append(f"Transit: <b>{dist_m:.0f} m</b> to nearest stop")
        if has_desc and pd.notna(row.get("description")) and row["description"]:
            popup_lines.append(f"<br><small>{row['description']}</small>")
        popup_html = "<br>".join(popup_lines)

        folium.Marker(
            location=[row["latitude"], row["longitude"]],
            popup=folium.Popup(popup_html, max_width=280),
            tooltip=row["name"],
            icon=folium.Icon(color=color, icon=icon, prefix="glyphicon"),
        ).add_to(target)

    if use_clusters:
        cluster.add_to(m)
    return m


def add_heatmap(m: folium.Map, locations: pd.DataFrame) -> folium.Map:
    """Add a heatmap layer showing density of all locations."""
    heat_data = locations[["latitude", "longitude"]].dropna().values.tolist()
    HeatMap(heat_data, name="Experience Density", radius=18, blur=15, max_zoom=13).add_to(m)
    return m


def add_score_overlay(m: folium.Map, grid: pd.DataFrame) -> folium.Map:
    """Add circle markers sized/colored by experience score."""
    max_score = grid["experience_score"].max()
    if max_score == 0:
        return m

    score_group = folium.FeatureGroup(name="Experience Score")
    for _, row in grid.iterrows():
        if row["experience_score"] == 0:
            continue
        normalized = row["experience_score"] / max_score
        folium.CircleMarker(
            location=[row["grid_lat"], row["grid_lon"]],
            radius=3 + normalized * 20,
            color=_score_color(normalized),
            fill=True,
            fill_opacity=0.4,
            popup=f"Score: {row['experience_score']:.1f}",
        ).add_to(score_group)
    score_group.add_to(m)
    return m


def add_hotspot_markers(m: folium.Map, hotspots: pd.DataFrame) -> folium.Map:
    """Add large star markers for cluster hotspot centers."""
    for _, row in hotspots.iterrows():
        folium.Marker(
            location=[row["latitude"], row["longitude"]],
            popup=(
                f"<b>Hotspot #{row['cluster']}</b><br>"
                f"Locations nearby: {row['location_count']}<br>"
                f"Top category: {row['top_category']}"
            ),
            icon=folium.Icon(color="darkred", icon="star", prefix="glyphicon"),
        ).add_to(m)
    return m


def build_full_map(
    locations: pd.DataFrame,
    grid: pd.DataFrame,
    hotspots: pd.DataFrame,
    save_path: str = "output/explore_winnipeg_map.html",
) -> folium.Map:
    """Build the complete interactive map with all layers."""
    m = create_base_map()
    m = add_locations(m, locations)
    m = add_heatmap(m, locations)
    m = add_score_overlay(m, grid)
    m = add_hotspot_markers(m, hotspots)
    folium.LayerControl().add_to(m)
    m.save(save_path)
    print(f"  Map saved to {save_path}")
    return m


def _score_color(normalized: float) -> str:
    if normalized > 0.7:
        return "#d73027"
    elif normalized > 0.4:
        return "#fc8d59"
    elif normalized > 0.2:
        return "#fee08b"
    else:
        return "#91cf60"


# ---------------------------------------------------------------------------
# Plotly charts
# ---------------------------------------------------------------------------

def plot_category_counts(locations: pd.DataFrame):
    """Bar chart of location counts by category."""
    counts = locations["category"].value_counts().reset_index()
    counts.columns = ["Category", "Count"]
    fig = px.bar(
        counts, x="Category", y="Count",
        color="Category",
        title="Locations by Category in Winnipeg",
        color_discrete_map=CATEGORY_COLORS,
    )
    fig.update_layout(showlegend=False)
    return fig


def plot_score_heatmap(grid: pd.DataFrame):
    """Plotly scatter map of experience scores."""
    fig = px.scatter_map(
        grid[grid["experience_score"] > 0],
        lat="grid_lat",
        lon="grid_lon",
        size="experience_score",
        color="experience_score",
        color_continuous_scale="YlOrRd",
        zoom=11,
        center={"lat": 49.8954, "lon": -97.1385},
        title="Experience Score Density - Winnipeg",
        size_max=20,
    )
    fig.update_layout(height=600)
    return fig
