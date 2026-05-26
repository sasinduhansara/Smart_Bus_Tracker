import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

export default function LanguageScreen() {
  const router = useRouter();

  const selectLanguage = async (lang: string) => {
    await AsyncStorage.setItem("language", lang);
    router.replace("/onboarding");
  };

  return (
    <View style={styles.container}>
      <View style={styles.circle1} />
      <View style={styles.circle2} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.emoji}>🌐</Text>
        <Text style={styles.title}>භාෂාව තෝරන්න</Text>
        <Text style={styles.subtitle}>Select Your Language</Text>
      </View>

      {/* Language Buttons */}
      <View style={styles.buttonContainer}>
        {/* Sinhala */}
        <TouchableOpacity
          style={styles.langBtn}
          onPress={() => selectLanguage("si")}
          activeOpacity={0.85}
        >
          <View style={styles.btnLeft}>
            <Text style={styles.flagEmoji}>🇱🇰</Text>
            <View>
              <Text style={styles.langName}>සිංහල</Text>
              <Text style={styles.langSub}>Sinhala</Text>
            </View>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {/* Tamil */}
        <TouchableOpacity
          style={[styles.langBtn, styles.langBtnTamil]}
          onPress={() => selectLanguage("ta")}
          activeOpacity={0.85}
        >
          <View style={styles.btnLeft}>
            <Text style={styles.flagEmoji}>🇱🇰</Text>
            <View>
              <Text style={[styles.langName, styles.langNameTamil]}>தமிழ்</Text>
              <Text style={[styles.langSub, styles.langSubTamil]}>Tamil</Text>
            </View>
          </View>
          <Text style={[styles.arrow, styles.arrowTamil]}>›</Text>
        </TouchableOpacity>

        {/* English */}
        <TouchableOpacity
          style={[styles.langBtn, styles.langBtnOutline]}
          onPress={() => selectLanguage("en")}
          activeOpacity={0.85}
        >
          <View style={styles.btnLeft}>
            <Text style={styles.flagEmoji}>🇬🇧</Text>
            <View>
              <Text style={[styles.langName, styles.langNameWhite]}>
                English
              </Text>
              <Text style={[styles.langSub, styles.langSubWhite]}>
                ඉංග්‍රීසි / தமிழ்
              </Text>
            </View>
          </View>
          <Text style={[styles.arrow, styles.arrowWhite]}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>GamanaLK © 2024</Text>
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
  },
  circle2: {
    position: "absolute",
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: "#0D47A1",
    bottom: -width * 0.2,
    left: -width * 0.15,
  },
  header: {
    alignItems: "center",
    marginTop: height * 0.05,
  },
  emoji: {
    fontSize: width * 0.18,
    marginBottom: 16,
  },
  title: {
    fontSize: width * 0.08,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: width * 0.045,
    color: "#90CAF9",
    marginTop: 8,
  },
  buttonContainer: {
    width: "100%",
    gap: 16,
  },
  langBtn: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  langBtnTamil: {
    backgroundColor: "#FFF8E1",
    borderWidth: 2,
    borderColor: "#FFA000",
  },
  langBtnOutline: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  btnLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  flagEmoji: {
    fontSize: width * 0.1,
  },
  langName: {
    fontSize: width * 0.055,
    fontWeight: "700",
    color: "#1565C0",
  },
  langNameTamil: {
    color: "#E65100",
  },
  langNameWhite: {
    color: "#FFFFFF",
  },
  langSub: {
    fontSize: width * 0.033,
    color: "#666",
    marginTop: 2,
  },
  langSubTamil: {
    color: "#FFA000",
  },
  langSubWhite: {
    color: "#90CAF9",
  },
  arrow: {
    fontSize: 30,
    color: "#1565C0",
    fontWeight: "bold",
  },
  arrowTamil: {
    color: "#E65100",
  },
  arrowWhite: {
    color: "#FFFFFF",
  },
  footer: {
    color: "#90CAF9",
    fontSize: width * 0.03,
  },
});
