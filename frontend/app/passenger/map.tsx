import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Dimensions,
  ImageBackground,
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
  primary: "#0B4C8C", // BusTrack LK නිල් පාට
  darkBlue: "#003366", // Live Card එකේ තද නිල් පාට
  accentYellow: "#F2A12E", // Track Live බටන් එකේ කහ පාට
  tabActiveYellow: "#FCD34D", // Active Map Tab එකේ කහ පාට
  white: "#FFFFFF",
  textDark: "#111827",
  textGray: "#4B5563",
  borderLight: "#E5E7EB",
  placeholder: "#9CA3AF",
  badgeNormal: "#FBBF24", // Normal Traffic කහ පාට Badge එක
};

export default function PassengerMapScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        transparent
        backgroundColor="transparent"
      />

      {/* ─── Map Background Layout ───────────────────────────── */}
      {/* සැබෑ සිතියමක් (react-native-maps) දානකම් මෙන්න මේ ImageBackground එක ක්‍රියාත්මක වෙනවා */}
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?q=80&w=800&auto=format&fit=crop",
        }}
        style={styles.mapBackground}
      >
        {/* ─── Reusable Header Component ──────────────────────── */}
        <View>
          <Header title="BusTrack LK" showMenu showGlobe />

          {/* Search Bar Map Layer Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color={COLORS.textGray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for routes or stops"
              placeholderTextColor={COLORS.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity activeOpacity={0.7}>
              <Ionicons name="mic-outline" size={20} color={COLORS.textDark} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Map Custom Markers Layer ───────────────────────── */}
        {/* Marker 1: Route 138 (Blue Bus) */}
        <View
          style={[
            styles.mapMarkerContainer,
            { top: height * 0.32, left: width * 0.22 },
          ]}
        >
          <View
            style={[
              styles.busMarkerCircle,
              { backgroundColor: COLORS.primary },
            ]}
          >
            <FontAwesome5 name="bus" size={14} color={COLORS.white} />
          </View>
          <View style={styles.markerLabelCard}>
            <Text style={styles.markerLabelText}>138 - Pettah</Text>
          </View>
        </View>

        {/* Marker 2: EX-01 Matara (Yellow Bus) */}
        <View
          style={[
            styles.mapMarkerContainer,
            { top: height * 0.52, left: width * 0.36 },
          ]}
        >
          <View
            style={[styles.busMarkerCircle, { backgroundColor: "#EAB308" }]}
          >
            <FontAwesome5 name="bus" size={14} color={COLORS.white} />
          </View>
          <View style={styles.markerLabelCard}>
            <Text style={styles.markerLabelText}>EX-01 Matara</Text>
          </View>
        </View>

        {/* User Current Location Dot */}
        <View
          style={[
            styles.userLiveDotCircle,
            { top: height * 0.47, left: width * 0.52 },
          ]}
        >
          <View style={styles.userLiveDotInner} />
        </View>

        {/* ─── Bottom Floating Action Controls ────────────────── */}
        <View style={styles.floatingActionsWrapper}>
          <TouchableOpacity
            style={styles.floatingActionIconCircle}
            activeOpacity={0.8}
          >
            <Ionicons name="locate" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.floatingActionIconCircle,
              { backgroundColor: COLORS.primary },
            ]}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="routes"
              size={22}
              color={COLORS.white}
            />
          </TouchableOpacity>
        </View>

        {/* ─── Passenger Information Overlay Cards ─────────────── */}
        <View style={styles.infoCardsRowDeck}>
          {/* Card Left: Next Bus Near You */}
          <View style={styles.nextBusCard}>
            <Text style={styles.cardSectionMiniTitle}>NEXT BUS NEAR YOU</Text>
            <Text style={styles.routeBoldTitle}>Route 138</Text>
            <View style={styles.minutesContainerRow}>
              <Text style={styles.giantMinutesText}>08</Text>
              <Text style={styles.minutesUnitLabel}>MIN</Text>
              <View style={styles.normalTrafficBadge}>
                <Text style={styles.trafficBadgeText}>NORMAL</Text>
              </View>
            </View>
          </View>

          {/* Card Right: Live Location Hub */}
          <View style={styles.liveTrackCard}>
            <View style={styles.liveHeaderIndicatorRow}>
              <Ionicons
                name="navigate-outline"
                size={16}
                color={COLORS.white}
              />
              <View style={styles.pulseLiveRow}>
                <View style={styles.liveGreenDot} />
                <Text style={styles.liveLabelTextText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.liveStationNameBold}>
              Bambalapitiya{"\n"}Stop
            </Text>
            <TouchableOpacity
              style={styles.trackLiveActionBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.trackLiveBtnText}>Track Live</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>

      {/* ─── Bottom Tab Bar (Reusable Component) ───────────── */}
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  mapBackground: {
    flex: 1,
    width: width,
    height: height,
  },

  // ─── Search Bar Container ──────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: COLORS.textDark,
    fontWeight: "500",
  },

  // ─── Map Custom Markers Mockup ──────────────────────────────
  mapMarkerContainer: {
    position: "absolute",
    alignItems: "center",
    gap: 4,
  },
  busMarkerCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  markerLabelCard: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    elevation: 2,
  },
  markerLabelText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  userLiveDotCircle: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(11, 76, 140, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  userLiveDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },

  // ─── Floating Action Buttons Controls ────────────────────────
  floatingActionsWrapper: {
    position: "absolute",
    right: 16,
    bottom: height * 0.29,
    gap: 10,
    alignItems: "center",
  },
  floatingActionIconCircle: {
    width: 46,
    height: 46,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },

  // ─── Bottom Information Decks Layout ─────────────────────────
  infoCardsRowDeck: {
    position: "absolute",
    bottom: 86,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 12,
  },
  nextBusCard: {
    flex: 1.1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    justifyContent: "space-between",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  cardSectionMiniTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textGray,
    letterSpacing: 0.3,
  },
  routeBoldTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primary,
    marginTop: 4,
  },
  minutesContainerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 6,
    gap: 4,
  },
  giantMinutesText: {
    fontSize: 40,
    fontWeight: "800",
    color: COLORS.textDark,
    lineHeight: 44,
  },
  minutesUnitLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textGray,
    marginRight: 6,
  },
  normalTrafficBadge: {
    backgroundColor: "#FBBF24",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  trafficBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.textDark,
  },
  liveTrackCard: {
    flex: 0.9,
    backgroundColor: COLORS.darkBlue,
    borderRadius: 14,
    padding: 14,
    justifyContent: "space-between",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  liveHeaderIndicatorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pulseLiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveLabelTextText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "700",
  },
  liveStationNameBold: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 18,
    marginVertical: 8,
  },
  trackLiveActionBtn: {
    backgroundColor: "#FBBF24",
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  trackLiveBtnText: {
    color: COLORS.textDark,
    fontSize: 13,
    fontWeight: "700",
  },
});
