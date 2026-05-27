import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Platform,
  RefreshControl,
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
  primary: "#1D4ED8",
  primaryDark: "#1E293B",
  accentAmber: "#F59E0B",
  green: "#16A34A",
  greenBg: "#DCFCE7",
  red: "#DC2626",
  blueBg: "#DBEAFE",
  white: "#FFFFFF",
  bgLight: "#F8FAFC",
  bgCard: "#FAFAFA",
  textDark: "#1E293B",
  textGray: "#64748B",
  textLight: "#94A3B8",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  onlineGreen: "#16A34A",
  navInactive: "#64748B",
  navActive: "#F59E0B",
};

// ─── Driver Data Type ────────────────────────────────────────────
interface DriverData {
  fullName?: string;
  employeeId?: string;
  phone?: string;
  busNumber?: string;
  email?: string;
}

// ─── Recent Trip Type ────────────────────────────────────────────
interface RecentTrip {
  id: string;
  from: string;
  to: string;
  time: string;
  distance: string;
  passengers: number;
  status: "On-Time" | "Delayed" | "Completed";
}

// ─── Mock Trips ──────────────────────────────────────────────────
const MOCK_TRIPS: RecentTrip[] = [
  {
    id: "1",
    from: "Station Square",
    to: "West Side Terminal",
    time: "09:45 AM",
    distance: "8.2 km",
    passengers: 144,
    status: "On-Time",
  },
  {
    id: "2",
    from: "East Plaza",
    to: "Central Mall",
    time: "08:30 AM",
    distance: "5.1 km",
    passengers: 98,
    status: "On-Time",
  },
];

