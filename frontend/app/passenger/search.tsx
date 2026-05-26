import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Dimensions,
  FlatList,
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
  primaryBlue: "#0B4C8C",
  accentOrange: "#F2A12E",
  white: "#FFFFFF",
  textDark: "#111827",
  textGray: "#4B5563",
  borderLight: "#E5E7EB",
  placeholder: "#9CA3AF",
  inputBg: "#F3F4F6",
  bgLight: "#F8F9FA",
  dotInactive: "#E5E7EB",
};

// ─── Mock Recent Searches ────────────────────────────────────────
const RECENT_SEARCHES = [
  { id: "1", name: "Pettah Bus Stand", route: "Route 138, 122, 99" },
  { id: "2", name: "Kurunegala", route: "Route 15, 17" },
  { id: "3", name: "Maharagama", route: "Route 138, 122" },
  { id: "4", name: "Kandy", route: "Route 1, 79" },
  { id: "5", name: "Galle", route: "Route 2, 32" },
];

export default function PassengerSearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredResults = RECENT_SEARCHES.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        transparent
        backgroundColor="transparent"
      />

      {/* ─── Reusable Header Component ──────────────────────── */}
      <Header title="BusTrack LK" showMenu showGlobe />

      {/* ─── Search Bar ──────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={COLORS.textGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search routes or stops..."
            placeholderTextColor={COLORS.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={COLORS.textGray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── Search Content ──────────────────────────────────── */}
      <View style={styles.contentContainer}>
        {/* Popular Routes Section */}
        {searchQuery.length === 0 && (
          <>
            <Text style={styles.sectionTitle}>Popular Routes</Text>
            <View style={styles.popularRoutesGrid}>
              {[
                { name: "Colombo", icon: "📍", color: "#0B4C8C" },
                { name: "Kandy", icon: "🏔️", color: "#2E7D32" },
                { name: "Galle", icon: "🏖️", color: "#F2A12E" },
                { name: "Kurunegala", icon: "🌴", color: "#7C3AED" },
              ].map((route, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.popularRouteCard}
                  activeOpacity={0.8}
                >
                  <Text style={styles.popularRouteIcon}>{route.icon}</Text>
                  <Text style={styles.popularRouteName}>{route.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Search Results / Recent Searches */}
        <Text style={styles.sectionTitle}>
          {searchQuery.length > 0 ? "Search Results" : "Recent Searches"}
        </Text>

        <FlatList
          data={searchQuery.length > 0 ? filteredResults : RECENT_SEARCHES}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.searchResultItem}
              activeOpacity={0.7}
            >
              <View style={styles.searchResultIcon}>
                <Ionicons
                  name={
                    searchQuery.length > 0 ? "search-outline" : "time-outline"
                  }
                  size={20}
                  color={COLORS.primaryBlue}
                />
              </View>
              <View style={styles.searchResultDetails}>
                <Text style={styles.searchResultName}>{item.name}</Text>
                <Text style={styles.searchResultRoute}>{item.route}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.placeholder}
              />
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ─── Bottom Tab Bar ──────────────────────────────────── */}
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },

  // ─── Search Bar ─────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textDark,
  },

  // ─── Content ────────────────────────────────────────────────
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 80, // Bottom tab bar space
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 12,
    marginTop: 8,
  },

  // ─── Popular Routes Grid ────────────────────────────────────
  popularRoutesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  popularRouteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 6,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  popularRouteIcon: {
    fontSize: 16,
  },
  popularRouteName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textDark,
  },

  // ─── List ───────────────────────────────────────────────────
  listContainer: {
    paddingBottom: 20,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  searchResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  searchResultDetails: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  searchResultRoute: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 2,
  },
});
