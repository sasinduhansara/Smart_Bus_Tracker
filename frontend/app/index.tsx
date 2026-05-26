import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

// ─── Color Constants ─────────────────────────────────────────────
const COLORS = {
  bgBlue: "#1E68C5", // background එ
  white: "#FFFFFF",
  lightBlue: "#5B96E4", // Loading spinner background
};

// ─── StatusBar Height ────────────────────────────────────────────
const STATUS_BAR_HEIGHT =
  Platform.OS === "ios" ? 44 : StatusBar.currentHeight || 24;

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      try {
        // Splash screen එක පේන්න තත්පර 3ක delay එකක්
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const lang = await AsyncStorage.getItem("language");
        const onboarded = await AsyncStorage.getItem("onboarded");

        if (lang && onboarded === "true") {
          router.replace("/welcome");
        } else if (lang) {
          router.replace("/onboarding");
        } else {
          router.replace("/language");
        }
      } catch (error) {
        console.error("Splash init error:", error);
        router.replace("/language");
      }
    };

    init();
  }, [router]);

  return (
    <View style={styles.container}>
      {/* ─── Main Content ───────────────────────────────────── */}
      <View style={styles.mainContent}>
        {/* App Icon Box */}
        <View style={styles.iconBox}>
          <FontAwesome5 name="bus" size={width * 0.13} color={COLORS.bgBlue} />
        </View>

        {/* App Name */}
        <Text style={styles.appName}>GamanaLK</Text>

        {/* Center Circular Loader */}
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF9F1C" />
        </View>
      </View>

      {/* ─── Bottom Section ─────────────────────────────────── */}
      <View style={styles.bottomSection}>
        {/* Connecting Text */}
        <Text style={styles.connectingText}>CONNECTING TO HUB...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgBlue,
    paddingTop: STATUS_BAR_HEIGHT,
  },

  // ─── Status Bar ──────────────────────────────────────────────
  statusBar: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  timeText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.white,
  },
  statusIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  signalBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    marginRight: 2,
  },
  signalBar: {
    width: 3,
    backgroundColor: COLORS.white,
    borderRadius: 0.5,
  },
  batteryOuter: {
    width: 22,
    height: 11,
    borderRadius: 2.5,
    borderWidth: 1,
    borderColor: COLORS.white,
    justifyContent: "center",
    paddingHorizontal: 1.5,
  },
  batteryInner: {
    width: "80%",
    height: 6,
    backgroundColor: COLORS.white,
    borderRadius: 0.5,
  },
  batteryNub: {
    position: "absolute",
    right: -3,
    width: 2,
    height: 4,
    backgroundColor: COLORS.white,
    borderTopRightRadius: 0.5,
    borderBottomRightRadius: 0.5,
  },

  // ─── Main Content ────────────────────────────────────────────
  mainContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: width * 0.24,
    height: width * 0.24,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  appName: {
    fontSize: 30,
    fontWeight: "700",
    color: COLORS.white,
    letterSpacing: 0.5,
    marginBottom: 40,
  },
  loaderContainer: {
    marginTop: 20,
  },

  // ─── Bottom Section ──────────────────────────────────────────
  bottomSection: {
    width: "100%",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 60 : 40,
  },
  connectingText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.white,
    letterSpacing: 2,
    opacity: 0.9,
  },
});
