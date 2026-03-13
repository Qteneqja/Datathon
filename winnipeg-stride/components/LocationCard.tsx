import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, CategoryColors } from "@/constants/colors";
import type { Location } from "@/types";

interface Props {
  location: Location;
  onPress?: () => void;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  compact?: boolean;
}

export default function LocationCard({
  location,
  onPress,
  onBookmark,
  isBookmarked,
  compact,
}: Props) {
  const badgeColor = CategoryColors[location.category] || Colors.muted;

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Category badge */}
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={styles.badgeText}>{location.category}</Text>
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {location.name}
      </Text>

      <Text style={styles.neighbourhood}>
        <Ionicons name="location-outline" size={12} color={Colors.muted} />{" "}
        {location.neighbourhood}
      </Text>

      {location.distanceKm !== undefined && (
        <Text style={styles.distance}>
          {location.distanceKm.toFixed(1)} km away
        </Text>
      )}

      {onBookmark && (
        <TouchableOpacity style={styles.bookmarkBtn} onPress={onBookmark}>
          <Ionicons
            name={isBookmarked ? "bookmark" : "bookmark-outline"}
            size={20}
            color={isBookmarked ? Colors.gold : Colors.muted}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.05)",
  },
  cardCompact: {
    padding: 10,
    marginBottom: 6,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: "800",
  },
  name: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  neighbourhood: {
    fontSize: 13,
    color: Colors.muted,
    fontWeight: "500",
  },
  distance: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 3,
    fontWeight: "500",
  },
  bookmarkBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 4,
  },
});
