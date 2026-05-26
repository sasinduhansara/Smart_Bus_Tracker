import { useRouter } from "expo-router";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

export default function TripScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.circle1} />
      <View style={styles.circle2} />

      <View style={styles.content}>
        <Text style={styles.emoji}>🚌</Text>
        <Text style={styles.title}>Welcome Driver!</Text>
        <Text style={styles.subtitle}>
          රියදුරු පැනල් එකට සාදරයෙන් පිළිගනිමු
        </Text>
      </View>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => router.replace("/welcome")}
      >
        <Text style={styles.logoutText}>← Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1565C0",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: height * 0.08,
    paddingHorizontal: width * 0.06,
    overflow: "hidden",
  },
  circle1: {
    position: "absolute",
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: "#1976D2",
    top: -width * 0.3,
    right: -width * 0.2,
    opacity: 0.5,
  },
  circle2: {
    position: "absolute",
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: "#0D47A1",
    bottom: -width * 0.2,
    left: -width * 0.15,
    opacity: 0.5,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  emoji: {
    fontSize: width * 0.2,
  },
  title: {
    fontSize: width * 0.08,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: width * 0.04,
    color: "#90CAF9",
    textAlign: "center",
  },
  logoutBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: width * 0.04,
  },
});
