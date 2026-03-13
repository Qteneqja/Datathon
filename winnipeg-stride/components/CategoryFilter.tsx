import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Colors, CategoryColors } from "@/constants/colors";

const CATEGORIES = [
  "Park",
  "Restaurant",
  "Arts & Culture",
  "Recreation",
  "Public Art",
];

interface Props {
  /** Set of active categories — empty means all shown */
  selected: Set<string>;
  /** Toggle a single category on/off */
  onToggle: (cat: string) => void;
}

export default function CategoryFilter({ selected, onToggle }: Props) {
  return (
    <View style={styles.row}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {CATEGORIES.map((cat) => {
          const active = selected.has(cat);
          const dotColor = CategoryColors[cat] || Colors.primary;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.7}
              onPress={() => onToggle(cat)}
            >
              <View style={[styles.dot, { backgroundColor: active ? Colors.white : dotColor }]} />
              <Text style={[styles.text, active && styles.textActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 40,
    maxHeight: 40,
    overflow: "hidden",
  },
  container: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: Colors.white,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.08)",
    gap: 5,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text,
  },
  textActive: {
    color: Colors.white,
  },
});
