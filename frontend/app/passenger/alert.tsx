import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BottomTabBar from "../components/BottomTabBar";
import Header from "../components/Header";

const { width, height } = Dimensions.get("window");

// ─── Color Constants ─────────────────────────────────────────────
const COLORS = {
  bgLight: "#F8F9FA",
  primary: "#0B4C8C",
  accentYellow: "#FBBF24",
  white: "#FFFFFF",
  textDark: "#111827",
  textGray: "#4B5563",
  borderLight: "#E5E7EB",
  placeholder: "#9CA3AF",
  infoBlue: "#3B82F6",
  infoBlueBg: "#EFF6FF",
  warningOrange: "#F59E0B",
  warningOrangeBg: "#FFFBEB",
  successGreen: "#10B981",
  successGreenBg: "#DCFCE7",
  dangerRed: "#EF4444",
  dangerRedBg: "#FEE2E2",
};

// ─── Mock Alert Data ─────────────────────────────────────────────
const ALERTS_DATA = [
  {
    id: "1",
    type: "traffic",
    title: "Heavy Traffic on Route 138",
    description:
      "Highlevel Road, Maharagama to Nugegoda section experiencing heavy traffic. Expect 15-20 min delay.",
    time: "2 min ago",
    icon: "car",
    bgColor: COLORS.dangerRedBg,
    iconColor: COLORS.dangerRed,
  },
  {
    id: "2",
    type: "info",
    title: "Bus 122 Arriving Soon",
    description:
      "Route 122 (Avissawella - Pettah) bus approaching Homagama stop. Estimated arrival in 3 minutes.",
    time: "5 min ago",
    icon: "bus",
    bgColor: COLORS.infoBlueBg,
    iconColor: COLORS.infoBlue,
  },
  {
    id: "3",
    type: "success",
    title: "Route 138 Schedule Updated",
    description:
      "New buses added for Route 138 during peak hours (7:00 AM - 9:00 AM & 4:00 PM - 7:00 PM).",
    time: "1 hour ago",
    icon: "checkmark-circle",
    bgColor: COLORS.successGreenBg,
    iconColor: COLORS.successGreen,
  },
  {
    id: "4",
    type: "warning",
    title: "Road Work Alert - Kottawa",
    description:
      "Road construction on Kottawa - Pannipitiya road. Buses may use alternate route via Mattegoda.",
    time: "2 hours ago",
    icon: "warning",
    bgColor: COLORS.warningOrangeBg,
    iconColor: COLORS.warningOrange,
  },
  {
    id: "5",
    type: "traffic",
    title: "Accident Near Pettah Bus Stand",
    description:
      "Minor accident near Pettah bus stand. Traffic police on site. Buses heading to Pettah may be delayed.",
    time: "3 hours ago",
    icon: "car",
    bgColor: COLORS.dangerRedBg,
    iconColor: COLORS.dangerRed,
  },
  {
    id: "6",
    type: "info",
    title: "New Route EX-2 Launched",
    description:
      "Express route EX-2 (Colombo - Negombo) started today. Buses every 20 minutes. Check schedules.",
    time: "5 hours ago",
    icon: "bus",
    bgColor: COLORS.infoBlueBg,
    iconColor: COLORS.infoBlue,
  },
];

export default function PassengerAlertScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("all");

  const filters = [
    { key: "all", label: "All" },
    { key: "traffic", label: "Traffic" },
    { key: "info", label: "Info" },
    { key: "warning", label: "Warnings" },
    { key: "success", label: "Updates" },
  ];

  const filteredAlerts =
    activeFilter === "all"
      ? ALERTS_DATA
      : ALERTS_DATA.filter((a) => a.type === activeFilter);

  const getAlertIcon = (type: string, icon: string) => {
    switch (icon) {
      case "bus":
        return <FontAwesome5 name="bus" size={18} color={COLORS.infoBlue} />;
      case "car":
        return (
          <MaterialCommunityIcons
            name="car"
            size={22}
            color={COLORS.dangerRed}
          />
        );
      case "warning":
        return (
          <Ionicons name="warning" size={22} color={COLORS.warningOrange} />
        );
      case "checkmark-circle":
        return (
          <Ionicons
            name="checkmark-circle"
            size={22}
            color={COLORS.successGreen}
          />
        );
      default:
        return (
          <Ionicons
            name="information-circle"
            size={22}
            color={COLORS.infoBlue}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ─── Reusable Header Component ──────────────────────── */}
      <Header title="BusTrack LK" showMenu showGlobe />

      {/* Main Scroll Container */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Page Title ───────────────────────────────────── */}
        <View style={styles.pageTitleRow}>
          <View>
            <Text style={styles.pageTitle}>Alerts & Notifications</Text>
            <Text style={styles.pageSubtitle}>
              Stay updated with real-time alerts
            </Text>
          </View>
          <TouchableOpacity style={styles.markAllBtn} activeOpacity={0.7}>
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Filter Badges Horizontal Row ─────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterBadge,
                activeFilter === filter.key && styles.filterBadgeActive,
              ]}
              onPress={() => setActiveFilter(filter.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterBadgeText,
                  activeFilter === filter.key && styles.filterBadgeTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ─── Alert Cards List ─────────────────────────────── */}
        {filteredAlerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="notifications-off-outline"
              size={48}
              color={COLORS.placeholder}
            />
            <Text style={styles.emptyStateTitle}>No Alerts</Text>
            <Text style={styles.emptyStateSub}>
              No {activeFilter} alerts at the moment
            </Text>
          </View>
        ) : (
          filteredAlerts.map((alert) => (
            <TouchableOpacity
              key={alert.id}
              style={styles.alertCard}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.alertIconContainer,
                  { backgroundColor: alert.bgColor },
                ]}
              >
                {getAlertIcon(alert.type, alert.icon)}
              </View>
              <View style={styles.alertContent}>
                <View style={styles.alertHeaderRow}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertTime}>{alert.time}</Text>
                </View>
                <Text style={styles.alertDescription}>{alert.description}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* ─── Bottom Spacing ───────────────────────────────── */}
        <View style={{ height: 20 }} />
      </ScrollView>

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

  // ─── Scroll Area ────────────────────────────────────────────
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },

  // ─── Page Title ─────────────────────────────────────────────
  pageTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textDark,
  },
  pageSubtitle: {
    fontSize: 13,
    color: COLORS.textGray,
    marginTop: 4,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },

  // ─── Filter Row ─────────────────────────────────────────────
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 16,
  },
  filterBadge: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textGray,
  },
  filterBadgeTextActive: {
    color: COLORS.white,
  },

  // ─── Alert Card ─────────────────────────────────────────────
  alertCard: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 10,
    gap: 12,
  },
  alertIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  alertContent: {
    flex: 1,
  },
  alertHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textDark,
    flex: 1,
    marginRight: 8,
  },
  alertTime: {
    fontSize: 11,
    color: COLORS.placeholder,
    fontWeight: "500",
  },
  alertDescription: {
    fontSize: 12,
    color: COLORS.textGray,
    lineHeight: 18,
    marginTop: 6,
  },

  // ─── Empty State ────────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
    marginTop: 16,
  },
  emptyStateSub: {
    fontSize: 14,
    color: COLORS.textGray,
    marginTop: 6,
  },
});
