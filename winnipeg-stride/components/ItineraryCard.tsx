/**
 * ItineraryCard — renders a single itinerary stop with premium timeline,
 * parking info, and action buttons.
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, CategoryColors } from "@/constants/colors";
import {
  findNearestLots,
  predictParking,
  estimateCost,
  GRYD_CHECKOUT_URL,
} from "@/constants/parking";

const CATEGORY_ICONS: Record<string, string> = {
  Park: "leaf",
  Restaurant: "restaurant",
  "Arts & Culture": "color-palette",
  Recreation: "fitness",
  "Public Art": "brush",
  Transit: "bus",
};

export interface ItineraryStopData {
  stopNumber: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  walkMinutes?: number;
  driveMinutes?: number;
  usesDriving?: boolean;
  time?: string;
  neighbourhood?: string;
  reason?: string;
}

interface Props {
  stop: ItineraryStopData;
  previousStop?: ItineraryStopData;
  showParking?: boolean;
  showBooking?: boolean;
  transportMode?: "walk" | "drive";
}

export default function ItineraryCard({
  stop,
  previousStop,
  showParking = false,
  showBooking = false,
  transportMode = "walk",
}: Props) {
  const catColor =
    CategoryColors[stop.category as keyof typeof CategoryColors] || Colors.primary;
  const iconName = CATEGORY_ICONS[stop.category] || "location";
  const nearestLot = showParking
    ? findNearestLots(stop.latitude, stop.longitude, 1)[0]
    : null;
  const parkingInfo = nearestLot ? predictParking(nearestLot) : null;
  const isRestaurant = stop.category === "Restaurant";

  return (
    <View style={styles.container}>
      {/* Travel connector from previous stop */}
      {previousStop && (stop.walkMinutes != null || stop.driveMinutes != null) && (
        <View style={styles.travelRow}>
          <View style={styles.travelLine}>
            <View style={styles.travelDot} />
            <View style={styles.travelDotEnd} />
          </View>
          <View style={styles.travelBadge}>
            <Ionicons
              name={stop.usesDriving ? "car" : "walk"}
              size={12}
              color={Colors.muted}
            />
            <Text style={styles.travelText}>
              {stop.usesDriving
                ? `${stop.driveMinutes} min drive`
                : `${stop.walkMinutes} min walk`}
            </Text>
          </View>
        </View>
      )}

      {/* Main card */}
      <View style={[styles.card, { borderLeftColor: catColor }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: catColor + "18" }]}>
            <Ionicons name={iconName as any} size={20} color={catColor} />
          </View>
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              {stop.time && (
                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={11} color={Colors.primary} />
                  <Text style={styles.time}>{stop.time}</Text>
                </View>
              )}
              <Text style={[styles.badge, { backgroundColor: catColor }]}>
                {stop.category}
              </Text>
            </View>
            <Text style={styles.name}>{stop.name}</Text>
            {stop.neighbourhood && (
              <Text style={styles.neighbourhood}>
                <Ionicons name="location-outline" size={11} color={Colors.muted} />{" "}
                {stop.neighbourhood}
              </Text>
            )}
          </View>
        </View>

        {/* Parking info */}
        {showParking && nearestLot && parkingInfo && (
          <View style={styles.parkingBox}>
            <View style={styles.parkingHeader}>
              <Ionicons name="car" size={14} color={Colors.text} />
              <Text style={styles.parkingTitle}>Parking Nearby</Text>
            </View>
            <Text style={styles.parkingLot}>{nearestLot.name}</Text>
            <Text style={styles.parkingDist}>{nearestLot.distanceM}m away</Text>
            <View style={styles.parkingRow}>
              <Text style={styles.parkingAvail}>
                {parkingInfo.emoji} {parkingInfo.label} availability
              </Text>
              <Text style={styles.parkingCost}>
                Est. {estimateCost(nearestLot)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => Linking.openURL(GRYD_CHECKOUT_URL)}
            >
              <Ionicons name="card" size={14} color={Colors.white} />
              <Text style={styles.payText}>Pay Parking</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Book reservation for restaurants */}
        {(showBooking || isRestaurant) && isRestaurant && (
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => {
              Linking.openURL(
                `https://www.google.com/search?q=${encodeURIComponent(stop.name + " Winnipeg reservation")}`
              );
            }}
          >
            <Ionicons name="calendar-outline" size={14} color={Colors.gold} />
            <Text style={styles.bookText}>Book Reservation</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  // Travel connector (vertical timeline)
  travelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 24,
    marginVertical: 0,
  },
  travelLine: {
    width: 2,
    height: 22,
    backgroundColor: Colors.periwinkle,
    marginRight: 8,
    borderRadius: 1,
    position: "relative",
  },
  travelDot: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.periwinkle,
  },
  travelDotEnd: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.periwinkle,
  },
  travelBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 4,
  },
  travelText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.muted,
  },
  // Card
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  time: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primary,
  },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  neighbourhood: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: "500",
  },
  // Reason
  reasonBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(245, 179, 18, 0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 179, 18, 0.12)",
  },
  reasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  reasonText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  // Parking
  parkingBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  parkingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  parkingTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.text,
  },
  parkingLot: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text,
  },
  parkingDist: {
    fontSize: 11,
    color: Colors.muted,
    marginBottom: 4,
  },
  parkingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  parkingAvail: { fontSize: 12, fontWeight: "600", color: Colors.text },
  parkingCost: { fontSize: 12, color: Colors.muted, fontWeight: "600" },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  payText: { fontSize: 13, fontWeight: "700", color: Colors.white },
  // Book
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    gap: 6,
    backgroundColor: "rgba(245, 179, 18, 0.04)",
  },
  bookText: { fontSize: 13, fontWeight: "700", color: Colors.gold },
});
