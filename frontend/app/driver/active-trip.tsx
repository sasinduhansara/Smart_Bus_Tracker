import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import RouteMap from "../components/RouteMap";

const { width } = Dimensions.get("window");

// ─── Color Constants ─────────────────────────────────────────────
const COLORS = {
  primaryBlue: "#0056B3",
  primary: "#1D4ED8",
  gradientBlue: "#1E6091",
  green: "#16A34A",
  greenBg: "#DCFCE7",
  darkGreen: "#15803D",
  red: "#B91C1C",
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
  blueBg: "#DBEAFE",
  mapBg: "#0F172A",
  navInactive: "#64748B",
  navActive: "#F59E0B",
  progressBg: "#E2E8F0",
  grayBtn: "#64748B",
};

export default function ActiveTripTracking() {
  const router = useRouter();
  const [currentSpeed] = useState(41);
  const [tripTime, setTripTime] = useState("00:51:30");
  const [activeTab, setActiveTab] = useState("trip");

  // ─── Live Timer ──────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setTripTime((prev) => {
        let [h, m, s] = prev.split(":").map(Number);
        s++;
        if (s >= 60) {
          m++;
          s = 0;
        }
        if (m >= 60) {
          h++;
          m = 0;
        }
        return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── End Trip Handler ──────────────────────────────────────
  const handleEndTrip = () => {
    Alert.alert("🛑 End Trip", "Are you sure you want to end this trip?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Trip",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "✅ Trip Completed",
            `Trip time: ${tripTime}\nPassengers: 24\nRoute: Colombo → Kurunegala\n\nTrip has been logged successfully!`,
            [
              {
                text: "OK",
                onPress: () => router.replace("/driver/dashboard"),
              },
            ],
          );
        },
      },
    ]);
  };

  // ─── Report Incident ──────────────────────────────────────
  const handleIncident = () => {
    Alert.alert("⚠️ Report Incident", "What type of incident?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Traffic Delay",
        onPress: () => Alert.alert("✅", "Incident reported to dispatch."),
      },
      {
        text: "Mechanical Issue",
        onPress: () => Alert.alert("✅", "Maintenance notified."),
      },
      {
        text: "Emergency",
        style: "destructive",
        onPress: () => Alert.alert("🚨", "Emergency services notified!"),
      },
    ]);
  };

  // ─── Update Passengers ────────────────────────────────────
  const handleUpdatePassengers = () => {
    Alert.alert("👥 Update Passenger Count", "Enter current passenger count", [
      {
        text: "OK",
        onPress: () => Alert.alert("✅", "Passenger count updated."),
      },
    ]);
  };

  // ─── Navigation ────────────────────────────────────────────
  const handleNavigation = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case "home":
        router.push("/driver/dashboard");
        break;
      case "trip":
        break;
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
            1. TOP HEADER
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
            <Text style={styles.headerTitle}>DriveAssist</Text>
          </View>
          <View style={styles.tripActiveBadge}>
            <View style={styles.tripActiveDot} />
            <Text style={styles.tripActiveText}>TRIP ACTIVE</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            2. LIVE GPS MAP (OpenStreetMap + overlay)
            ══════════════════════════════════════════════════════ */}
        <View style={styles.trackingMapWrapper}>
          <RouteMap height={260} showHeader={false} interactive={false} />

          {/* Floating overlays on top of map */}
          <View style={styles.mapOverlaysContainer} pointerEvents="none">
            {/* Speedometer */}
            <View style={styles.speedometerDial}>
              <Text style={styles.speedValue}>{currentSpeed}</Text>
              <Text style={styles.speedUnit}>KM/H</Text>
            </View>

            {/* Timer */}
            <View style={styles.floatingTimerBox}>
              <Text style={styles.floatingLabel}>TRIP TIME</Text>
              <Text style={styles.timerValue}>{tripTime}</Text>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            3. TRIP PROGRESS BAR
            ══════════════════════════════════════════════════════ */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>TRIP PROGRESS</Text>
            <Text style={styles.progressCount}>3 of 8 Stops</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={styles.progressBarFill} />
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            4. NEXT STOP BANNER
            ══════════════════════════════════════════════════════ */}
        <View style={styles.nextStopBanner}>
          <View style={styles.nextStopLeft}>
            <Text style={styles.nextStopLabel}>NEXT STOP</Text>
            <Text style={styles.nextStopName}>Grand Central Station</Text>
            <Text style={styles.nextStopInfo}>Passenger Pickup • Gate 4</Text>
          </View>
          <View style={styles.nextStopRight}>
            <Text style={styles.nextStopDistance}>
              1.2 <Text style={styles.nextStopDistanceUnit}>km</Text>
            </Text>
            <View style={styles.etaBadge}>
              <Text style={styles.etaText}>ETA 4 MIN</Text>
            </View>
          </View>
        </View>

        {/* Completed Stop */}
        <View style={styles.completedStopRow}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
          <Text style={styles.completedStopText}>
            Harbor Terminal 1{" "}
            <Text style={styles.completedStopLabel}>(Completed)</Text>
          </Text>
        </View>

        {/* ══════════════════════════════════════════════════════
            5. ACTION CONTROL BUTTONS
            ══════════════════════════════════════════════════════ */}
        <View style={styles.controlActionsRow}>
          {/* Incident Button */}
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: COLORS.red }]}
            onPress={handleIncident}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={COLORS.white}
            />
            <Text style={styles.controlBtnText}>INCIDENT</Text>
          </TouchableOpacity>

          {/* Update Button */}
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: COLORS.primary }]}
            onPress={handleUpdatePassengers}
            activeOpacity={0.85}
          >
            <Ionicons name="people" size={20} color={COLORS.white} />
            <Text style={styles.controlBtnText}>UPDATE</Text>
          </TouchableOpacity>

          {/* End Trip Button */}
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: COLORS.grayBtn }]}
            onPress={handleEndTrip}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="stop-circle"
              size={20}
              color={COLORS.white}
            />
            <Text style={styles.controlBtnText}>END TRIP</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ════════════════════════════════════════════════════════
          6. BOTTOM NAVIGATION BAR
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

        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
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
  tripActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tripActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.green,
  },
  tripActiveText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.green,
  },

  // ─── Tracking Map ───────────────────────────────────────────
  trackingMapWrapper: {
    position: "relative",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mapOverlaysContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // ─── Speedometer ───────────────────────────────────────────
  speedometerDial: {
    position: "absolute",
    bottom: -65,
    left: 14,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.white,
    borderWidth: 4,
    borderColor: COLORS.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 10,
  },
  speedValue: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.textDark,
    lineHeight: 26,
  },
  speedUnit: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.textGray,
  },

  // ─── Timer ─────────────────────────────────────────────────
  floatingLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textGray,
    marginBottom: 2,
  },
  floatingTimerBox: {
    position: "absolute",
    bottom: 14,
    right: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "flex-end",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  timerValue: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textDark,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  // ─── Progress Section ──────────────────────────────────────
  progressSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.primaryBlue,
    letterSpacing: 0.3,
  },
  progressCount: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textDark,
  },
  progressBarBg: {
    width: "100%",
    height: 10,
    backgroundColor: COLORS.progressBg,
    borderRadius: 20,
    marginTop: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    width: "37.5%",
    height: "100%",
    backgroundColor: COLORS.darkGreen,
    borderRadius: 20,
  },

  // ─── Next Stop Banner ──────────────────────────────────────
  nextStopBanner: {
    backgroundColor: COLORS.gradientBlue,
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 20,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  nextStopLeft: {
    flex: 1,
  },
  nextStopLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  nextStopName: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.white,
  },
  nextStopInfo: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  nextStopRight: {
    alignItems: "flex-end",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.2)",
    paddingLeft: 16,
  },
  nextStopDistance: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.white,
  },
  nextStopDistanceUnit: {
    fontSize: 12,
    fontWeight: "700",
  },
  etaBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  etaText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.white,
  },

  // ─── Completed Stop ────────────────────────────────────────
  completedStopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  completedStopText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textGray,
  },
  completedStopLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textLight,
  },

  // ─── Control Buttons ──────────────────────────────────────
  controlActionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  controlBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  controlBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.white,
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
