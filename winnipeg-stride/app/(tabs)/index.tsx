/**
 * Winnie Chat — the default home screen.
 * AI-powered chat assistant for planning Winnipeg experiences.
 * Itinerary-first design: short chat, rich timeline, follow-up chips.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
  Image,
  Animated,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import ChatBubble, { TypingIndicator } from "@/components/ChatBubble";
import QuickPromptChips from "@/components/QuickPromptChips";
import CityPanel from "@/components/CityPanel";
import ItineraryCard from "@/components/ItineraryCard";
import type { ItineraryStopData } from "@/components/ItineraryCard";
import { sendChat, surpriseItinerary, fetchWeather } from "@/services/api";
import { saveItinerary } from "@/services/storage";
import type { ChatMessage, SavedItinerary } from "@/types";

const WELCOME_MSG: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey! I'm Winnie 👋\nYour AI guide to Winnipeg.\n\nTell me what kind of day you're looking for and I'll plan it for you.",
  timestamp: Date.now(),
};

// Parse itinerary stops from AI response text
function parseItineraryFromText(text: string): ItineraryStopData[] {
  const stops: ItineraryStopData[] = [];
  // Strip markdown bold/italic so **6:00 PM** becomes 6:00 PM
  const cleaned = text.replace(/\*+/g, "");
  const timePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*[-–—:]\s*(.+?)(?:\n|$)/g;
  const numberedPattern = /(\d+)\.\s*(.+?)(?:\s*[-–—]\s*(.+?))?(?:\n|$)/g;

  let match;
  while ((match = timePattern.exec(cleaned)) !== null) {
    const time = match[1].trim();
    const rest = match[2].trim();
    // Remove walk/drive time parentheticals
    const cleanRest = rest.replace(/\s*\((?:walk|drive|Walk|Drive).*?\)\s*/gi, "").trim();
    const parts = cleanRest.split(/\s*[-–—]\s*/);
    const name = parts.length > 1 ? parts[1] : parts[0];
    const category = guessCategory(cleanRest);
    stops.push({
      stopNumber: stops.length + 1,
      name: name.replace(/[()]/g, "").trim(),
      category,
      latitude: 49.89 + (Math.random() - 0.5) * 0.02,
      longitude: -97.14 + (Math.random() - 0.5) * 0.02,
      walkMinutes: stops.length > 0 ? 5 + Math.floor(Math.random() * 10) : undefined,
      time,
      reason: generateReason(category),
    });
  }

  if (stops.length === 0) {
    while ((match = numberedPattern.exec(cleaned)) !== null) {
      const name = match[2].trim();
      if (name.length < 3 || name.length > 100) continue;
      const category = guessCategory(name + (match[3] || ""));
      stops.push({
        stopNumber: parseInt(match[1]),
        name: name.replace(/[()]/g, "").trim(),
        category,
        latitude: 49.89 + (Math.random() - 0.5) * 0.02,
        longitude: -97.14 + (Math.random() - 0.5) * 0.02,
        walkMinutes: stops.length > 0 ? 5 + Math.floor(Math.random() * 10) : undefined,
        reason: generateReason(category),
      });
    }
  }

  return stops;
}

function guessCategory(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("restaurant") || t.includes("dinner") || t.includes("lunch") || t.includes("café") || t.includes("cafe") || t.includes("brunch") || t.includes("food") || t.includes("bar") || t.includes("nightcap") || t.includes("distill") || t.includes("patio") || t.includes("pub") || t.includes("grill") || t.includes("bistro") || t.includes("tavern"))
    return "Restaurant";
  if (t.includes("park") || t.includes("garden") || t.includes("trail") || t.includes("nature") || t.includes("greenspace") || t.includes("green space") || t.includes("arboretum"))
    return "Park";
  if (t.includes("museum") || t.includes("gallery") || t.includes("theatre") || t.includes("theater") || t.includes("show") || t.includes("fringe") || t.includes("art") || t.includes("festival") || t.includes("forks") || t.includes("exchange") || t.includes("landmark"))
    return "Arts & Culture";
  if (t.includes("pool") || t.includes("rink") || t.includes("sport") || t.includes("recreation"))
    return "Recreation";
  return "Arts & Culture";
}

