/**
 * Profile — user preferences: name, interests, neighbourhood, and appearance.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Switch,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, CategoryColors } from "@/constants/colors";
import {
  getPreferences,
  savePreferences,
  getSavedItineraries,
  deleteItinerary,
  getBookmarks,
  toggleBookmark,
} from "@/services/storage";
import { fetchNeighbourhoods } from "@/services/api";
import type { UserPreferences, SavedItinerary, Location } from "@/types";

const INTEREST_OPTIONS: { key: keyof UserPreferences["interests"]; label: string; icon: string }[] =
  [
    { key: "outdoor", label: "Outdoor & Nature", icon: "leaf-outline" },
    { key: "indoor", label: "Arts & Culture", icon: "color-palette-outline" },
    { key: "family", label: "Family Friendly", icon: "people-outline" },
    { key: "transit", label: "Transit Accessible", icon: "bus-outline" },
    { key: "hidden_gems", label: "Hidden Gems", icon: "diamond-outline" },
  ];

export default function ProfileScreen() {
  const [prefs, setPrefs] = useState<UserPreferences>({
    name: "",
    startAddress: "",
    startCoords: null,
    interests: {
      outdoor: true,
      indoor: true,
      family: false,
      transit: false,
      hidden_gems: true,
    },
    neighbourhood: null,
  });
  const [geocoding, setGeocoding] = useState(false);
  const [neighbourhoods, setNeighbourhoods] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [itineraries, setItineraries] = useState<SavedItinerary[]>([]);
  const [bookmarks, setBookmarks] = useState<Location[]>([]);

  const loadAll = useCallback(async () => {
    const [saved, hoods, itin, bmarks] = await Promise.all([
      getPreferences(),
      fetchNeighbourhoods().catch(() => []),
      getSavedItineraries(),
      getBookmarks(),
    ]);
    if (saved) setPrefs(saved);
    setNeighbourhoods(hoods);
    setItineraries(itin);
    setBookmarks(bmarks);
    setDirty(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleDeleteItinerary = (id: string, name: string) => {
    Alert.alert("Delete Itinerary", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteItinerary(id);
          loadAll();
        },
      },
    ]);
  };

  const handleRemoveBookmark = async (loc: Location) => {
    await toggleBookmark(loc);
    loadAll();
  };

  const toggleInterest = (key: keyof UserPreferences["interests"]) => {
    setPrefs((p) => ({
      ...p,
      interests: { ...p.interests, [key]: !p.interests[key] },
    }));
    setDirty(true);
  };

  const setName = (name: string) => {
    setPrefs((p) => ({ ...p, name }));
    setDirty(true);
  };

  const setStartAddress = (startAddress: string) => {
    setPrefs((p) => ({ ...p, startAddress, startCoords: null }));
    setDirty(true);
  };

  const geocodeAddress = async () => {
    const addr = prefs.startAddress.trim();
    if (!addr) return;
    setGeocoding(true);
    try {
      const q = encodeURIComponent(addr + ", Winnipeg, MB, Canada");
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
        { headers: { "User-Agent": "WinnipegStride/0.1" } }
      );
      const data = await resp.json();
      if (data.length > 0) {
        const coords = { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
        setPrefs((p) => ({ ...p, startCoords: coords }));
        setDirty(true);
      } else {
        Alert.alert("Not Found", "Couldn't find that address in Winnipeg. Try a nearby intersection or landmark.");
      }
    } catch {
      Alert.alert("Error", "Couldn't geocode address. Check your connection.");
    } finally {
      setGeocoding(false);
    }
  };

  const selectHood = (hood: string | null) => {
    setPrefs((p) => ({ ...p, neighbourhood: hood }));
    setDirty(true);
  };

  const handleSave = async () => {
    await savePreferences(prefs);
    setDirty(false);
    Alert.alert("Saved", "Your preferences have been updated.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar placeholder */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={Colors.white} />
          </View>
          <Text style={styles.greeting}>
            {prefs.name ? `Hey, ${prefs.name}!` : "Set up your profile"}
          </Text>
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Name</Text>
          <TextInput
            style={styles.input}
            value={prefs.name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={Colors.muted}
          />
        </View>

        {/* Starting Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Starting Address</Text>
          <Text style={styles.sectionDesc}>
            Distances and walk times will be calculated from here.
          </Text>
          <TextInput
            style={styles.input}
            value={prefs.startAddress}
            onChangeText={setStartAddress}
            placeholder="e.g. 201 Portage Ave"
            placeholderTextColor={Colors.muted}
            onSubmitEditing={geocodeAddress}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={[styles.geocodeBtn, geocoding && { opacity: 0.5 }]}
            onPress={geocodeAddress}
            disabled={geocoding || !prefs.startAddress.trim()}
          >
            <Ionicons name="locate-outline" size={16} color={Colors.white} />
            <Text style={styles.geocodeTxt}>
              {geocoding ? "Locating..." : "Set Location"}
            </Text>
          </TouchableOpacity>
          {prefs.startCoords && (
            <Text style={styles.coordsText}>
              Lat {prefs.startCoords.latitude.toFixed(4)}, Lng{" "}
              {prefs.startCoords.longitude.toFixed(4)}
            </Text>
          )}
        </View>

        {/* Interests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <Text style={styles.sectionDesc}>
            Winnie uses these to personalise your recommendations.
          </Text>
          {INTEREST_OPTIONS.map((opt) => (
            <View key={opt.key} style={styles.toggleRow}>
              <Ionicons
                name={opt.icon as any}
                size={20}
                color={prefs.interests[opt.key] ? Colors.primary : Colors.muted}
              />
              <Text style={styles.toggleLabel}>{opt.label}</Text>
              <Switch
                value={prefs.interests[opt.key]}
                onValueChange={() => toggleInterest(opt.key)}
                trackColor={{ false: Colors.surface, true: Colors.periwinkle }}
                thumbColor={prefs.interests[opt.key] ? Colors.primary : "#ccc"}
              />
            </View>
          ))}
        </View>

        {/* Neighbourhood */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Home Neighbourhood</Text>
          <Text style={styles.sectionDesc}>
            We'll prioritise areas you haven't explored yet.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hoodScroll}
          >
            <TouchableOpacity
              style={[
                styles.hoodChip,
                prefs.neighbourhood === null && styles.hoodChipActive,
              ]}
              onPress={() => selectHood(null)}
            >
              <Text
                style={[
                  styles.hoodText,
                  prefs.neighbourhood === null && styles.hoodTextActive,
                ]}
              >
                Not set
              </Text>
            </TouchableOpacity>
            {neighbourhoods.map((h) => (
              <TouchableOpacity
                key={h}
                style={[
                  styles.hoodChip,
                  prefs.neighbourhood === h && styles.hoodChipActive,
                ]}
                onPress={() => selectHood(h)}
              >
                <Text
                  style={[
                    styles.hoodText,
                    prefs.neighbourhood === h && styles.hoodTextActive,
                  ]}
                >
                  {h}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, !dirty && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!dirty}
        >
          <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
          <Text style={styles.saveTxt}>Save Preferences</Text>
        </TouchableOpacity>

        {/* Saved Itineraries */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Itineraries</Text>
          {itineraries.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="map-outline" size={28} color={Colors.muted} />
              <Text style={styles.emptyText}>No saved itineraries yet</Text>
            </View>
          ) : (
            itineraries.map((itin) => (
              <View key={itin.id} style={styles.savedCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedCardTitle}>{itin.name || itin.title}</Text>
                  <Text style={styles.savedCardMeta}>
                    {itin.stops.length} stops · {new Date(itin.createdAt || itin.date).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteItinerary(itin.id, itin.name || itin.title)}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Liked Places */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liked Places</Text>
          {bookmarks.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="heart-outline" size={28} color={Colors.muted} />
              <Text style={styles.emptyText}>No liked places yet</Text>
            </View>
          ) : (
            bookmarks.map((loc) => {
              const catColor = CategoryColors[loc.category as keyof typeof CategoryColors] || Colors.primary;
              return (
                <View key={loc.id} style={styles.savedCard}>
                  <View style={[styles.catDot, { backgroundColor: catColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedCardTitle}>{loc.name}</Text>
                    <Text style={styles.savedCardMeta}>
                      {loc.category} · {loc.neighbourhood}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveBookmark(loc)}>
                    <Ionicons name="heart" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* App info */}
        <View style={styles.infoSection}>
          <Text style={styles.appName}>Winnipeg Stride</Text>
          <Text style={styles.version}>Prototype v0.1.0 · Made for Datathon 2025</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 60 },
  avatarWrap: { alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  greeting: { fontSize: 22, fontWeight: "800", color: Colors.text, letterSpacing: 0.2 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.text, marginBottom: 4, letterSpacing: 0.2 },
  sectionDesc: { fontSize: 13, color: Colors.muted, marginBottom: 10, lineHeight: 18 },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.text,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.08)",
    fontWeight: "500",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 43, 136, 0.04)",
  },
  toggleLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    marginLeft: 12,
    fontWeight: "600",
  },
  geocodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  geocodeTxt: { color: Colors.white, fontSize: 13, fontWeight: "700" },
  coordsText: {
    fontSize: 12,
    color: Colors.green,
    marginTop: 4,
    fontWeight: "700",
  },
  hoodScroll: { gap: 8, marginTop: 4 },
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
  hoodText: { fontSize: 13, fontWeight: "700", color: Colors.text },
  hoodTextActive: { color: Colors.white },
  saveBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 16,
    marginTop: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveTxt: { color: Colors.white, fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
  savedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.06)",
    gap: 10,
  },
  savedCardTitle: { fontSize: 14, fontWeight: "700", color: Colors.text },
  savedCardMeta: { fontSize: 12, color: Colors.muted, marginTop: 2, fontWeight: "500" },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.06)",
  },
  emptyText: { fontSize: 13, color: Colors.muted, marginTop: 6, fontWeight: "600" },
  infoSection: { alignItems: "center", marginTop: 40 },
  appName: { fontSize: 18, fontWeight: "900", color: Colors.primary, letterSpacing: 0.3 },
  version: { fontSize: 12, color: Colors.muted, marginTop: 4, fontWeight: "500" },
});
