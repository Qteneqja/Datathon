/**
 * CityPanel — "Winnipeg Today" live city status at top of home screen.
 * Glassmorphism card with weather, events, parks, and parking overview.
 */

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { fetchWeather } from "@/services/api";
import { EVENTS } from "@/constants/events";
import type { WeatherData } from "@/types";

export default function CityPanel() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetchWeather().then(setWeather).catch(() => {});
  }, []);

  const todayEvents = EVENTS.filter((e) => {
    const today = new Date().toISOString().split("T")[0];
    return e.date === today;
  }).length;

  const weatherIcon =
    weather?.icon === "snow" ? "❄️" : weather?.icon === "sunny" ? "☀️" : "🌤";

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <View style={styles.headingIcon}>
          <Ionicons name="pulse" size={10} color={Colors.white} />
        </View>
        <Text style={styles.heading}>Winnipeg Today</Text>
        <View style={styles.divider} />
        <Text style={styles.emoji}>{weatherIcon}</Text>
        <Text style={styles.value}>
          {weather ? `${weather.temp}°C` : "--"}
        </Text>
        <Text style={styles.label}>
          {weather?.description || "..."}
        </Text>
        <View style={styles.divider} />
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.value}>{todayEvents || EVENTS.length}</Text>
        <Text style={styles.label}>Events</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.45)",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headingIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: 0.2,
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(0, 43, 136, 0.12)",
  },
  emoji: { fontSize: 14 },
  value: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.text,
  },
  label: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: "500",
  },
});
