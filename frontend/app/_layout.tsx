import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect } from "react";
import {
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from "react-native";

// Prevent splash screen from hiding before fonts are ready
SplashScreen.preventAutoHideAsync();

const { width } = Dimensions.get("window");

/* ======================================================================
   COLOR CONSTANTS - Centralized colors for the entire app
   ====================================================================== */
export const COLORS = {
  primary: "#1565C0",
  primaryLight: "#1976D2",
  primaryDark: "#0D47A1",
  secondary: "#FFA000",
  secondaryDark: "#E65100",
  tertiary: "#2E7D32",
  tertiaryLight: "#4CAF50",
  neutral: "#121212",
  darkGray: "#4A4A4A",
  gray: "#666666",
  lightGray: "#D0D0D0",
  white: "#FFFFFF",
  bgLight: "#E3F2FD",
  bgWarm: "#FFF8E1",
  textLight: "#90CAF9",
  textWhite: "rgba(255,255,255,0.75)",
  overlayLight: "rgba(255,255,255,0.15)",
  overlayBorder: "rgba(255,255,255,0.3)",
  overlayBorderLight: "rgba(255,255,255,0.2)",
};

/* ======================================================================
   FONT SIZES - Consistent typography scale
   ====================================================================== */
export const FONT = {
  xs: width * 0.03,
  sm: width * 0.033,
  md: width * 0.036,
  lg: width * 0.042,
  xl: width * 0.05,
  title: width * 0.07,
  heading: width * 0.08,
  large: width * 0.1,
  hero: width * 0.12,
  logo: width * 0.18,
};

/* ======================================================================
   SPACING - Consistent spacing scale
   ====================================================================== */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  padH: width * 0.06,
};

/* ======================================================================
   SHARED STYLES - Reusable across all screens
   ====================================================================== */
export const sharedStyles = StyleSheet.create({
  screenBase: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Platform.OS === "ios" ? 60 : 48,
    paddingHorizontal: SPACING.padH,
    overflow: "hidden",
  },
  bgCircle1: {
    position: "absolute",
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: COLORS.primaryLight,
    top: -width * 0.3,
    right: -width * 0.2,
    opacity: 0.5,
  },
  bgCircle2: {
    position: "absolute",
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: COLORS.primaryDark,
    bottom: -width * 0.2,
    left: -width * 0.15,
    opacity: 0.5,
  },
  headerCenter: {
    alignItems: "center",
    width: "100%",
  },
  logoBox: {
    width: width * 0.22,
    height: width * 0.22,
    borderRadius: width * 0.06,
    backgroundColor: COLORS.overlayLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.overlayBorder,
  },
  logoEmoji: {
    fontSize: FONT.logo,
  },
  appTitle: {
    fontSize: FONT.heading,
    fontWeight: "800",
    color: COLORS.white,
    letterSpacing: 3,
  },
  screenTitle: {
    fontSize: FONT.title,
    fontWeight: "800",
    color: COLORS.white,
  },
  screenSubtitle: {
    fontSize: FONT.lg,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  tagline: {
    fontSize: FONT.sm,
    color: COLORS.textLight,
    fontStyle: "italic",
  },
  backBtn: {
    alignSelf: "flex-start",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: SPACING.md,
    backgroundColor: COLORS.overlayLight,
    marginBottom: SPACING.xl,
  },
  backBtnText: {
    color: COLORS.white,
    fontSize: FONT.md,
  },
  inputLabel: {
    color: COLORS.textLight,
    fontSize: FONT.sm,
    fontWeight: "600",
    marginLeft: SPACING.xs,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.overlayLight,
    borderRadius: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.overlayBorder,
    gap: SPACING.md,
  },
  inputIcon: {
    fontSize: FONT.xl,
  },
  inputField: {
    flex: 1,
    color: COLORS.white,
    fontSize: FONT.lg,
    fontWeight: "500",
  },
  eyeIcon: {
    fontSize: FONT.xl,
  },
  primaryBtn: {
    backgroundColor: COLORS.tertiaryLight,
    paddingVertical: 18,
    borderRadius: SPACING.lg,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: FONT.xl,
    fontWeight: "700",
  },
  secondaryBtn: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 18,
    borderRadius: SPACING.lg,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  secondaryBtnText: {
    color: COLORS.white,
    fontSize: FONT.xl,
    fontWeight: "700",
  },
  cardWhite: {
    backgroundColor: COLORS.white,
    borderRadius: SPACING.xl,
    padding: SPACING.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardWarm: {
    backgroundColor: COLORS.bgWarm,
    borderWidth: 2,
    borderColor: COLORS.secondary,
    borderRadius: SPACING.xl,
    padding: SPACING.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardArrow: {
    fontSize: 30,
    color: COLORS.primary,
    fontWeight: "300",
  },
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: SPACING.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.overlayBorderLight,
  },
  infoCardText: {
    color: COLORS.textLight,
    fontSize: FONT.sm,
    textAlign: "center",
    lineHeight: 20,
  },
  footerText: {
    color: COLORS.textLight,
    fontSize: FONT.xs,
  },
});

/* ======================================================================
   WEB OVERLAY CLEANUP
   ====================================================================== */
function WebOverlayCleanup() {
  useEffect(() => {
    if (Platform.OS === "web") {
      const t = setTimeout(() => {
        document.querySelectorAll('[aria-hidden="true"]').forEach((el) => {
          if ((el as HTMLElement).style.display === "none") el.remove();
        });
      }, 500);
      return () => clearTimeout(t);
    }
  }, []);
  return null;
}

/* ======================================================================
   ROOT LAYOUT
   ====================================================================== */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    FontAwesome5_Brands: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Brands.ttf"),
    FontAwesome5_Solid: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Solid.ttf"),
    FontAwesome5_Regular: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Regular.ttf"),
    AntDesign: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/AntDesign.ttf"),
    Ionicons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"),
    MaterialIcons: require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf"),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: COLORS.primary }}
      onLayout={onLayoutRootView}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <WebOverlayCleanup />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "none",
          animationDuration: 0,
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="index" options={{ orientation: "all" }} />
        <Stack.Screen name="language" options={{ orientation: "all" }} />
        <Stack.Screen name="onboarding" options={{ orientation: "all" }} />
        <Stack.Screen name="welcome" options={{ orientation: "all" }} />
        <Stack.Screen name="driver/login" options={{ orientation: "all" }} />
        <Stack.Screen name="driver/trip" options={{ orientation: "all" }} />
        <Stack.Screen name="passenger/login" options={{ orientation: "all" }} />
        <Stack.Screen name="passenger/home" options={{ orientation: "all" }} />
        <Stack.Screen name="passenger/map" options={{ orientation: "all" }} />
        <Stack.Screen
          name="passenger/search"
          options={{ orientation: "all" }}
        />
        <Stack.Screen name="passenger/alert" options={{ orientation: "all" }} />
        <Stack.Screen name="passenger/chat" options={{ orientation: "all" }} />
      </Stack>
    </SafeAreaView>
  );
}