export default function DriverDashboard() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  // ─── Load Driver Data ───────────────────────────────────────
  useEffect(() => {
    loadDriverData();
  }, []);

  const loadDriverData = async () => {
    try {
      const stored = await AsyncStorage.getItem("driver");
      if (stored) {
        setDriver(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading driver data:", error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDriverData();
    // Simulate network refresh
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  }, []);

  // ─── Logout Handler ─────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("authToken");
      await AsyncStorage.removeItem("driver");
      router.replace("/welcome");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // ─── Navigation Handler ────────────────────────────────────
  const handleNavigation = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case "trip":
        router.push("/driver/trip");
        break;
      case "profile":
        // Navigate to profile - add when profile page is created
        // router.push("/driver/profile");
        break;
      case "logout":
        handleLogout();
        break;
      default:
        break;
    }
  };

  // ─── Get Driver Initials ────────────────────────────────────
  const getInitials = (name?: string) => {
    if (!name) return "D";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // ─── Trip Status Badge ──────────────────────────────────────
  const TripStatusBadge = ({ status }: { status: string }) => {
    const isOnTime = status === "On-Time";
    return (
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: isOnTime ? COLORS.greenBg : "#FEF3C7" },
        ]}
      >
        <Text
          style={[
            styles.statusBadgeText,
            { color: isOnTime ? COLORS.green : "#D97706" },
          ]}
        >
          {status}
        </Text>
      </View>
    );
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgCard} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ══════════════════════════════════════════════════════
            TOP STATUS HEADER
            ══════════════════════════════════════════════════════ */}
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.menuBtn} onPress={handleLogout}>
            <Ionicons name="menu-outline" size={24} color={COLORS.textDark} />
          </TouchableOpacity>

          <Text style={styles.appName}>DriveAssist</Text>

          <View style={styles.onlineStatus}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>ONLINE</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            WELCOME SECTION
            ══════════════════════════════════════════════════════ */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>
            Welcome, {driver?.fullName?.split(" ")[0] || "Captain"}
          </Text>
          <Text style={styles.welcomeSub}>Your shift started 3h 12m ago.</Text>

          <View style={styles.onDutyBadge}>
            <View style={styles.onDutyDot} />
            <Text style={styles.onDutyText}>On Duty</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            ASSIGNED VEHICLE CARD
            ══════════════════════════════════════════════════════ */}
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleHeader}>
            <View>
              <Text style={styles.sectionLabel}>ASSIGNED VEHICLE</Text>
              <Text style={styles.vehicleNumber}>
                {driver?.busNumber || "BUS-8821"}
              </Text>
            </View>
            <View style={styles.inServiceBadge}>
              <Text style={styles.inServiceText}>In Service</Text>
            </View>
          </View>

          <View style={styles.routeSection}>
            <Text style={styles.sectionLabel}>CURRENT ROUTE</Text>
            <Text style={styles.routeText}>Downtown Express - Route A102</Text>
          </View>

          {/* Bus Icon Watermark */}
          <View style={styles.busWatermark}>
            <MaterialCommunityIcons
              name="bus"
              size={42}
              color={COLORS.primary}
              style={{ opacity: 0.08 }}
            />
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            DRIVER PROFILE BADGE
            ══════════════════════════════════════════════════════ */}
        <View style={styles.profileBadge}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {getInitials(driver?.fullName)}
              </Text>
            </View>
          </View>
          <Text style={styles.employeeLabel}>EMPLOYEE ID</Text>
          <Text style={styles.employeeId}>
            {driver?.employeeId || "#DRV-55291"}
          </Text>
        </View>

        {/* ══════════════════════════════════════════════════════
            QUICK ACTIONS
            ══════════════════════════════════════════════════════ */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>

        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.accentAmber }]}
            onPress={() => handleNavigation("trip")}
            activeOpacity={0.85}
          >
            <Ionicons
              name="play-circle"
              size={22}
              color={COLORS.white}
              style={styles.actionIcon}
            />
            <Text style={styles.actionBtnTextWhite}>Start New Trip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.border }]}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="map-legend"
              size={22}
              color={COLORS.textDark}
              style={styles.actionIcon}
            />
            <Text style={styles.actionBtnTextDark}>View My Route</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.border }]}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={22}
              color={COLORS.textDark}
              style={styles.actionIcon}
            />
            <Text style={styles.actionBtnTextDark}>Report Incident</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.border }]}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={22}
              color={COLORS.textDark}
              style={styles.actionIcon}
            />
            <Text style={styles.actionBtnTextDark}>View Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════════════════════════
            STATS MICRO CARDS
            ══════════════════════════════════════════════════════ */}
        <View style={styles.statsGrid}>
          <View style={styles.microCard}>
            <Text style={styles.microValue}>12</Text>
            <Text style={styles.microLabel}>Total Trips</Text>
          </View>

          <View style={styles.microCard}>
            <Text style={styles.microValue}>84.2</Text>
            <Text style={styles.microLabel}>Distance (km)</Text>
          </View>

          <View style={styles.microCard}>
            <Text style={styles.microValue}>6h 12m</Text>
            <Text style={styles.microLabel}>Hours Active</Text>
          </View>

          <View style={styles.microCard}>
            <Text style={styles.microValue}>3</Text>
            <Text style={styles.microLabel}>Notifications</Text>
            <View style={styles.notifDot} />
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            RECENT TRIPS
            ══════════════════════════════════════════════════════ */}
        <View style={styles.recentTripsSection}>
          <View style={styles.recentTripsHeader}>
            <Text style={styles.recentTripsTitle}>Recent Trips</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {MOCK_TRIPS.map((trip) => (
            <View key={trip.id} style={styles.tripRow}>
              <View style={styles.tripLeft}>
                <View style={styles.tripCheckCircle}>
                  <Ionicons name="checkmark" size={14} color={COLORS.green} />
                </View>
                <View style={styles.tripInfo}>
                  <Text style={styles.tripRoute}>
                    {trip.from} → {trip.to}
                  </Text>
                  <Text style={styles.tripMeta}>
                    Completed • {trip.time} • {trip.distance}
                  </Text>
                </View>
              </View>

              <View style={styles.tripRight}>
                <Text style={styles.tripPassengers}>{trip.passengers} Pax</Text>
                <TripStatusBadge status={trip.status} />
              </View>
            </View>
          ))}
        </View>

        {/* Bottom Spacer for Nav Bar */}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ════════════════════════════════════════════════════════
          BOTTOM NAVIGATION BAR
          ════════════════════════════════════════════════════════ */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab("home")}
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
          onPress={() => handleNavigation("route")}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={activeTab === "route" ? "routes" : "routes"}
            size={22}
            color={
              activeTab === "route" ? COLORS.navActive : COLORS.navInactive
            }
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === "route" && { color: COLORS.navActive },
            ]}
          >
            Route
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => handleNavigation("profile")}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === "profile" ? "person" : "person-outline"}
            size={22}
            color={
              activeTab === "profile" ? COLORS.navActive : COLORS.navInactive
            }
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === "profile" && { color: COLORS.navActive },
            ]}
          >
            Profile
          </Text>
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
    backgroundColor: COLORS.bgCard,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  appName: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textDark,
    letterSpacing: 0.3,
  },
  onlineStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.onlineGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.white,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.white,
  },

  // ─── Welcome Section ────────────────────────────────────────
  welcomeSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.textDark,
    marginBottom: 4,
  },
  welcomeSub: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textGray,
  },
  onDutyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.onlineGreen,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  onDutyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.white,
  },
  onDutyText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },

  // ─── Vehicle Card ───────────────────────────────────────────
  vehicleCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    position: "relative",
  },
  vehicleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textLight,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  vehicleNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.primary,
  },
  inServiceBadge: {
    backgroundColor: COLORS.blueBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inServiceText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
  },
  routeSection: {
    marginBottom: 4,
  },
  routeText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textDark,
  },
  busWatermark: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },

  // ─── Driver Profile Badge ──────────────────────────────────
  profileBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: 10,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.primary,
  },
  employeeLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 1,
    marginBottom: 2,
  },
  employeeId: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.white,
    opacity: 0.95,
  },

  // ─── Quick Actions ─────────────────────────────────────────
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textGray,
    letterSpacing: 0.6,
    paddingLeft: 20,
    marginBottom: 10,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  actionBtn: {
    width: (width - 54) / 2,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  actionIcon: {
    marginBottom: 4,
  },
  actionBtnTextWhite: {
    fontWeight: "700",
    fontSize: 13,
    color: COLORS.white,
    textAlign: "center",
  },
  actionBtnTextDark: {
    fontWeight: "700",
    fontSize: 13,
    color: COLORS.textDark,
    textAlign: "center",
  },

  // ─── Stats Grid ────────────────────────────────────────────
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  microCard: {
    width: (width - 52) / 2,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    position: "relative",
  },
  microValue: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.primary,
  },
  microLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textGray,
    marginTop: 4,
  },
  notifDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.red,
  },

  // ─── Recent Trips ──────────────────────────────────────────
  recentTripsSection: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    flex: 1,
  },
  recentTripsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recentTripsTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textDark,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  tripLeft: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flex: 1,
  },
  tripCheckCircle: {
    backgroundColor: COLORS.greenBg,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tripInfo: {
    flex: 1,
  },
  tripRoute: {
    fontSize: 13.5,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  tripMeta: {
    fontSize: 11,
    color: COLORS.textGray,
    marginTop: 2,
  },
  tripRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  tripPassengers: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
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
