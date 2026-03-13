/**
 * Parking — Gryd parking availability screen.
 * Shows nearby Gryd lots with predicted availability and pay buttons.
 */

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import GrydCheckout from "@/components/GrydCheckout";
import {
  GRYD_LOTS,
  GRYD_CHECKOUT_URL,
  predictParking,
  estimateCost,
  findNearestLots,
  ParkingLot,
  ParkingAvailability,
} from "@/constants/parking";

export default function ParkingScreen() {
  const [search, setSearch] = useState("");
  const [checkoutLot, setCheckoutLot] = useState<(typeof lots[0]) | null>(null);

  const lots = useMemo(() => {
    if (!search.trim()) {
      // Default: sort by downtown-first
      return GRYD_LOTS.map((lot) => ({
        ...lot,
        ...predictParking(lot),
        cost: estimateCost(lot),
        distanceM: 0,
      }));
    }
    // Search — use The Forks as reference point for distance
    const results = GRYD_LOTS.filter(
      (l) =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.zone.toLowerCase().includes(search.toLowerCase())
    );
    return results.map((lot) => ({
      ...lot,
      ...predictParking(lot),
      cost: estimateCost(lot),
      distanceM: 0,
    }));
  }, [search]);

  const renderLot = ({ item }: { item: typeof lots[0] }) => {
    const availColor =
      item.availability === "high"
        ? Colors.green
        : item.availability === "moderate"
          ? Colors.gold
          : Colors.error;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.availDot, { backgroundColor: availColor }]} />
          <View style={styles.cardInfo}>
            <Text style={styles.lotName}>{item.name}</Text>
            <Text style={styles.lotZone}>
              {item.zone.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} · {item.capacity} spots
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Availability</Text>
            <Text style={[styles.statValue, { color: availColor }]}>
              {item.emoji} {item.label}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Est. Cost (3h)</Text>
            <Text style={styles.statValue}>{item.cost}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Rate</Text>
            <Text style={styles.statValue}>${item.ratePerHour}/hr</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.payBtn}
          onPress={() => setCheckoutLot(item)}
        >
          <Ionicons name="card" size={16} color={Colors.white} />
          <Text style={styles.payText}>Pay in App</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* In-app Gryd Checkout overlay */}
      {checkoutLot && (
        <GrydCheckout lot={checkoutLot} onClose={() => setCheckoutLot(null)} />
      )}

      {/* Gryd Header */}
      <View style={styles.grydHeader}>
        <View style={styles.grydBrand}>
          <Image
            source={require("@/assets/GrydHalfLogo.png")}
            style={{ width: 168, height: 120, resizeMode: "contain" }}
          />
          <View>
            <Text style={styles.grydTitle}>Gryd Park</Text>
            <Text style={styles.grydSub}>Smart Parking Partner</Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={Colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by lot name or zone..."
          placeholderTextColor={Colors.muted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={Colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.green }]} />
          <Text style={styles.legendLabel}>High</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.gold }]} />
          <Text style={styles.legendLabel}>Moderate</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
          <Text style={styles.legendLabel}>Limited</Text>
        </View>
      </View>

      {/* Lot list */}
      <FlatList
        data={lots}
        renderItem={renderLot}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.count}>{lots.length} parking lots</Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No lots found.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  grydHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  grydBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  grydTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  grydSub: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: "600",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginHorizontal: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.08)",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: "500",
  },
  legend: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 18,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: Colors.muted, fontWeight: "600" },
  list: { paddingHorizontal: 14, paddingBottom: 20 },
  count: {
    fontSize: 13,
    color: Colors.muted,
    marginBottom: 10,
    fontWeight: "600",
  },
  empty: {
    textAlign: "center",
    color: Colors.muted,
    marginTop: 40,
    fontSize: 15,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.06)",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  availDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  cardInfo: { flex: 1 },
  lotName: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
  },
  lotZone: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 43, 136, 0.06)",
  },
  stat: { alignItems: "center", flex: 1 },
  statLabel: { fontSize: 10, color: Colors.muted, marginBottom: 3, fontWeight: "600" },
  statValue: { fontSize: 13, fontWeight: "800", color: Colors.text },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  payText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.white,
  },
});
