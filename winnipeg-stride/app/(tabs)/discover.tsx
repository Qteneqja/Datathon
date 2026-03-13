/**
 * Discover — unified discovery screen with List / Map toggle.
 * List view: search, category filters, neighbourhood scroll, LocationCards.
 * Map view: real interactive Leaflet map with category-coloured markers.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  SafeAreaView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { Colors, CategoryColors } from "@/constants/colors";
import CategoryFilter from "@/components/CategoryFilter";
import LocationCard from "@/components/LocationCard";
import { fetchLocations, fetchNeighbourhoods } from "@/services/api";
import { toggleBookmark } from "@/services/storage";
import type { Location } from "@/types";

type ViewMode = "list" | "map";

/** Build self-contained Leaflet HTML for a list of POIs. */
function buildMapHtml(locs: Location[], activeCategories: Set<string>): string {
  const catColors: Record<string, string> = {
    Park: "#08C44A",
    Restaurant: "#F97316",
    "Arts & Culture": "#9484BE",
    Recreation: "#002b88",
    "Public Art": "#F5B312",
    Transit: "#6B7280",
  };

  const filtered = activeCategories.size === 0
    ? locs
    : locs.filter((l) => activeCategories.has(l.category));

  const markers = filtered
    .map((l) => {
      const c = catColors[l.category] || "#002b88";
      const safeName = l.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
      const safeHood = (l.neighbourhood || "").replace(/'/g, "\\'");
      return `clusters.addLayer(L.circleMarker([${l.latitude},${l.longitude}],{radius:6,fillColor:'${c}',color:'#fff',weight:1.5,fillOpacity:0.92}).bindPopup('<b>${safeName}</b><br/>${l.category} · ${safeHood}<br/><a href="https://www.google.com/maps/dir/?api=1&destination=${l.latitude},${l.longitude}&travelmode=walking" target="_blank" style="color:#002b88;font-weight:700">Directions ↗</a>'));`;
    })
    .join("\n");

  // Build legend items
  const legendItems = Object.entries(catColors)
    .map(([cat, color]) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px"><span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span><span style="font-size:11px;font-weight:600;color:#6B7280">${cat}</span></span>`)
    .join("");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"><\/script>
<style>
html,body{margin:0;padding:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
#map{width:100%;height:100%}
#legend{position:absolute;bottom:8px;left:8px;right:8px;z-index:999;background:rgba(255,255,255,0.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-radius:10px;padding:6px 10px;display:flex;flex-wrap:wrap;gap:3px;box-shadow:0 2px 8px rgba(0,43,136,0.1);pointer-events:none}
#count{position:absolute;top:8px;right:8px;z-index:999;background:rgba(0,43,136,0.88);color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:16px;pointer-events:none}
.leaflet-popup-content{font-family:-apple-system,sans-serif;font-size:13px;line-height:1.5}
.marker-cluster{background:rgba(0,43,136,0.18)!important}
.marker-cluster div{background:rgba(0,43,136,0.72)!important;color:#fff!important;font-weight:700;font-size:12px}
</style>
</head><body>
<div id="map"></div>
<div id="legend">${legendItems}</div>
<div id="count">${filtered.length} locations</div>
<script>
var map=L.map('map',{zoomControl:false}).setView([49.8951,-97.1384],12);
L.control.zoom({position:'bottomright'}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
  attribution:'&copy; OSM & CARTO',maxZoom:18
}).addTo(map);
var clusters=L.markerClusterGroup({maxClusterRadius:45,spiderfyOnMaxZoom:true,showCoverageOnHover:false,disableClusteringAtZoom:15});
${markers}
map.addLayer(clusters);
<\/script>
</body></html>`;
}

export default function DiscoverScreen() {
  const [mode, setMode] = useState<ViewMode>("list");
  const [locations, setLocations] = useState<Location[]>([]);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [neighbourhoods, setNeighbourhoods] = useState<string[]>([]);
  const [selectedHood, setSelectedHood] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load all locations once for the map (unfiltered by search/hood)
  useEffect(() => {
    fetchLocations({}).then(setAllLocations).catch(() => {});
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { category?: string; neighbourhood?: string; search?: string } = {};
      // For the API, send first active category (API supports single); client filters the rest
      if (activeCategories.size === 1) params.category = [...activeCategories][0];
      if (selectedHood) params.neighbourhood = selectedHood;
      if (search.trim()) params.search = search.trim();
      const data = await fetchLocations(params);
      // Client-side multi-category filter
      const filtered = activeCategories.size > 1
        ? data.filter((l) => activeCategories.has(l.category))
        : data;
      setLocations(filtered);
    } catch (err) {
      console.warn("Failed to load locations:", err);
    } finally {
      setLoading(false);
    }
  }, [activeCategories, selectedHood, search]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    fetchNeighbourhoods().then(setNeighbourhoods).catch(() => {});
  }, []);

  const handleBookmark = useCallback(async (loc: Location) => {
    const added = await toggleBookmark(loc);
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (added) next.add(loc.id); else next.delete(loc.id);
      return next;
    });
  }, []);

  /* ---- List-view card ---- */
  const renderListItem = useCallback(
    ({ item }: { item: Location }) => (
      <LocationCard
        location={item}
        onBookmark={() => handleBookmark(item)}
        isBookmarked={bookmarks.has(item.id)}
      />
    ),
    [bookmarks, handleBookmark]
  );

  /** Leaflet HTML — memoised so it only rebuilds when data/category changes. */
  const mapHtml = useMemo(
    () => buildMapHtml(allLocations.length > 0 ? allLocations : locations, activeCategories),
    [allLocations, locations, activeCategories]
  );

  /** Render the interactive WebView map (or iframe on web). */
  const renderMap = () => {
    if (Platform.OS === "web") {
      return (
        <iframe
          srcDoc={mapHtml}
          style={{ flex: 1, border: "none", width: "100%", height: "100%" } as any}
        />
      );
    }
    return (
      <WebView
        originWhitelist={["*"]}
        source={{ html: mapHtml }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === "list" && styles.toggleActive]}
          onPress={() => setMode("list")}
        >
          <Ionicons name="list" size={16} color={mode === "list" ? Colors.white : Colors.primary} />
          <Text style={[styles.toggleText, mode === "list" && styles.toggleTextActive]}>List</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === "map" && styles.toggleActive]}
          onPress={() => setMode("map")}
        >
          <Ionicons name="map" size={16} color={mode === "map" ? Colors.white : Colors.primary} />
          <Text style={[styles.toggleText, mode === "map" && styles.toggleTextActive]}>Map</Text>
        </TouchableOpacity>
      </View>

      {/* Category filter — compact chip bar */}
      <CategoryFilter
        selected={activeCategories}
        onToggle={(c) => { toggleCategory(c); setSelectedHood(null); }}
      />

      {mode === "list" ? (
        <>
          {/* Search (list mode only) */}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={Colors.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search locations..."
              placeholderTextColor={Colors.muted}
              returnKeyType="search"
              onSubmitEditing={loadData}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color={Colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Neighbourhood scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hoodScroll}
          >
            <TouchableOpacity
              style={[styles.hoodChip, !selectedHood && styles.hoodChipActive]}
              onPress={() => setSelectedHood(null)}
            >
              <Text style={[styles.hoodText, !selectedHood && styles.hoodTextActive]}>All Areas</Text>
            </TouchableOpacity>
            {neighbourhoods.map((h) => (
              <TouchableOpacity
                key={h}
                style={[styles.hoodChip, selectedHood === h && styles.hoodChipActive]}
                onPress={() => setSelectedHood(selectedHood === h ? null : h)}
              >
                <Text style={[styles.hoodText, selectedHood === h && styles.hoodTextActive]}>{h}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* List results */}
          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={locations}
              renderItem={renderListItem}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>No locations found. Try a different filter.</Text>
              }
              ListHeaderComponent={
                <Text style={styles.count}>{locations.length} locations</Text>
              }
            />
          )}
        </>
      ) : (
        /* Real interactive map */
        <View style={styles.mapContainer}>
          {renderMap()}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  /* Toggle */
  toggleRow: {
    flexDirection: "row",
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 2,
    backgroundColor: "rgba(0, 43, 136, 0.06)",
    borderRadius: 12,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  toggleText: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  toggleTextActive: { color: Colors.white },

  /* Search */
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginHorizontal: 14,
    marginTop: 8,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.08)",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: "500" },

  /* Hoods */
  hoodScroll: { paddingHorizontal: 14, paddingBottom: 8, gap: 8 },
  hoodChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.white,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.08)",
  },
  hoodChipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  hoodText: { fontSize: 12, fontWeight: "700", color: Colors.text },
  hoodTextActive: { color: Colors.white },

  /* Map container — fills all remaining space */
  mapContainer: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.06)",
  },

  /* Shared list */
  list: { paddingHorizontal: 14, paddingBottom: 20 },
  count: { fontSize: 13, color: Colors.muted, marginBottom: 10, fontWeight: "600", letterSpacing: 0.2 },
  loader: { marginTop: 40 },
  empty: { textAlign: "center", color: Colors.muted, marginTop: 40, fontSize: 15, fontWeight: "500" },
});
