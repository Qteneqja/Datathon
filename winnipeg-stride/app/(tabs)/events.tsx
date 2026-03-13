import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { EVENTS, WinnipegEvent } from "@/constants/events";

const CATEGORY_COLORS: Record<string, string> = {
  Music: Colors.primary,
  Performance: Colors.lavender,
  Party: "#F97316",
  Holiday: Colors.green,
  Nightlife: "#E84393",
};

const ALL_CATEGORIES = [...new Set(EVENTS.map((e) => e.category))];

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function EventCard({ event }: { event: WinnipegEvent }) {
  const catColor = CATEGORY_COLORS[event.category] ?? Colors.muted;

  return (
    <View style={styles.card}>
      {/* Date strip */}
      <View style={[styles.dateStrip, { backgroundColor: catColor }]}>
        <Text style={styles.dateDay}>
          {new Date(event.date + "T12:00:00").getDate()}
        </Text>
        <Text style={styles.dateMonth}>
          {new Date(event.date + "T12:00:00").toLocaleDateString("en-US", {
            month: "short",
          })}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.row}>
          <Ionicons name="time-outline" size={13} color={Colors.muted} />
          <Text style={styles.meta}>
            {event.time}
            {event.endTime ? ` – ${event.endTime}` : ""}
          </Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="location-outline" size={13} color={Colors.muted} />
          <Text style={styles.meta} numberOfLines={1}>
            {event.venue}
          </Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="pricetag-outline" size={13} color={Colors.muted} />
          <Text style={styles.meta}>{event.price}</Text>
          <View style={[styles.badge, { backgroundColor: catColor + "22" }]}>
            <Text style={[styles.badgeText, { color: catColor }]}>
              {event.category}
            </Text>
          </View>
        </View>

        <Text style={styles.desc} numberOfLines={2}>
          {event.description}
        </Text>

        <TouchableOpacity
          style={[styles.ticketBtn, { backgroundColor: catColor }]}
          onPress={() => Linking.openURL(event.url)}
        >
          <Ionicons name="ticket-outline" size={14} color="#FFF" />
          <Text style={styles.ticketText}>Get Tickets</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function EventsScreen() {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = activeFilter
      ? EVENTS.filter((e) => e.category === activeFilter)
      : EVENTS;
    return [...list].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [activeFilter]);

  return (
    <View style={styles.container}>
      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={styles.filterScroll}
      >
        <TouchableOpacity
          style={[
            styles.chip,
            !activeFilter && { backgroundColor: Colors.primary },
          ]}
          onPress={() => setActiveFilter(null)}
        >
          <Text
            style={[styles.chipText, !activeFilter && { color: Colors.white }]}
          >
            All
          </Text>
        </TouchableOpacity>
        {ALL_CATEGORIES.map((cat) => {
          const active = activeFilter === cat;
          const color = CATEGORY_COLORS[cat] ?? Colors.muted;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, active && { backgroundColor: color }]}
              onPress={() => setActiveFilter(active ? null : cat)}
            >
              <Text
                style={[styles.chipText, active && { color: Colors.white }]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EventCard event={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No events in this category</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  filterScroll: { flexGrow: 0, flexShrink: 0, maxHeight: 52 },
  filters: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  chip: {
    borderWidth: 1.5,
    borderColor: "rgba(0, 43, 136, 0.18)",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginRight: 8,
    height: 34,
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
  chipText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  list: { paddingHorizontal: 14, paddingBottom: 20 },
  card: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: Colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  dateStrip: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  dateDay: { fontSize: 24, fontWeight: "900", color: "#FFF" },
  dateMonth: { fontSize: 11, fontWeight: "700", color: "#FFFFFFCC" },
  cardBody: { flex: 1, padding: 12 },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 5,
    letterSpacing: 0.1,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  meta: { fontSize: 11, color: Colors.muted, flex: 1, fontWeight: "500" },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
  desc: { fontSize: 11, color: Colors.muted, marginTop: 5, lineHeight: 16 },
  ticketBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 8,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  ticketText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  empty: {
    textAlign: "center",
    color: Colors.muted,
    marginTop: 40,
    fontSize: 14,
    fontWeight: "500",
  },
});