// Intent detection + post-processing for park limits
const NIGHT_OUT_KEYWORDS = ["night", "evening", "tonight", "nightlife", "date night", "fun night", "dinner and drinks", "night out", "after dark"];
function isNightOutIntent(text: string): boolean {
  const t = text.toLowerCase();
  return NIGHT_OUT_KEYWORDS.some((kw) => t.includes(kw));
}
const PARK_LIKE_KWS = ["park", "garden", "trail", "greenspace", "green space", "arboretum"];
function isParkLikeStop(stop: ItineraryStopData): boolean {
  const n = stop.name.toLowerCase();
  return stop.category === "Park" || PARK_LIKE_KWS.some((kw) => n.includes(kw));
}
function enforceStopRules(stops: ItineraryStopData[], userMessage: string): ItineraryStopData[] {
  const nightOut = isNightOutIntent(userMessage);
  const maxParks = nightOut ? 0 : 1;
  let parkCount = 0;
  const filtered = stops.filter((s) => {
    if (isParkLikeStop(s)) {
      parkCount++;
      if (parkCount > maxParks) return false;
    }
    return true;
  }).map((s, i) => ({ ...s, stopNumber: i + 1 }));
  // If filtering removed everything, fall back to max-1-park rule
  if (filtered.length === 0 && stops.length > 0) {
    let fallbackParkCount = 0;
    return stops.filter((s) => {
      if (isParkLikeStop(s)) {
        fallbackParkCount++;
        if (fallbackParkCount > 1) return false;
      }
      return true;
    }).map((s, i) => ({ ...s, stopNumber: i + 1 }));
  }
  return filtered;
}

function generateReason(category: string): string {
  const reasons: Record<string, string> = {
    Park: "• beautiful green space\n• popular with visitors\n• great for relaxing",
    Restaurant: "• highly rated dining\n• popular with locals\n• close to your route",
    "Arts & Culture": "• vibrant cultural venue\n• unique local experience\n• well-reviewed attraction",
    Recreation: "• fun activity option\n• family-friendly\n• great facilities",
  };
  return reasons[category] || "• recommended by locals\n• fits your plan perfectly";
}

/** Extract a short intro from the AI reply (first sentence, capped at 30 words).
 *  Falls back to a generic intro if the reply is mostly itinerary content. */
function extractShortIntro(reply: string): string {
  // Try to get text before the first numbered/timed stop
  const beforeStops = reply.split(/\d{1,2}[.:]\d{2}\s*(AM|PM|am|pm)|^\d+\.\s/m)[0].trim();
  if (beforeStops && beforeStops.length > 10 && beforeStops.length < 150) {
    // Take just the first 1–2 sentences
    const sentences = beforeStops.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
    if (sentences.length > 5) return sentences + (sentences.endsWith("👇") ? "" : " 👇");
  }
  return "I put together a plan for you. Check out the itinerary below 👇";
}

// Distance threshold: under 800m → walking is more practical than driving
const WALK_THRESHOLD_M = 800;

/** Haversine distance in metres between two stops */
function distanceBetween(a: ItineraryStopData, b: ItineraryStopData): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

/** Compute drive minutes (~30 km/h city avg with 1.3x detour) */
function driveMinutes(distM: number): number {
  return Math.max(2, Math.round((distM * 1.3) / 1000 / 30 * 60));
}

// Follow-up chips shown after itinerary generation
const FOLLOWUP_CHIPS = [
  { text: "Add dinner", icon: "restaurant-outline" },
  { text: "Show parking", icon: "car-outline" },
  { text: "Replace a stop", icon: "swap-horizontal-outline" },
  { text: "Make it cheaper", icon: "cash-outline" },
  { text: "Add another stop", icon: "add-circle-outline" },
  { text: "Find nightlife", icon: "wine-outline" },
  { text: "Family-friendly version", icon: "people-outline" },
];

