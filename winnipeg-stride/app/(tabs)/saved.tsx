/**
 * Saved — three-tab view (Itineraries / Bookmarks / Passport) backed by AsyncStorage.
 * Passport: visited-places tracker with category labels, spend indicators, receipt upload stub.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, CategoryColors } from "@/constants/colors";
import {
  getSavedItineraries,
  deleteItinerary,
  getBookmarks,
  toggleBookmark,
} from "@/services/storage";
import type { SavedItinerary, Location } from "@/types";

type Tab = "itineraries" | "bookmarks" | "passport";

// Demo passport data (derived from saved itineraries on load)
interface PassportStamp {
  id: string;
  name: string;
  category: string;
  neighbourhood: string;
  visitedAt: string;
  spend: "$" | "$$" | "$$$";
}

function derivePassportStamps(itineraries: SavedItinerary[]): PassportStamp[] {
  const stamps: PassportStamp[] = [];
  const seen = new Set<string>();
  for (const itin of itineraries) {
    for (const stop of itin.stops) {
      // Demo: only show restaurants in passport
      if (stop.category !== "Restaurant") continue;
      const key = stop.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const spend = "$$";
      stamps.push({
        id: `stamp-${stamps.length}`,
        name: stop.name,
        category: stop.category,
        neighbourhood: (stop as any).neighbourhood || "Winnipeg",
        visitedAt: itin.createdAt || itin.date,
        spend,
      });
    }
  }
  return stamps;
}

export default function SavedScreen() {
  const [tab, setTab] = useState<Tab>("itineraries");
  const [itineraries, setItineraries] = useState<SavedItinerary[]>([]);
  const [bookmarks, setBookmarks] = useState<Location[]>([]);
  const [stamps, setStamps] = useState<PassportStamp[]>([]);

  const load = useCallback(async () => {
    const [itin, bmarks] = await Promise.all([
      getSavedItineraries(),
      getBookmarks(),
    ]);
    setItineraries(itin);
    setBookmarks(bmarks);
    setStamps(derivePassportStamps(itin));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDeleteItinerary = (id: string, name: string) => {
    Alert.alert("Delete Itinerary", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteItinerary(id);
          load();
        },
      },
    ]);
  };

  const handleRemoveBookmark = async (loc: Location) => {
    await toggleBookmark(loc);
    load();
  };

  /* ---------- Itinerary card ---------- */
  const renderItinerary = ({ item }: { item: SavedItinerary }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.name || item.title}</Text>
          <Text style={styles.cardMeta}>
            {item.stops.length} stops · {new Date(item.createdAt || item.date).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteItinerary(item.id, item.name || item.title)}
        >
          <Ionicons name="trash-outline" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>
      {item.stops.slice(0, 4).map((stop, idx) => (
        <View key={idx} style={styles.stopRow}>
          <View style={styles.stopDot} />
          <Text style={styles.stopText} numberOfLines={1}>
            {stop.name}
          </Text>
          {(stop.time || stop.walkMinutes) && (
            <Text style={styles.stopTime}>{stop.time ?? `${stop.walkMinutes} min`}</Text>
          )}
        </View>
      ))}
      {item.stops.length > 4 && (
        <Text style={styles.moreStops}>
          +{item.stops.length - 4} more stops
        </Text>
      )}
    </View>
  );

  /* ---------- Bookmark card ---------- */
  const renderBookmark = ({ item }: { item: Location }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {item.category} · {item.neighbourhood}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleRemoveBookmark(item)}>
          <Ionicons name="bookmark" size={20} color={Colors.gold} />
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ---------- Passport stamp card ---------- */
  const renderStamp = ({ item }: { item: PassportStamp }) => {
    const catColor = CategoryColors[item.category as keyof typeof CategoryColors] || Colors.primary;
    return (
      <View style={styles.stampCard}>
        <View style={[styles.stampBadge, { backgroundColor: catColor }]}>
          <Ionicons name="ribbon" size={18} color={Colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.stampMeta}>
            <View style={[styles.catTag, { backgroundColor: catColor + "18" }]}>
              <Text style={[styles.catTagText, { color: catColor }]}>{item.category}</Text>
            </View>
            <Text style={styles.spendTag}>{item.spend}</Text>
            <Text style={styles.cardMeta}>
              {new Date(item.visitedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {(["itineraries", "bookmarks", "passport"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Ionicons
              name={t === "itineraries" ? "map-outline" : t === "bookmarks" ? "bookmark-outline" : "ribbon-outline"}
              size={16}
              color={tab === t ? Colors.white : Colors.muted}
            />
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "itineraries" ? "Itineraries" : t === "bookmarks" ? "Bookmarks" : "Passport"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === "itineraries" ? (
        <FlatList
          data={itineraries}
          renderItem={renderItinerary}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="map-outline" size={48} color={Colors.muted} />
              <Text style={styles.emptyTitle}>No saved itineraries yet</Text>
              <Text style={styles.emptyDesc}>
                Ask Winnie to plan a day and save it here!
              </Text>
            </View>
          }
        />
      ) : tab === "bookmarks" ? (
        <FlatList
          data={bookmarks}
          renderItem={renderBookmark}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="bookmark-outline" size={48} color={Colors.muted} />
              <Text style={styles.emptyTitle}>No bookmarks yet</Text>
              <Text style={styles.emptyDesc}>
                Tap the bookmark icon on any location to save it.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={stamps}
          renderItem={renderStamp}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            stamps.length > 0 ? (
              <View style={styles.passportHeader}>
                <Text style={styles.passportTitle}>{stamps.length} places visited</Text>
                <TouchableOpacity
                  style={styles.receiptBtn}
                  onPress={() => Alert.alert("Upload Receipt", "Receipt scanner coming soon! This feature will let you snap a photo and auto-log your spending.")}
                >
                  <Ionicons name="camera-outline" size={16} color={Colors.primary} />
                  <Text style={styles.receiptBtnText}>Upload receipt</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="ribbon-outline" size={48} color={Colors.muted} />
              <Text style={styles.emptyTitle}>No passport stamps yet</Text>
              <Text style={styles.emptyDesc}>
                Save an itinerary to start collecting stamps for each place you visit!
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: Colors.white,
    padding: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 11,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: { fontSize: 14, fontWeight: "700", color: Colors.muted },
  tabTextActive: { color: Colors.white },
  list: { padding: 14, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.04)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.muted, marginTop: 3, fontWeight: "500" },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingLeft: 4,
  },
  stopDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: 10,
  },
  stopText: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: "500" },
  stopTime: { fontSize: 12, color: Colors.muted, marginLeft: 6, fontWeight: "500" },
  moreStops: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600",
    marginTop: 6,
    paddingLeft: 21,
  },
  emptyWrap: { alignItems: "center", marginTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },
  emptyDesc: { fontSize: 14, color: Colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 20 },
  error: { color: "red", fontSize: 12, textAlign: "center", marginTop: 10 },

  /* Passport */
  stampCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.04)",
  },
  stampBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stampMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
  catTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  catTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  spendTag: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.gold,
  },
  passportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  passportTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.muted,
    letterSpacing: 0.2,
  },
  receiptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 43, 136, 0.06)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  receiptBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
});
