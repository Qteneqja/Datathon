/**
 * AsyncStorage helpers for saved itineraries and bookmarks.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SavedItinerary, Location, UserPreferences } from "@/types";

const KEYS = {
  itineraries: "wp_stride_itineraries",
  bookmarks: "wp_stride_bookmarks",
  preferences: "wp_stride_preferences",
  chatHistory: "wp_stride_chat",
};

// -------------------------------------------------------------------
// Itineraries
// -------------------------------------------------------------------

export async function getSavedItineraries(): Promise<SavedItinerary[]> {
  const raw = await AsyncStorage.getItem(KEYS.itineraries);
  return raw ? JSON.parse(raw) : [];
}

export async function saveItinerary(it: SavedItinerary): Promise<void> {
  const all = await getSavedItineraries();
  all.unshift(it);
  await AsyncStorage.setItem(KEYS.itineraries, JSON.stringify(all.slice(0, 50)));
}

export async function deleteItinerary(id: string): Promise<void> {
  const all = await getSavedItineraries();
  await AsyncStorage.setItem(
    KEYS.itineraries,
    JSON.stringify(all.filter((i) => i.id !== id))
  );
}

// -------------------------------------------------------------------
// Bookmarks
// -------------------------------------------------------------------

export async function getBookmarks(): Promise<Location[]> {
  const raw = await AsyncStorage.getItem(KEYS.bookmarks);
  return raw ? JSON.parse(raw) : [];
}

export async function toggleBookmark(loc: Location): Promise<boolean> {
  const all = await getBookmarks();
  const idx = all.findIndex((l) => l.id === loc.id);
  if (idx >= 0) {
    all.splice(idx, 1);
    await AsyncStorage.setItem(KEYS.bookmarks, JSON.stringify(all));
    return false; // removed
  }
  all.unshift(loc);
  await AsyncStorage.setItem(KEYS.bookmarks, JSON.stringify(all));
  return true; // added
}

export async function isBookmarked(id: number): Promise<boolean> {
  const all = await getBookmarks();
  return all.some((l) => l.id === id);
}

// -------------------------------------------------------------------
// Preferences
// -------------------------------------------------------------------

const DEFAULT_PREFS: UserPreferences = {
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
};

export async function getPreferences(): Promise<UserPreferences> {
  const raw = await AsyncStorage.getItem(KEYS.preferences);
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  await AsyncStorage.setItem(KEYS.preferences, JSON.stringify(prefs));
}