export default function WinnieChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const [showCityPanel, setShowCityPanel] = useState(true);
  const [currentItinerary, setCurrentItinerary] = useState<ItineraryStopData[]>([]);
  const [showParking, setShowParking] = useState(false);
  // Transport mode: "walk" | "drive" — controls travel label display
  const [transportMode, setTransportMode] = useState<"walk" | "drive">("walk");
  const mocktailModeRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
  }, []);

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      const msg: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    []
  );

  const handleSaveItinerary = useCallback(async () => {
    if (currentItinerary.length === 0) return;
    const it: SavedItinerary = {
      id: `it-${Date.now()}`,
      name: `Winnipeg Plan – ${new Date().toLocaleDateString()}`,
      title: `Winnipeg Plan – ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      stops: currentItinerary.map((s) => ({
        stopNumber: s.stopNumber,
        name: s.name,
        category: s.category,
        latitude: s.latitude,
        longitude: s.longitude,
        walkMinutes: s.walkMinutes,
        time: s.time,
      })),
    };
    await saveItinerary(it);
    addMessage(
      "assistant",
      "✅ Itinerary saved! You can find it in the Saved tab. Have a great time exploring Winnipeg! 🌾"
    );
    scrollToEnd();
  }, [currentItinerary, addMessage, scrollToEnd]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setInput("");
      setShowChips(false);
      setShowCityPanel(false);
      addMessage("user", trimmed);
      setLoading(true);
      scrollToEnd();

      const lowerTrimmed = trimmed.toLowerCase();

      // Save itinerary intent
      if (
        (lowerTrimmed.includes("save") || lowerTrimmed.includes("send me")) &&
        (lowerTrimmed.includes("itinerary") || lowerTrimmed.includes("plan"))
      ) {
        setLoading(false);
        await handleSaveItinerary();
        return;
      }

      // Mocktail / non-alcoholic intent
      const MOCKTAIL_KWS = ["mocktail", "non alcoholic", "non-alcoholic", "driving tonight", "i'm driving", "im driving", "no alcohol"];
      if (MOCKTAIL_KWS.some((kw) => lowerTrimmed.includes(kw))) {
        mocktailModeRef.current = true;
      }

      // Driving / parking intent — switch transport mode
      if (
        lowerTrimmed.includes("driv") ||
        lowerTrimmed.includes("car") ||
        lowerTrimmed.includes("parking") ||
        lowerTrimmed.includes("show parking")
      ) {
        setShowParking(true);
        setTransportMode("drive");
        if (currentItinerary.length > 0) {
          addMessage(
            "assistant",
            "Switching to drive mode — parking info added to your stops 🚗"
          );
          setLoading(false);
          scrollToEnd();
          return;
        }
      }

      try {
        if (lowerTrimmed.includes("surprise")) {
          const result = await surpriseItinerary();
          if (result.stops.length > 0) {
            const stops: ItineraryStopData[] = result.stops.map((s) => ({
              stopNumber: s.stopNumber,
              name: s.name,
              category: s.category,
              latitude: s.latitude,
              longitude: s.longitude,
              walkMinutes: s.walkMinutes,
              time: s.time,
              neighbourhood: (s as any).neighbourhood,
              reason: generateReason(s.category),
            }));
            const filtered = enforceStopRules(stops, trimmed);
            setCurrentItinerary(filtered);
            addMessage(
              "assistant",
              `Here's a surprise plan${result.neighbourhood ? ` in ${result.neighbourhood}` : ""}! Check it out below 👇`
            );
          } else {
            addMessage(
              "assistant",
              "Hmm, I couldn't put together a surprise itinerary right now. Try asking me about specific activities!"
            );
          }
        } else {
          const history = messages
            .filter((m) => m.id !== "welcome")
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content }));

          let enrichedMsg = trimmed;
          try {
            const weather = await fetchWeather();
            enrichedMsg = `[Current weather in Winnipeg: ${weather.temp}°C, ${weather.description}] ${trimmed}`;
          } catch {
            // Weather unavailable
          }
          if (mocktailModeRef.current) {
            enrichedMsg += " [User prefers non-alcoholic options — for any restaurant stop add a brief note: 'Mocktails available']"
          }

          const result = await sendChat(enrichedMsg, history);

          // Parse itinerary from AI response
          const parsed = parseItineraryFromText(result.reply);
          if (parsed.length >= 2) {
            const filtered = enforceStopRules(parsed, trimmed);
            setCurrentItinerary(filtered);
            // Show short intro only — itinerary UI carries the detail
            const shortIntro = extractShortIntro(result.reply);
            addMessage("assistant", shortIntro);
          } else {
            addMessage("assistant", result.reply);
          }
        }
      } catch (err) {
        addMessage(
          "assistant",
          "Sorry, I'm having trouble connecting right now. Try again in a moment! 🌾"
        );
      } finally {
        setLoading(false);
        scrollToEnd();
      }
    },
    [loading, messages, addMessage, scrollToEnd, currentItinerary, handleSaveItinerary]
  );

  const handleChipSelect = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <ChatBubble role={item.role} content={item.content} />
    ),
    []
  );

  return (
    <View style={styles.outerContainer}>
      {/* Navy status bar area + header */}
      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Winnipeg Stride</Text>
        </View>
      </SafeAreaView>

      {/* Main content area */}
      <View style={styles.container}>
        {/* Hero background image */}
        <Image
          source={require("@/assets/hero/Insure MB.png")}
          style={styles.heroImage}
          resizeMode="cover"
        />
      {/* Gradient overlay for depth */}
      <LinearGradient
        colors={["rgba(0,43,136,0.18)", "rgba(255,255,255,0.55)", "rgba(247,248,252,0.92)"]}
        locations={[0, 0.35, 1]}
        style={styles.heroGradient}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatList}
          onContentSizeChange={scrollToEnd}
          ListHeaderComponent={showCityPanel ? <CityPanel /> : null}
          ListFooterComponent={
            <>
              {loading && <TypingIndicator label="Winnie is planning your day..." />}

              {currentItinerary.length > 0 && !loading && (
                <View style={styles.itinerarySection}>
                  {/* Smart itinerary header label */}
                  <View style={styles.itineraryHeader}>
                    <View style={styles.itineraryIconWrap}>
                      <Ionicons name="map" size={16} color={Colors.white} />
                    </View>
                    <View>
                      <Text style={styles.itineraryTitle}>Your Itinerary</Text>
                      <Text style={styles.itinerarySubtitle}>
                        {currentItinerary.length} stops · {transportMode === "drive" ? "Drive mode" : "Smart route"} · Easy to edit
                      </Text>
                    </View>
                  </View>
                  {currentItinerary.map((stop, idx) => {
                    const prev = idx > 0 ? currentItinerary[idx - 1] : undefined;
                    // Smart transport: compute drive vs walk per segment
                    let travelProps = { ...stop };
                    if (prev && stop.walkMinutes != null && transportMode === "drive") {
                      const dist = distanceBetween(prev, stop);
                      if (dist > WALK_THRESHOLD_M) {
                        // Switch this segment to driving
                        travelProps = { ...stop, driveMinutes: driveMinutes(dist), usesDriving: true } as any;
                      }
                      // else keep as walk (short distance)
                    }
                    return (
                      <ItineraryCard
                        key={`${stop.stopNumber}-${stop.name}`}
                        stop={travelProps}
                        previousStop={prev}
                        showParking={showParking && idx === 0}
                        showBooking={true}
                        transportMode={transportMode}
                      />
                    );
                  })}
                  {/* Action buttons */}
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveItinerary}
                  >
                    <Ionicons name="bookmark" size={16} color={Colors.white} />
                    <Text style={styles.saveBtnText}>Save Itinerary</Text>
                  </TouchableOpacity>
                  {transportMode === "walk" && (
                    <TouchableOpacity
                      style={styles.drivingBtn}
                      onPress={() => {
                        setShowParking(true);
                        setTransportMode("drive");
                        addMessage("assistant", "Switching to drive mode — parking info added 🚗");
                        scrollToEnd();
                      }}
                    >
                      <Ionicons name="car" size={16} color={Colors.primary} />
                      <Text style={styles.drivingBtnText}>I'm driving — show parking</Text>
                    </TouchableOpacity>
                  )}

                  {/* Follow-up chips — continue planning */}
                  <View style={styles.followupSection}>
                    <Text style={styles.followupLabel}>Continue planning</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.followupScroll}
                    >
                      {FOLLOWUP_CHIPS.map((chip) => (
                        <TouchableOpacity
                          key={chip.text}
                          style={styles.followupChip}
                          activeOpacity={0.7}
                          onPress={() => handleSend(chip.text)}
                        >
                          <Ionicons name={chip.icon as any} size={14} color={Colors.primary} />
                          <Text style={styles.followupChipText}>{chip.text}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}
            </>
          }
        />

        {showChips && <QuickPromptChips onSelect={handleChipSelect} />}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Winnie anything about Winnipeg..."
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => handleSend(input)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={() => handleSend(input)}
            disabled={!input.trim() || loading}
          >
            <Ionicons
              name="send"
              size={20}
              color={input.trim() ? Colors.white : Colors.muted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: Colors.navy,
  },
  headerSafe: {
    backgroundColor: Colors.navy,
  },
  header: {
    backgroundColor: Colors.navy,
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  heroImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    opacity: 0.38,
  },
  heroGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flex: { flex: 1 },
  chatList: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 0,
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
    maxHeight: 100,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.08)",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.surface,
    shadowOpacity: 0,
    elevation: 0,
  },
  itinerarySection: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 6,
  },
  itineraryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 43, 136, 0.08)",
  },
  itineraryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  itineraryTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: 0.2,
  },
  itinerarySubtitle: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: "500",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gold,
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.white,
    letterSpacing: 0.3,
  },
  drivingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    gap: 8,
    backgroundColor: "rgba(0, 43, 136, 0.04)",
  },
  drivingBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  followupSection: {
    marginTop: 14,
    gap: 8,
  },
  followupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.muted,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  followupScroll: {
    gap: 8,
    paddingRight: 8,
  },
  followupChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1.5,
    borderColor: "rgba(0, 43, 136, 0.12)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  followupChipText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});
