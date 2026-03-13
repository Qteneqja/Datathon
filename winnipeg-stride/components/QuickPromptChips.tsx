import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

const PROMPTS = [
  { text: "Plan a downtown evening", icon: "moon-outline" },
  { text: "Find parks near me", icon: "leaf-outline" },
  { text: "Things happening this weekend", icon: "calendar-outline" },
  { text: "Cheap date night ideas", icon: "heart-outline" },
  { text: "Food Tour", icon: "restaurant-outline" },
  { text: "Surprise Me!", icon: "sparkles-outline" },
];

interface Props {
  onSelect: (prompt: string) => void;
}

export default function QuickPromptChips({ onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scroll}
    >
      {PROMPTS.map((p) => (
        <TouchableOpacity
          key={p.text}
          style={styles.chip}
          activeOpacity={0.7}
          onPress={() => onSelect(p.text)}
        >
          <Ionicons name={p.icon as any} size={14} color={Colors.primary} />
          <Text style={styles.chipText}>{p.text}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 52,
  },
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1.5,
    borderColor: "rgba(0, 43, 136, 0.15)",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  chipText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
