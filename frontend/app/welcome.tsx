import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { height } = Dimensions.get("window");

// ─── Color Constants ─────────────────────────────────────────────
const COLORS = {
  bgLight: "#F8F9FA", // උඩ කොටසේ තියෙන ලා අළු/සුදු පසුබිම
  primary: "#0B4C8C", // GamanaLK සහ Passenger Card නිල් පාට
  accentOrange: "#F2A12E", // Driver Card එකේ තියෙන තැඹිලි පාට
  white: "#FFFFFF",
  textDark: "#111827",
  textGray: "#4B5563",
  borderLight: "#E5E7EB",
};

// ─── StatusBar Height ────────────────────────────────────────────
const STATUS_BAR_HEIGHT =
  Platform.OS === "ios" ? 44 : StatusBar.currentHeight || 24;

export default function RoleSelectionScreen() {
  const router = useRouter();

  const goToDriverLogin = () => {
    router.push("/driver/login");
  };

  const goToPassengerLogin = () => {
    router.push("/passenger/login");
  };

  const goBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* StatusBar Setup */}
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgLight} />

      {/* ─── Header Section ─────────────────────────────────── */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.appName}>GamanaLK</Text>
        <View style={{ width: 24 }} />
        {/* Back arrow එක center වෙන්න දාපු spacer එකක් */}
      </View>

      {/* ─── Welcome Titles ──────────────────────────────────── */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeTitle}>Welcome to</Text>
        <Text style={styles.welcomeTitleBold}>GamanaLK</Text>
        <Text style={styles.subtitle}>Choose your role to get started</Text>
      </View>

      {/* ─── Cards Section (Main Content) ────────────────────── */}
      <View style={styles.cardsContainer}>
        {/* Passenger Card */}
        <View style={styles.roleCard}>
          <View
            style={[styles.iconCircle, { backgroundColor: COLORS.primary }]}
          >
            <FontAwesome5 name="bus-alt" size={22} color={COLORS.white} />
          </View>
          <Text style={styles.roleTitle}>I am a Passenger</Text>
          <Text style={styles.roleDesc}>Find buses and track your ride</Text>

          <TouchableOpacity
            style={styles.arrowButton}
            onPress={goToPassengerLogin}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Driver Card */}
        <View style={styles.roleCard}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: COLORS.accentOrange },
            ]}
          >
            <FontAwesome5 name="bus" size={22} color={COLORS.white} />
          </View>
          <Text style={styles.roleTitle}>I am a Driver</Text>
          <Text style={styles.roleDesc}>Manage trips and share location</Text>

          <TouchableOpacity
            style={styles.arrowButton}
            onPress={goToDriverLogin}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Footer Section ─────────────────────────────────── */}
      <View style={styles.footerSection}>
        <View style={styles.footerLine} />
        <Text style={styles.footerText}>Fleet Management & Oversight</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
    paddingTop: STATUS_BAR_HEIGHT,
  },

  // ─── Header Styles ───────────────────────────────────────────
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  appName: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: -0.5,
  },

  // ─── Welcome Section Styles ──────────────────────────────────
  welcomeSection: {
    alignItems: "center",
    marginTop: height * 0.04,
    marginBottom: height * 0.04,
    paddingHorizontal: 24,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.textDark,
    textAlign: "center",
  },
  welcomeTitleBold: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.textDark,
    textAlign: "center",
    marginTop: -2,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textGray,
    marginTop: 12,
    fontWeight: "500",
  },

  // ─── Cards Layout Styles ─────────────────────────────────────
  cardsContainer: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 20,
  },
  roleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    position: "relative",
    // Shadow details for Premium look
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)",
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 6,
  },
  roleDesc: {
    fontSize: 14,
    color: COLORS.textGray,
    fontWeight: "400",
    marginBottom: 12,
  },
  arrowButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },

  // ─── Footer Styles ───────────────────────────────────────────
  footerSection: {
    width: "100%",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  footerLine: {
    width: 60,
    height: 1.5,
    backgroundColor: "#D1D5DB",
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: "#8E939E",
    fontWeight: "500",
  },
});
