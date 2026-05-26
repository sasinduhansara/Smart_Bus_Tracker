import { AntDesign, FontAwesome5, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { height } = Dimensions.get("window");

// ─── Color Constants ─────────────────────────────────────────────
const COLORS = {
  bgLight: "#F8F9FA",
  primary: "#0B4C8C",
  accentOrange: "#F2A12E",
  white: "#FFFFFF",
  textDark: "#111827",
  textGray: "#4B5563",
  borderLight: "#E5E7EB",
  inputBg: "#F3F4F6",
  placeholder: "#9CA3AF",
};

const getApiUrl = () => {
  if (Platform.OS === "web") {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return "http://192.168.8.102:5000";
};

export default function PassengerLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("⚠️ Error", "Please fill all fields!");
      return;
    }

    setLoading(true);
    try {
      console.log("📤 Sending login with:", email.trim(), password.trim());
      const response = await fetch(`${getApiUrl()}/api/passenger/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();
      console.log("📥 Response:", response.status, data);

      if (response.ok) {
        router.replace("/passenger/home");
      } else {
        Alert.alert("❌ Login Failed", data.message || "Invalid credentials!");
      }
    } catch {
      Alert.alert(
        "❌ Connection Error",
        "Cannot connect to server. Check connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgLight} />

      {/* ─── Header Section ─────────────────────────────────── */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          onPress={() => router.replace("/welcome")}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Passenger Login</Text>
        <View style={{ width: 24 }} />
        {/* Alignment center කරන්න spacer */}
      </View>

      {/* ─── Scrollable Content ─────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Center Card Area ───────────────────────────────── */}
        <View style={styles.card}>
          {/* Blue Bus-alt Logo */}
          <View style={styles.logoCircle}>
            <FontAwesome5 name="bus-alt" size={32} color={COLORS.white} />
          </View>

          {/* Welcome Text */}
          <Text style={styles.welcomeText}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to start your journey with GamanaLK
          </Text>

          {/* ─── Form Inputs ──────────────────────────────────── */}
          <View style={styles.form}>
            {/* Email / Phone Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email or Phone</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={COLORS.textGray}
                />
                <TextInput
                  style={styles.input}
                  placeholder="driver@gamanalk.com"
                  placeholderTextColor={COLORS.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputBox}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={COLORS.textGray}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={COLORS.textGray}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <View style={styles.loginBtnContent}>
                  <Text style={styles.loginBtnText}>Login</Text>
                  <Ionicons
                    name="log-in-outline"
                    size={22}
                    color={COLORS.white}
                    style={{ marginLeft: 6 }}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* ─── Or Connect With Divider ─────────────────────── */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONNECT WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Logins */}
            <View style={styles.socialContainer}>
              {/* Google */}
              <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
                <AntDesign name="google" size={18} color="#EA4335" />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>

              {/* Apple */}
              <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
                <FontAwesome5 name="apple" size={18} color={COLORS.textDark} />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── Bottom Sign Up Link ───────────────────────────── */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don&apos;t have an account? </Text>
            <TouchableOpacity
              onPress={() => router.push("/passenger/register")}
              activeOpacity={0.7}
            >
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
    paddingTop: Platform.OS === "ios" ? 44 : StatusBar.currentHeight || 24,
  },

  // ─── Header Styles ───────────────────────────────────────────
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },

  // ─── Scroll Container ────────────────────────────────────────
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30,
  },

  // ─── Card Canvas Styles ──────────────────────────────────────
  card: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: height * 0.03,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    // Soft shadow
    boxShadow: "0px 4px 10px rgba(11, 76, 140, 0.15)",
    elevation: 4,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.textDark,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
    paddingHorizontal: 10,
  },

  // ─── Form & Input Layouts ────────────────────────────────────
  form: {
    width: "100%",
    gap: 18,
  },
  inputContainer: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: COLORS.textDark,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 2,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 54,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 10,
  },
  input: {
    flex: 1,
    color: COLORS.textDark,
    fontSize: 15,
    fontWeight: "500",
  },

  // ─── Action Buttons ──────────────────────────────────────────
  loginBtn: {
    backgroundColor: COLORS.accentOrange,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
  },

  // ─── Dividers & Social Connects ──────────────────────────────
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.placeholder,
    paddingHorizontal: 10,
    letterSpacing: 0.5,
  },
  socialContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
    gap: 8,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
  },

  // ─── Footer Link Styles ──────────────────────────────────────
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: height * 0.05,
    paddingBottom: 20,
  },
  signUpText: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
});
