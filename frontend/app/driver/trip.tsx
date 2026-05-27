import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

// ─── Color Constants ─────────────────────────────────────────────
const COLORS = {
  primaryBlue: "#0056B3",
  primary: "#1D4ED8",
  green: "#16A34A",
  greenBg: "#DCFCE7",
  darkGreen: "#2E7D32",
  red: "#DC2626",
  white: "#FFFFFF",
  bgCard: "#FAFAFA",
  bgLight: "#F8FAFC",
  textDark: "#1E293B",
  textGray: "#64748B",
  textLight: "#94A3B8",
  textMuted: "#475569",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  borderDarker: "#CBD5E1",
  counterBg: "#F1F5F9",
  minusBg: "#CBD5E1",
  blueBg: "#DBEAFE",
  onlineGreen: "#16A34A",
  navInactive: "#64748B",
  navActive: "#F59E0B",
  mapBg: "#0F172A",
};

export default function StartNewTrip() {
  const router = useRouter();
  const [passengerCount, setPassengerCount] = useState(24);
  const [activeTab, setActiveTab] = useState("trip");

  // ─── Passenger Counter ───────────────────────────────────────
  const incrementPassengers = () => setPassengerCount((prev) => prev + 1);
  const decrementPassengers = () =>
    setPassengerCount((prev) => Math.max(0, prev - 1));

  // ─── Primary Action: Start Trip → Navigate to Active Trip ────
  const handleStartTrip = () => {
    router.push("/driver/active-trip");
  };

  // ─── Cancel Trip ────────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert("Cancel Trip?", "Are you sure you want to cancel this trip?", [
      { text: "Stay", style: "cancel" },
      {
        text: "Cancel Trip",
        style: "destructive",
        onPress: () => router.back(),
      },
    ]);
  };

  // ─── Navigation Handler ────────────────────────────────────
  const handleNavigation = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case "home":
        router.push("/driver/dashboard");
        break;
      case "trip":
        break; // Already here
      default:
        break;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════════
            1. TOP HEADER NAVIGATION BAR
            ══════════════════════════════════════════════════════ */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Start New Trip</Text>
          </View>

          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>ONLINE</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            2. MAP PREVIEW
            ══════════════════════════════════════════════════════ */}
        <View style={styles.mapContainer}>
          {/* Grid overlay */}
          <View style={styles.mapGrid} />

          {/* Map pin */}
          <View style={styles.mapPin}>
            <Text style={styles.mapPinEmoji}>📍</Text>
          </View>

          {/* Location tag */}
          <View style={styles.mapLocationTag}>
            <Text style={styles.mapLocationIcon}>🧭</Text>
            <Text style={styles.mapLocationText}>Fort Central, Colombo</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            3. TRIP ROUTE DESTINATION INFO CARD
            ══════════════════════════════════════════════════════ */}
        <View style={styles.routeCard}>
          <View style={styles.timelineContainer}>
            {/* Timeline line */}
            <View style={styles.timelineLine} />

            {/* Origin */}
            <View style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineNode,
                  { borderColor: COLORS.primaryBlue },
                ]}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>ORIGIN</Text>
                <Text style={styles.timelineValue}>Colombo</Text>
              </View>
            </View>

            {/* Destination */}
            <View style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineNode,
                  {
                    backgroundColor: COLORS.red,
                    borderWidth: 0,
                    width: 14,
                    height: 14,
                  },
                ]}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>DESTINATION</Text>
                <Text style={styles.timelineValue}>Kurunegala</Text>
              </View>
            </View>
          </View>

          {/* Bus Number Badge */}
          <View style={styles.busBadge}>
            <Text style={styles.busBadgeLabel}>Bus No.</Text>
            <Text style={styles.busBadgeNumber}>138</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            MICRO JOURNEY ESTIMATIONS ROW
            ══════════════════════════════════════════════════════ */}
        <View style={styles.estimationsRow}>
          <View style={styles.estimationCard}>
            <View style={styles.estimationIcon}>
              <Ionicons name="time-outline" size={22} color={COLORS.textDark} />
            </View>
            <View>
              <Text style={styles.estimationLabel}>Duration</Text>
              <Text style={styles.estimationValue}>2h 30m</Text>
            </View>
          </View>

          <View style={styles.estimationCard}>
            <View style={styles.estimationIcon}>
              <MaterialCommunityIcons
                name="transfer"
                size={22}
                color={COLORS.textDark}
              />
            </View>
            <View>
              <Text style={styles.estimationLabel}>Stops</Text>
              <Text style={styles.estimationValue}>12 Stops</Text>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            4. PASSENGER COUNT SELECTOR
            ══════════════════════════════════════════════════════ */}
        <View style={styles.detailCard}>
          <View style={styles.detailCardHeader}>
            <Text style={styles.detailCardTitle}>Passenger Count</Text>
            <Text style={styles.detailCardEmoji}>👥</Text>
          </View>

          <View style={styles.counterWrapper}>
            <TouchableOpacity
              style={styles.minusBtn}
              onPress={decrementPassengers}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={24} color={COLORS.textDark} />
            </TouchableOpacity>

            <Text style={styles.counterValue}>{passengerCount}</Text>

            <TouchableOpacity
              style={styles.plusBtn}
              onPress={incrementPassengers}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            5. VEHICLE HEALTH MONITOR
            ══════════════════════════════════════════════════════ */}
        <View style={[styles.detailCard, styles.healthCard]}>
          <View style={styles.healthIconWrapper}>
            <MaterialCommunityIcons name="bus" size={22} color={COLORS.green} />
          </View>
          <View>
            <Text style={styles.healthLabel}>Vehicle Health</Text>
            <Text style={styles.healthValue}>Good</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            6. PRIMARY ACTION BUTTONS
            ══════════════════════════════════════════════════════ */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.startTripBtn}
            onPress={handleStartTrip}
            activeOpacity={0.85}
          >
            <Ionicons
              name="play-circle"
              size={20}
              color={COLORS.white}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.startTripBtnText}>START TRIP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>❌ CANCEL</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom spacer for nav bar */}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ════════════════════════════════════════════════════════
          7. BOTTOM NAVIGATION BAR
          ════════════════════════════════════════════════════════ */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => handleNavigation("home")}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === "home" ? "home" : "home-outline"}
            size={22}
            color={activeTab === "home" ? COLORS.navActive : COLORS.navInactive}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === "home" && { color: COLORS.navActive },
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => handleNavigation("trip")}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === "trip" ? "bus" : "bus-outline"}
            size={22}
            color={activeTab === "trip" ? COLORS.navActive : COLORS.navInactive}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === "trip" && { color: COLORS.navActive },
            ]}
          >
            Trip
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/driver/dashboard")}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="routes"
            size={22}
            color={COLORS.navInactive}
          />
          <Text style={styles.navLabel}>Route</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <Ionicons
            name="person-outline"
            size={22}
            color={COLORS.navInactive}
          />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // ─── Top Header ─────────────────────────────────────────────
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 16,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.bgLight,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primaryBlue,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.onlineGreen,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.white,
  },

  // ─── Map Preview ────────────────────────────────────────────
  mapContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    height: 160,
    borderRadius: 16,
    backgroundColor: COLORS.mapBg,
    position: "relative",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    // Simulated grid pattern using subtle borders
    borderWidth: 0.5,
    borderColor: COLORS.white,
  },
  mapPin: {
    position: "absolute",
    top: "42%",
    left: "55%",
  },
  mapPinEmoji: {
    fontSize: 28,
  },
  mapLocationTag: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapLocationIcon: {
    fontSize: 14,
  },
  mapLocationText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textDark,
  },

  // ─── Route Card ─────────────────────────────────────────────
  routeCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineContainer: {
    position: "relative",
    paddingLeft: 28,
    flex: 1,
  },
  timelineLine: {
    position: "absolute",
    left: 7,
    top: 12,
    bottom: 12,
    width: 2,
    backgroundColor: COLORS.borderDarker,
  },
  timelineItem: {
    marginBottom: 20,
    position: "relative",
  },
  timelineNode: {
    position: "absolute",
    left: -21,
    top: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 4,
  },
  timelineContent: {},
  timelineLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textLight,
    marginBottom: 2,
  },
  timelineValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textDark,
  },
  busBadge: {
    backgroundColor: COLORS.blueBg,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    minWidth: 60,
  },
  busBadgeLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  busBadgeNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primaryBlue,
  },

  // ─── Estimations Row ────────────────────────────────────────
  estimationsRow: {
    flexDirection: "row",
    gap: 14,
    marginHorizontal: 20,
    marginTop: 14,
  },
  estimationCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  estimationIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  estimationLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textGray,
  },
  estimationValue: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textDark,
  },

  // ─── Detail Card ────────────────────────────────────────────
  detailCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 14,
  },
  detailCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textMuted,
  },
  detailCardEmoji: {
    fontSize: 16,
  },

  // ─── Counter ────────────────────────────────────────────────
  counterWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.counterBg,
    borderRadius: 14,
    padding: 8,
    marginTop: 12,
  },
  minusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.minusBg,
    justifyContent: "center",
    alignItems: "center",
  },
  counterValue: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textDark,
  },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
  },

  // ─── Vehicle Health ────────────────────────────────────────
  healthCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
  },
  healthIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.greenBg,
    justifyContent: "center",
    alignItems: "center",
  },
  healthLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textGray,
  },
  healthValue: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.green,
  },

  // ─── Action Buttons ─────────────────────────────────────────
  actionsSection: {
    paddingHorizontal: 20,
    marginTop: 14,
    gap: 10,
  },
  startTripBtn: {
    width: "100%",
    backgroundColor: COLORS.darkGreen,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.darkGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  startTripBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
  },
  cancelBtn: {
    width: "100%",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderDarker,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    color: COLORS.textGray,
    fontSize: 14,
    fontWeight: "700",
  },

  // ─── Bottom Navigation ─────────────────────────────────────
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "ios" ? 85 : 70,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 20 : 0,
  },
  navItem: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.navInactive,
  },
});
