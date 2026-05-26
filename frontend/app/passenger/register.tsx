import { Feather, Ionicons } from "@expo/vector-icons";
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
  linkBlue: "#0B4C8C",
};

const getApiUrl = () => {
  if (Platform.OS === "web") {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return "http://192.168.8.102:5000";
};

export default function PassengerRegisterScreen() {
  const router = useRouter();

  // Form States
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (
      !fullName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      Alert.alert("⚠️ Error", "Please fill all fields!");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("⚠️ Error", "Passwords do not match!");
      return;
    }

    if (!agreeTerms) {
      Alert.alert("⚠️ Error", "Please agree to the Terms and Conditions!");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${getApiUrl()}/api/passenger/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("✅ Success", "Account created successfully!");
        router.replace("/passenger/login");
      } else {
        Alert.alert(
          "❌ Registration Failed",
          data.message || "Something went wrong!",
        );
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
          onPress={() => router.replace("/passenger/login")}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ScrollView භාවිතයෙන් කුඩා Screen වලදී වුවද පහසුවෙන් Form එක පුරවා ඉහලට/පහලට යා හැක */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Main Title */}
          <Text style={styles.mainTitle}>Join GamanaLK</Text>
          <Text style={styles.subtitle}>
            Experience reliable and efficient transport for your daily commute.
          </Text>

          {/* ─── Form Fields ──────────────────────────────────── */}
          <View style={styles.form}>
            {/* Full Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={COLORS.textGray}
                />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={COLORS.placeholder}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={COLORS.textGray}
                />
                <TextInput
                  style={styles.input}
                  placeholder="john@example.com"
                  placeholderTextColor={COLORS.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Phone Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={COLORS.textGray}
                />
                <TextInput
                  style={styles.input}
                  placeholder="+94 77 123 4567"
                  placeholderTextColor={COLORS.placeholder}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
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
                  secureTextEntry
                />
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name="shield-outline"
                  size={20}
                  color={COLORS.textGray}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.placeholder}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {/* ─── Checkbox Terms & Conditions ─────────────────── */}
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}
                onPress={() => setAgreeTerms(!agreeTerms)}
                activeOpacity={0.7}
              >
                {agreeTerms && (
                  <Ionicons name="checkmark" size={14} color={COLORS.white} />
                )}
              </TouchableOpacity>

              <Text style={styles.checkboxLabel}>
                I agree to the{" "}
                <Text style={styles.linkText}>Terms and Conditions</Text> and
                the <Text style={styles.linkText}>Privacy Policy</Text>.
              </Text>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.signUpBtn, loading && styles.signUpBtnDisabled]}
              onPress={handleRegister}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <View style={styles.signUpBtnContent}>
                  <Text style={styles.signUpBtnText}>Sign Up</Text>
                  <Feather
                    name="arrow-right"
                    size={20}
                    color={COLORS.white}
                    style={{ marginLeft: 6 }}
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── Bottom Login Link ───────────────────────────── */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => router.replace("/passenger/login")}
              activeOpacity={0.7}
            >
              <Text style={styles.loginLink}>Login</Text>
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
    backgroundColor: COLORS.bgLight,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },

  // ─── Scroll & Card Layouts ────────────────────────────────────
  scrollContainer: {
    paddingBottom: 30,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: height * 0.02,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    // iOS and Android shadow features
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textDark,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },

  // ─── Form Inputs Layout ──────────────────────────────────────
  form: {
    width: "100%",
    gap: 14,
  },
  inputContainer: {
    gap: 5,
  },
  label: {
    color: COLORS.textDark,
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 2,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 8,
  },
  input: {
    flex: 1,
    color: COLORS.textDark,
    fontSize: 14,
    fontWeight: "500",
  },

  // ─── Checkbox Styles ─────────────────────────────────────────
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 6,
    paddingHorizontal: 2,
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.placeholder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    backgroundColor: COLORS.white,
  },
  checkboxChecked: {
    backgroundColor: COLORS.linkBlue,
    borderColor: COLORS.linkBlue,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textGray,
    lineHeight: 18,
  },
  linkText: {
    color: COLORS.linkBlue,
    fontWeight: "600",
  },

  // ─── Button Styles ───────────────────────────────────────────
  signUpBtn: {
    backgroundColor: COLORS.accentOrange,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  signUpBtnDisabled: {
    opacity: 0.7,
  },
  signUpBtnContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  signUpBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },

  // ─── Footer Login Link ──────────────────────────────────────
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  loginText: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
});
