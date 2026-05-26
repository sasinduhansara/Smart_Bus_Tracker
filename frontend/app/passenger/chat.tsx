import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Dimensions,
  Image,
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
  primary: "#0B4C8C", // BusTrack LK තද නිල් පාට
  darkBlueBubble: "#0B4C8C", // User Message Bubble එකේ නිල් පාට
  accentYellow: "#FBC02D", // Pro Tip සහ Active Chat Tab එකේ කහ පාට
  white: "#FFFFFF",
  textDark: "#111827",
  textGray: "#4B5563",
  borderLight: "#E5E7EB",
  placeholder: "#9CA3AF",
  botAvatarBg: "#0B4C8C",
  offlineBg: "#E5E7EB",
};

export default function PassengerAIAssistantScreen() {
  const router = useRouter();
  const [inputText, setInputText] = useState("");

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ─── Reusable Header Component ──────────────────────── */}
      <Header title="BusTrack LK" showMenu showGlobe />

      {/* ─── Chat Message Scroll View Area ──────────────────── */}
      <ScrollView
        contentContainerStyle={styles.chatScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bot Profile Intro Header */}
        <View style={styles.botIntroContainer}>
          <View style={styles.botLargeAvatar}>
            <MaterialCommunityIcons
              name="robot-outline"
              size={36}
              color={COLORS.white}
            />
          </View>
          <Text style={styles.botMainName}>AI Assistant</Text>
          <Text style={styles.botSubName}>
            Your Sri Lankan transit companion
          </Text>
        </View>

        {/* User Question Bubble */}
        <View style={styles.userBubbleWrapper}>
          <View style={styles.userChatBubble}>
            <Text style={styles.userBubbleText}>
              When will bus 138 reach Town Hall?
            </Text>
          </View>
          <Text style={styles.chatTimeText}>10:42 AM</Text>
        </View>

        {/* Bot Response Stream Core Card */}
        <View style={styles.botResponseWrapper}>
          <View style={styles.botMiniAvatarCircle}>
            <MaterialCommunityIcons
              name="robot-outline"
              size={14}
              color={COLORS.white}
            />
          </View>
          <View style={styles.botMainResponseCard}>
            <Text style={styles.botResponseParagraph}>
              Bus 138 is currently <Text style={styles.boldText}>2.5km</Text>{" "}
              away and is expected to reach Town Hall in approximately{" "}
              <Text style={[styles.boldText, { color: "#856404" }]}>
                8 minutes
              </Text>{" "}
              based on live traffic.
            </Text>
            {/* Inner ETA Timing Breakdown Dashboard */}
            <View style={styles.etaDashboardCard}>
              <View style={styles.etaLeftColumn}>
                <Text style={styles.etaMiniTitle}>ESTIMATED TIME</Text>
                <Text style={styles.etaBigNumber}>08</Text>
                <Text style={styles.etaUnitLabel}>MINUTES</Text>
              </View>
              <View style={styles.verticalDividerLine} />
              <View style={styles.etaRightColumn}>
                <View style={styles.etaDetailRow}>
                  <Ionicons name="traffic-outline" size={16} color="#856404" />
                  <Text style={styles.etaDetailText}>Moderate Traffic</Text>
                </View>
                <View style={styles.etaDetailRow}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.etaDetailText}>Route 138 - Pettah</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        <Text style={[styles.chatTimeText, { marginLeft: 54, marginTop: 4 }]}>
          10:42 AM
        </Text>

        {/* Live Tracking Map View Card */}
        <View style={styles.mapCardSection}>
          <View style={styles.mapCardHeaderRow}>
            <Text style={styles.mapCardTitle}>Live Tracking</Text>
            <View style={styles.gpsActiveRow}>
              <View style={styles.gpsGreenDot} />
              <Text style={styles.gpsActiveText}>GPS Active</Text>
            </View>
          </View>
          <View style={styles.mapImageFrame}>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=600&auto=format&fit=crop",
              }} // Clean schematic map vector image
              style={styles.mapImage}
            />
            {/* Center floating Bus Indicator inside map preview */}
            <View style={styles.floatingBusMarkerSquare}>
              <FontAwesome5 name="bus" size={14} color={COLORS.primary} />
            </View>
          </View>
        </View>

        {/* Pro Tip Accent Warning Card */}
        <View style={styles.proTipCard}>
          <Text style={styles.proTipTitle}>Pro Tip</Text>
          <Text style={styles.proTipDescription}>
            Route 138 is usually less crowded at the Town Hall stop compared to
            Colombo Fort Terminal during this hour.
          </Text>
        </View>
      </ScrollView>

      {/* ─── Bottom Chat Input Field Container ───────────────── */}
      <View style={styles.bottomInputWrapper}>
        <View style={styles.inputInnerContainer}>
          <TouchableOpacity style={styles.addMediaBtn} activeOpacity={0.7}>
            <Ionicons name="add" size={24} color={COLORS.textGray} />
          </TouchableOpacity>
          <TextInput
            style={styles.chatInputField}
            placeholder="Ask about routes, times, or fares..."
            placeholderTextColor={COLORS.placeholder}
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.sendActionBtn} activeOpacity={0.85}>
            <Ionicons name="send" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
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

  // Main Scrollable Area Layout
  chatScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 160, // Input Area එකට වැහෙන්නේ නැති වෙන්න ඉඩ තැබුවා
  },
  botIntroContainer: {
    alignItems: "center",
    marginVertical: 16,
  },
  botLargeAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.botAvatarBg,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  botMainName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
    marginTop: 10,
  },
  botSubName: {
    fontSize: 13,
    color: COLORS.textGray,
    marginTop: 2,
  },

  // User Message Chat Bubble Layout
  userBubbleWrapper: {
    alignItems: "flex-end",
    marginVertical: 8,
    width: "100%",
  },
  userChatBubble: {
    backgroundColor: COLORS.darkBlueBubble,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomRightRadius: 2,
    maxWidth: width * 0.75,
  },
  userBubbleText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  chatTimeText: {
    fontSize: 11,
    color: COLORS.placeholder,
    marginTop: 4,
    fontWeight: "500",
  },

  // Bot Response Message Core Card Styles
  botResponseWrapper: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 12,
    width: "100%",
  },
  botMiniAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.accentYellow,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  botMainResponseCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderTopLeftRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
  },
  botResponseParagraph: {
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 22,
    fontWeight: "400",
  },
  boldText: {
    fontWeight: "700",
    color: COLORS.primary,
  },

  // Timing Breakdown Dashboard
  etaDashboardCard: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 12,
    marginTop: 12,
    alignItems: "center",
  },
  etaLeftColumn: {
    flex: 1,
    alignItems: "flex-start",
  },
  etaMiniTitle: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.textGray,
    letterSpacing: 0.3,
  },
  etaBigNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: COLORS.primary,
    lineHeight: 40,
    marginVertical: 2,
  },
  etaUnitLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textGray,
  },
  verticalDividerLine: {
    width: 1,
    height: "80%",
    backgroundColor: COLORS.borderLight,
    marginHorizontal: 12,
  },
  etaRightColumn: {
    flex: 1.2,
    gap: 8,
  },
  etaDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  etaDetailText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textDark,
  },

  // Live Tracking Map Section Styles
  mapCardSection: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
    marginTop: 14,
    marginLeft: 36, // Align neatly under bot card
  },
  mapCardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  mapCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  gpsActiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  gpsGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  gpsActiveText: {
    fontSize: 11,
    color: "#16A34A",
    fontWeight: "700",
  },
  mapImageFrame: {
    height: 100,
    width: "100%",
    borderRadius: 8,
    position: "relative",
    overflow: "hidden",
  },
  mapImage: {
    width: "100%",
    height: "100%",
  },
  floatingBusMarkerSquare: {
    position: "absolute",
    top: "40%",
    left: "48%",
    backgroundColor: COLORS.white,
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  // Pro Tip Content Accent Box
  proTipCard: {
    backgroundColor: "#FFD54F", // Yellow Orange Accent Box
    borderRadius: 12,
    padding: 16,
    marginTop: 14,
    marginLeft: 36,
  },
  proTipTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#5D4037",
  },
  proTipDescription: {
    fontSize: 13,
    color: "#5D4037",
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 4,
  },

  // Bottom Interactive Chat Input Bar Styles
  bottomInputWrapper: {
    position: "absolute",
    bottom: 74,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  inputInnerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 26,
    height: 52,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addMediaBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  chatInputField: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.textDark,
  },
  sendActionBtn: {
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
});
