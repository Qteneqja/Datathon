/**
 * Map — browsable location list with category colour coding.
 * Web-compatible (no native map dependency).
 * Tap a location to see details and get Google Maps walking directions.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, CategoryColors } from "@/constants/colors";
import CategoryFilter from "@/components/CategoryFilter";
import { fetchLocations } from "@/services/api";
import type { Location } from "@/types";

export default function MapScreen() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = category !== "All" ? { category } : {};
        const data = await fetchLocations(params);
        setLocations(data);
      } catch (e) {
        console.warn("Map data load error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [category]);

  const openDirections = (loc: Location) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}&travelmode=walking`;
    Linking.openURL(url);
  };

  const renderItem = ({ item }: { item: Location }) => {
    const color =
      CategoryColors[item.category as keyof typeof CategoryColors] || Colors.primary;
    const isSelected = selected?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => setSelected(isSelected ? null : item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          <View style={[styles.catDot, { backgroundColor: color }]} />
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardMeta}>
              {item.category} · {item.neighbourhood}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.dirBtn}
            onPress={() => openDirections(item)}
          >
            <Ionicons name="navigate" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {isSelected && (
          <View style={styles.detail}>
            <Text style={styles.detailCoords}>
              {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
            </Text>
            <TouchableOpacity
              style={styles.directionsBtn}
              onPress={() => openDirections(item)}
            >
              <Ionicons name="walk" size={16} color={Colors.white} />
              <Text style={styles.directionsTxt}>Walking Directions</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Category filter */}
      <CategoryFilter selected={new Set(category === "All" ? [] : [category])} onToggle={(c) => setCategory(c === category ? "All" : c)} />

      {/* Legend */}
      <View style={styles.legend}>
        {Object.entries(CategoryColors).map(([cat, color]) => (
          <View key={cat} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{cat}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={locations}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.count}>
              {locations.length} locations
            </Text>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No locations found.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 12,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: Colors.muted, fontWeight: "600" },
  list: { paddingHorizontal: 14, paddingBottom: 30 },
  count: { fontSize: 13, color: Colors.muted, marginBottom: 10, fontWeight: "600" },
  loader: { marginTop: 40 },
  empty: { textAlign: "center", color: Colors.muted, marginTop: 40, fontSize: 15 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.04)",
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowOpacity: 0.12,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: "800", color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.muted, marginTop: 2, fontWeight: "500" },
  dirBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0, 43, 136, 0.06)",
  },
  detail: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 43, 136, 0.06)",
  },
  detailCoords: { fontSize: 12, color: Colors.muted, marginBottom: 10, fontWeight: "500" },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: "flex-start",
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  directionsTxt: { color: Colors.white, fontWeight: "800", fontSize: 13 },
});
