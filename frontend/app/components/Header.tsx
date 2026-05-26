import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  primary: "#0B4C8C",
  white: "#FFFFFF",
  textDark: "#111827",
  borderLight: "#E5E7EB",
  bgLight: "#F8F9FA",
};

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showMenu?: boolean;
  showGlobe?: boolean;
  backgroundColor?: string;
}

export default function Header({
  title = "BusTrack LK",
  showBack = false,
  showMenu = false,
  showGlobe = false,
  backgroundColor = COLORS.bgLight,
}: HeaderProps) {
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Left Side */}
      <View style={styles.leftSection}>
        {showBack ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        ) : showMenu ? (
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={26} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {/* Center Title */}
      <View style={styles.centerSection}>
        <Ionicons name="bus" size={20} color={COLORS.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>

      {/* Right Side */}
      <View style={styles.rightSection}>
        {showGlobe ? (
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="globe-outline" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
  },
  leftSection: {
    width: 40,
    alignItems: "flex-start",
  },
  centerSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rightSection: {
    width: 40,
    alignItems: "flex-end",
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
});
