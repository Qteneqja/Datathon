/**
 * GrydCheckout — in-app embedded GRYD payment experience.
 * Shows lot summary, partner branding, loading state, then WebView/iframe checkout.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { Colors } from "@/constants/colors";
import { GRYD_CHECKOUT_URL, type ParkingLot } from "@/constants/parking";

interface Props {
  lot: ParkingLot & { cost?: string; label?: string; emoji?: string };
  onClose: () => void;
}

export default function GrydCheckout({ lot, onClose }: Props) {
  const [loaded, setLoaded] = useState(false);

  const zone = lot.zone.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Pay with Gryd</Text>
            <Text style={styles.headerSub}>Smart Parking Partner</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* ── Lot Summary ── */}
        <View style={styles.summary}>
          <View style={styles.summaryLeft}>
            <View style={styles.summaryIcon}>
              <Image
                source={require("@/assets/GrydHalfLogoCropped.png")}
                style={{ width: "100%", height: "100%", resizeMode: "contain" }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lotName} numberOfLines={1}>{lot.name}</Text>
              <Text style={styles.lotMeta}>{zone} · {lot.capacity} spots</Text>
            </View>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.rateLabel}>Rate</Text>
            <Text style={styles.rateValue}>${lot.ratePerHour}/hr</Text>
            {lot.cost ? (
              <>
                <Text style={styles.rateLabel}>Est. 3h</Text>
                <Text style={styles.rateValue}>{lot.cost}</Text>
              </>
            ) : null}
          </View>
        </View>

        {/* ── Loading overlay ── */}
        {!loaded && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <View style={styles.loadingIconWrap}>
                <Ionicons name="shield-checkmark" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.loadingTitle}>Opening secure Gryd checkout…</Text>
              <Text style={styles.loadingSub}>Preparing your parking payment</Text>
              <ActivityIndicator
                size="large"
                color={Colors.primary}
                style={{ marginTop: 16 }}
              />
            </View>
          </View>
        )}

        {/* ── Embedded checkout ── */}
        <View style={[styles.webContainer, !loaded && { opacity: 0 }]}>
          {Platform.OS === "web" ? (
            <iframe
              src={GRYD_CHECKOUT_URL}
              style={{ width: "100%", height: "100%", border: "none" } as any}
              onLoad={() => setLoaded(true)}
              title="Gryd Checkout"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <WebView
              source={{ uri: GRYD_CHECKOUT_URL }}
              style={{ flex: 1 }}
              onLoadEnd={() => setLoaded(true)}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState={false}
              sharedCookiesEnabled={false}
            />
          )}
        </View>

        {/* ── Footer badge ── */}
        <View style={styles.footer}>
          <Ionicons name="lock-closed" size={12} color={Colors.muted} />
          <Text style={styles.footerText}>
            Secured by Gryd Park · Winnipeg Stride Integration
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const GRYD_GREEN = "#00C853";

const styles = StyleSheet.create({
  safeArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    zIndex: 100,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 43, 136, 0.06)",
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(0, 43, 136, 0.06)",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.primary,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: "600",
  },

  /* Lot Summary */
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.06)",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  lotName: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.text,
  },
  lotMeta: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: "500",
    marginTop: 1,
  },
  summaryRight: {
    alignItems: "flex-end",
    gap: 1,
  },
  rateLabel: {
    fontSize: 10,
    color: Colors.muted,
    fontWeight: "600",
  },
  rateValue: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.text,
  },

  /* Loading */
  loadingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  loadingCard: {
    alignItems: "center",
    gap: 6,
  },
  loadingIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(0, 43, 136, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    textAlign: "center",
  },
  loadingSub: {
    fontSize: 13,
    color: Colors.muted,
    fontWeight: "500",
    textAlign: "center",
  },

  /* WebView */
  webContainer: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 43, 136, 0.06)",
  },

  /* Footer */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 5,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 43, 136, 0.04)",
  },
  footerText: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: "600",
  },
});
