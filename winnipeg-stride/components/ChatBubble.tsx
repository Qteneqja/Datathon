import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBubble({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>W</Text>
          <View style={styles.sparkle}>
            <Ionicons name="sparkles" size={8} color={Colors.gold} />
          </View>
        </View>
      )}
      <View
        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}
      >
        {!isUser && <View style={styles.goldBar} />}
        <Text style={[styles.text, isUser && styles.textUser]}>{content}</Text>
      </View>
    </View>
  );
}

export function TypingIndicator({ label }: { label?: string }) {
  return (
    <View style={[styles.row, styles.rowAssistant]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>W</Text>
        <View style={styles.sparkle}>
          <Ionicons name="sparkles" size={8} color={Colors.gold} />
        </View>
      </View>
      <View style={[styles.bubble, styles.bubbleAssistant]}>
        <View style={styles.goldBar} />
        <View>
          {label && <Text style={styles.typingLabel}>{label}</Text>}
          <Text style={styles.dots}>● ● ●</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: 5,
    paddingHorizontal: 12,
  },
  rowUser: { justifyContent: "flex-end" },
  rowAssistant: { justifyContent: "flex-start" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 4,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sparkle: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarText: {
    color: Colors.white,
    fontWeight: "800",
    fontSize: 15,
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 15,
    flexDirection: "row",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 6,
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
  },
  bubbleAssistant: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.06)",
  },
  goldBar: {
    width: 3,
    backgroundColor: Colors.gold,
    borderRadius: 2,
    marginRight: 10,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
    flex: 1,
  },
  textUser: { color: Colors.white },
  typingLabel: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  dots: {
    color: Colors.muted,
    fontSize: 14,
    letterSpacing: 3,
    flex: 1,
  },
});
