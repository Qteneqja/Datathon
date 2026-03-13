/**
 * Explore — discovery feed of Winnipeg locations.
 * Category filters, search, neighbourhood scroll, and location cards.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import CategoryFilter from "@/components/CategoryFilter";
import LocationCard from "@/components/LocationCard";
import { fetchLocations, fetchNeighbourhoods } from "@/services/api";
import { toggleBookmark, isBookmarked } from "@/services/storage";
import type { Location } from "@/types";

export default function ExploreScreen() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [neighbourhoods, setNeighbourhoods] = useState<string[]>([]);
  const [selectedHood, setSelectedHood] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { category?: string; neighbourhood?: string; search?: string } = {};
      if (category !== "All") params.category = category;
      if (selectedHood) params.neighbourhood = selectedHood;
      if (search.trim()) params.search = search.trim();
      const data = await fetchLocations(params);
      setLocations(data);
    } catch (err) {
      console.warn("Failed to load locations:", err);
    } finally {
      setLoading(false);
    }
  }, [category, selectedHood, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchNeighbourhoods()
      .then(setNeighbourhoods)
      .catch(() => {});
  }, []);

  const handleBookmark = useCallback(async (loc: Location) => {
    const added = await toggleBookmark(loc);
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (added) next.add(loc.id);
      else next.delete(loc.id);
      return next;
    });
  }, []);

  const renderLocation = useCallback(
    ({ item }: { item: Location }) => (
      <LocationCard
        location={item}
        onBookmark={() => handleBookmark(item)}
        isBookmarked={bookmarks.has(item.id)}
      />
    ),
    [bookmarks, handleBookmark]
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Search bar */}
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
          <TouchableOpacity onPress={() => { setSearch(""); }}>
            <Ionicons name="close-circle" size={18} color={Colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter */}
      <CategoryFilter selected={new Set(category === "All" ? [] : [category])} onToggle={(c) => { setCategory(c === category ? "All" : c); setSelectedHood(null); }} />

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
          <Text style={[styles.hoodText, !selectedHood && styles.hoodTextActive]}>
            All Areas
          </Text>
        </TouchableOpacity>
        {neighbourhoods.map((h) => (
          <TouchableOpacity
            key={h}
            style={[styles.hoodChip, selectedHood === h && styles.hoodChipActive]}
            onPress={() => setSelectedHood(selectedHood === h ? null : h)}
          >
            <Text style={[styles.hoodText, selectedHood === h && styles.hoodTextActive]}>
              {h}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={locations}
          renderItem={renderLocation}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginHorizontal: 14,
    marginTop: 12,
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: "500",
  },
  hoodScroll: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 8,
  },
  hoodChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.white,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.08)",
  },
  hoodChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  hoodText: { fontSize: 12, fontWeight: "700", color: Colors.text },
  hoodTextActive: { color: Colors.white },
  list: { paddingHorizontal: 14, paddingBottom: 20 },
  count: {
    fontSize: 13,
    color: Colors.muted,
    marginBottom: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  loader: { marginTop: 40 },
  empty: {
    textAlign: "center",
    color: Colors.muted,
    marginTop: 40,
    fontSize: 15,
    fontWeight: "500",
  },
});
