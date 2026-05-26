import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Dimensions,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BottomTabBar from "../components/BottomTabBar";
import Header from "../components/Header";

const { width, height } = Dimensions.get("window");

// ─── Color Constants ─────────────────────────────────────────────
const COLORS = {
  bgLight: "#F8F9FA",
  primary: "#0B4C8C", // BusTrack LK සහ Live Map නිල් පාට
  accentYellow: "#F2A12E", // Schedules, QR සහ Active Tab කහ/තැඹිලි පාට
  white: "#FFFFFF",
  textDark: "#111827",
  textGray: "#4B5563",
  borderLight: "#E5E7EB",
  placeholder: "#9CA3AF",
  inputBg: "#FFFFFF",
  trafficGreen: "#065F46", // Normal Traffic පසුබිම
  trafficGreenText: "#D1FAE5",
  trafficRed: "#911E1E", // Heavy Traffic පසුබිම
  trafficRedBg: "#FEE2E2",
};

export default function PassengerHomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgLight} />

      {/* ─── Reusable Header Component ──────────────────────── */}
      <Header title="BusTrack LK" showMenu showGlobe />

      {/* Main Scroll Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Search Bar ───────────────────────────────────── */}
        <View style={styles.searchBox}>
          <Ionicons
            name="search-outline"
            size={20}
            color={COLORS.placeholder}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Where to?"
            placeholderTextColor={COLORS.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* ─── Quick Actions Section ─────────────────────────── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {/* Live Map Card */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: COLORS.primary }]}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="map-outline"
              size={26}
              color={COLORS.white}
            />
            <Text style={[styles.actionCardText, { color: COLORS.white }]}>
              Live Map
            </Text>
          </TouchableOpacity>

          {/* Schedules Card */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: "#FCD34D" }]}
            activeOpacity={0.85}
          >
            <Ionicons
              name="calendar-outline"
              size={26}
              color={COLORS.textDark}
            />
            <Text style={[styles.actionCardText, { color: COLORS.textDark }]}>
              Schedules
            </Text>
          </TouchableOpacity>
        </View>

        {/* Saved Stops (Full Width Button) */}
        <TouchableOpacity style={styles.savedStopsBtn} activeOpacity={0.8}>
          <Ionicons name="bookmark-outline" size={20} color={COLORS.textGray} />
          <Text style={styles.savedStopsText}>Saved Stops</Text>
        </TouchableOpacity>

        {/* ─── Nearby Buses Section ──────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Nearby Buses</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.viewAllLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Bus Card 1: 138 Kottawa */}
        <View style={styles.busCard}>
          <View style={styles.busCardTop}>
            <View style={styles.routeBadge}>
              <Text style={styles.routeNumber}>138</Text>
            </View>
            <View style={styles.routeDetails}>
              <Text style={styles.routeName}>Kottawa - Pettah</Text>
              <Text style={styles.stopName}>🚌 Maharagama Stop</Text>
            </View>
          </View>

          <View style={styles.busCardBottom}>
            <View style={styles.timeBox}>
              <Text style={styles.timeNumber}>8</Text>
              <Text style={styles.timeUnit}>MINS</Text>
            </View>
            <View style={styles.statusBadges}>
              <View
                style={[styles.statusBadge, { backgroundColor: "#10B981" }]}
              >
                <Text style={[styles.statusText, { color: COLORS.white }]}>
                  Normal Traffic
                </Text>
              </View>
              <View style={styles.typeOutlineBadge}>
                <Text style={styles.typeOutlineText}>Luxury</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bus Card 2: 122 Avissawella */}
        <View style={styles.busCard}>
          <View style={styles.busCardTop}>
            <View style={styles.routeBadge}>
              <Text style={styles.routeNumber}>122</Text>
            </View>
            <View style={styles.routeDetails}>
              <Text style={styles.routeName}>Avissawella - Pettah</Text>
              <Text style={styles.stopName}>🚌 Homagama Town</Text>
            </View>
          </View>

          <View style={styles.busCardBottom}>
            <View style={[styles.timeBox, { backgroundColor: "#FEE2E2" }]}>
              <Text style={[styles.timeNumber, { color: "#DC2626" }]}>15</Text>
              <Text style={[styles.timeUnit, { color: "#DC2626" }]}>MINS</Text>
            </View>
            <View style={styles.statusBadges}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: COLORS.trafficRedBg },
                ]}
              >
                <Text style={[styles.statusText, { color: "#B91C1C" }]}>
                  Heavy Traffic
                </Text>
              </View>
              <View style={styles.typeOutlineBadge}>
                <Text style={styles.typeOutlineText}>AC Luxury</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── Map Image Preview Section ─────────────────────── */}
        <View style={styles.mapPreviewContainer}>
          <ImageBackground
            source={{
              uri: "https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=600&auto=format&fit=crop",
            }} // Dark network abstract graphic map placeholder
            style={styles.mapImage}
            imageStyle={{ borderRadius: 12 }}
          >
            {/* Locate Me Floating Button */}
            <TouchableOpacity style={styles.locateMeBtn} activeOpacity={0.85}>
              <Ionicons name="locate-outline" size={18} color={COLORS.white} />
              <Text style={styles.locateMeText}>Locate Me</Text>
            </TouchableOpacity>
          </ImageBackground>
        </View>

        {/* ─── Recent Trips Section ─────────────────────────── */}
        <Text style={styles.sectionTitle}>Recent Trips</Text>

        {/* Recent Item 1 */}
        <View style={styles.recentTripRow}>
          <View style={styles.recentIconCircle}>
            <Ionicons name="time-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.recentDetails}>
            <Text style={styles.recentTitle}>Fort Stand</Text>
            <Text style={styles.recentSub}>Route 138 • Yesterday</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.placeholder}
          />
        </View>

        {/* Recent Item 2 */}
        <View style={styles.recentTripRow}>
          <View style={styles.recentIconCircle}>
            <Ionicons name="time-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.recentDetails}>
            <Text style={styles.recentTitle}>Nugegoda Junction</Text>
            <Text style={styles.recentSub}>Route 122 • 2 days ago</Text>
          </View>

          {/* Yellow Floating QR Action Button near Recent */}
          <TouchableOpacity style={styles.qrFloatingIcon} activeOpacity={0.85}>
            <Ionicons
              name="qr-code-outline"
              size={22}
              color={COLORS.textDark}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ─── Bottom Tab Bar (Reusable Component) ───────────── */}
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },

  // Scroll Area
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100, // Bottom menu එකට වැහෙන්නේ නැතිවෙන්න space එකක්
  },

  // Search Box
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: COLORS.textDark,
  },

  // Headings
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 6,
  },

  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: "row",
    gap: 14,
  },
  actionCard: {
    flex: 1,
    height: 84,
    borderRadius: 12,
    padding: 14,
    justifyContent: "space-between",
  },
  actionCardText: {
    fontSize: 14,
    fontWeight: "700",
  },
  savedStopsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
    height: 48,
    borderRadius: 10,
    marginTop: 14,
    gap: 8,
  },
  savedStopsText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
  },

  // Nearby Bus Cards
  busCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 12,
  },
  busCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  routeBadge: {
    backgroundColor: COLORS.primary,
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  routeNumber: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },
  routeDetails: {
    flex: 1,
  },
  routeName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  stopName: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 2,
  },
  busCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 12,
  },
  timeBox: {
    backgroundColor: "#F3F4F6",
    width: 64,
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  timeNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
  },
  timeUnit: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textGray,
  },
  statusBadges: {
    flex: 1,
    gap: 6,
  },
  statusBadge: {
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  typeOutlineBadge: {
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  typeOutlineText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },

  // Map Preview
  mapPreviewContainer: {
    height: 150,
    width: "100%",
    marginVertical: 14,
  },
  mapImage: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    padding: 12,
  },
  locateMeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    gap: 6,
  },
  locateMeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },

  // Recent Trips
  recentTripRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    position: "relative",
  },
  recentIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  recentDetails: {
    flex: 1,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  recentSub: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 2,
  },
  qrFloatingIcon: {
    position: "absolute",
    right: 0,
    top: -12,
    backgroundColor: "#FBBF24",
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
