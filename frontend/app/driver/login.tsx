import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { driverAPI } from "../../services/api";

const COLORS = {
  bgLight: "#F8F9FA",
  primary: "#0B4C8C",
  accentOrange: "#F2A12E",
  white: "#FFFFFF",
  textDark: "#111827",
  textGray: "#4B5563",
  borderLight: "#E5E7EB",
  placeholder: "#9CA3AF",
  alertBg: "#F3F4F6",
};

export default function DriverLoginScreen() {
  const router = useRouter();

  // ─── States ──────────────────────────────────────────────────
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [isLoading, setIsLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [showEmpLogin, setShowEmpLogin] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const otpRef = useRef(null);
  const isVerifyingRef = useRef(false); // 🔒 Extra guard against double-click

  // Timer for OTP countdown
  useEffect(() => {
    let interval;
    if (otpTimer > 0) {
      interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  // ─── Helper: Normalize phone to +94 format ─────────────────
  const normalizePhone = (raw) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("0")) return "+94" + trimmed.substring(1); // 0771234567 → +94771234567
    if (trimmed.startsWith("+94")) return trimmed; // +94771234567 → +94771234567
    return "+94" + trimmed; // 771234567 → +94771234567
  };

  // ─── Step 1: Send OTP to Phone ──────────────────────────────
  const handleSendOtp = async () => {
    const rawPhone = phone.trim();
    // User sees +94 prefix, so they type 9 digits (e.g. 771234567)
    if (!rawPhone || rawPhone.length < 9) {
      Alert.alert(" Error", "Please enter a valid phone number!");
      return;
    }

    setIsLoading(true);
    try {
      const cleanPhone = normalizePhone(rawPhone);
      const res = await driverAPI.sendLoginOtp(cleanPhone);
      setOtp("");
      setOtpTimer(300); // 5 min
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 300);
      Alert.alert(
        "📱 OTP Sent!",
        `A 6-digit OTP has been sent to your phone.
Valid for 5 minutes.`,
      );
    } catch (error) {
      Alert.alert(" Failed", error.message || "Could not send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 2: Verify OTP & Login ─────────────────────────────
  const handleVerifyOtp = async () => {
    // 🔒 Guard: prevent double-click / race condition (using ref for instant check)
    if (isVerifyingRef.current || isLoading) {
      console.log(" handleVerifyOtp skipped - already verifying");
      return;
    }
    isVerifyingRef.current = true;

    const cleanOtp = otp.trim();
    const rawPhone = phone.trim();
    // Use the SAME normalizePhone() helper for consistency
    const normalizedPhone = normalizePhone(rawPhone);

    // ← Debug logs
    console.log("📱 Raw phone from state:", rawPhone);
    console.log("📱 Normalized phone sent:", normalizedPhone);
    console.log(" OTP sent:", cleanOtp);

    if (!cleanOtp || cleanOtp.length < 6) {
      isVerifyingRef.current = false;
      Alert.alert(" Error", "Please enter the 6-digit OTP!");
      return;
    }

    setIsLoading(true);
    try {
      const res = await driverAPI.loginWithOtp(normalizedPhone, cleanOtp);
      const { token, driver } = res;

      if (token) {
        await AsyncStorage.setItem("authToken", token);
        await AsyncStorage.setItem("driver", JSON.stringify(driver));
        // Don't show alert - just navigate immediately
        router.replace("/driver/dashboard");
      } else {
        Alert.alert(" Login Failed", "No token received. Please try again.");
      }
    } catch (error) {
      console.log("🔍 Login Error Details:", error.message);
      // Only show error if we haven't already navigated away
      if (!error.message?.includes("navigation")) {
        if (error.message?.includes("No driver found")) {
          Alert.alert(
            " Not Found",
            "No driver registered with this phone number. Please register first.",
          );
        } else if (error.message?.includes("expired")) {
          Alert.alert(
            " OTP Expired",
            "Your OTP has expired. Please request a new one.",
          );
        } else if (error.message?.includes("Invalid or expired")) {
          Alert.alert(
            " Invalid OTP",
            "The OTP you entered is invalid or expired. Please try again.",
          );
        } else {
          Alert.alert(
            " Login Failed",
            error.message || "Invalid OTP. Please try again.",
          );
        }
      }
    } finally {
      setIsLoading(false);
      isVerifyingRef.current = false;
    }
  };

  // ─── Employee ID + Password Login ───────────────────────────
  const handleEmpLogin = async () => {
    if (!employeeId.trim() || !password.trim()) {
      Alert.alert(" Error", "Please enter Employee ID and password!");
      return;
    }

    setIsLoading(true);
    try {
      const res = await driverAPI.login(employeeId.trim(), password);
      const { token, driver } = res;

      if (token) {
        await AsyncStorage.setItem("authToken", token);
        await AsyncStorage.setItem("driver", JSON.stringify(driver));
        Alert.alert(" Welcome!", `Hello ${driver.fullName}!`, [
          {
            text: "Go to Dashboard",
            onPress: () => router.replace("/driver/dashboard"),
          },
        ]);
      }
    } catch (error) {
      Alert.alert("❌ Login Failed", error.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgLight} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Header */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="bus" size={40} color={COLORS.white} />
          </View>
          <Text style={styles.appName}>GamanaLK</Text>
          <Text style={styles.subtitle}>Driver Login</Text>
        </View>

        {/* ─── Phone + OTP Login ───────────────────────────── */}
        {!showEmpLogin && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="phone-portrait-outline"
                size={22}
                color={COLORS.primary}
              />
              <Text style={styles.cardTitle}>
                {step === "otp" ? "Enter OTP" : "Login with Phone"}
              </Text>
            </View>

            {step === "phone" ? (
              <>
                <Text style={styles.description}>
                  Enter your registered phone number. We'll send a 6-digit OTP.
                </Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Phone Number</Text>
                  <View style={styles.phoneInputRow}>
                    <Text style={styles.phonePrefix}>+94</Text>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="77 XXX XXXX"
                      placeholderTextColor={COLORS.placeholder}
                      keyboardType="phone-pad"
                      maxLength={9}
                      value={phone}
                      onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ""))}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    phone.length < 9 && { opacity: 0.5 },
                  ]}
                  onPress={handleSendOtp}
                  activeOpacity={0.85}
                  disabled={phone.length < 9 || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.submitBtnText}>Send OTP →</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.description}>
                  Enter the 6-digit OTP sent to {phone}
                </Text>
                <TextInput
                  ref={otpRef}
                  style={styles.otpInput}
                  placeholder="------"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, ""))}
                />
                {otpTimer > 0 && (
                  <Text style={styles.timerText}>
                    OTP expires in {Math.floor(otpTimer / 60)}:
                    {(otpTimer % 60).toString().padStart(2, "0")}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.resendLink}
                  onPress={handleSendOtp}
                  disabled={isLoading}
                >
                  <Text style={styles.resendText}>
                    {isLoading ? "Resending..." : "Resend OTP"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, otp.length < 6 && { opacity: 0.5 }]}
                  onPress={handleVerifyOtp}
                  activeOpacity={0.85}
                  disabled={otp.length < 6 || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.submitBtnText}>Verify & Login ✓</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => setStep("phone")}
                >
                  <Ionicons
                    name="arrow-back"
                    size={16}
                    color={COLORS.textGray}
                  />
                  <Text style={styles.backText}> Change phone number</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ─── Employee ID + Password Login (Alternative) ──── */}
        {showEmpLogin && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons
                name="card-account-details-outline"
                size={22}
                color={COLORS.primary}
              />
              <Text style={styles.cardTitle}>Employee Login</Text>
            </View>
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Employee ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. DRV-0001"
                  placeholderTextColor={COLORS.placeholder}
                  autoCapitalize="characters"
                  value={employeeId}
                  onChangeText={setEmployeeId}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter password"
                    placeholderTextColor={COLORS.placeholder}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showPassword ? "eye-outline" : "eye-off-outline"}
                      size={20}
                      color={COLORS.textGray}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!employeeId.trim() || !password.trim()) && { opacity: 0.5 },
              ]}
              onPress={handleEmpLogin}
              activeOpacity={0.85}
              disabled={!employeeId.trim() || !password.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.submitBtnText}>Login →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Toggle between login methods ───────────────── */}
        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => {
            setShowEmpLogin(!showEmpLogin);
            setStep("phone");
            setOtp("");
          }}
        >
          <Ionicons
            name={showEmpLogin ? "phone-portrait-outline" : "card-outline"}
            size={18}
            color={COLORS.primary}
          />
          <Text style={styles.toggleText}>
            {showEmpLogin
              ? " Login with Phone & OTP"
              : " Login with Employee ID"}
          </Text>
        </TouchableOpacity>

        {/* ─── New Driver? Register ──────────────────────── */}
        <View style={styles.registerRow}>
          <Text style={styles.registerText}>New driver? </Text>
          <TouchableOpacity onPress={() => router.push("/driver/register")}>
            <Text style={styles.registerLink}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgLight },
  scrollContainer: { paddingBottom: 40, paddingHorizontal: 20 },
  logoContainer: {
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 80 : 50,
    paddingBottom: 30,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  appName: { fontSize: 28, fontWeight: "800", color: COLORS.textDark },
  subtitle: { fontSize: 15, color: COLORS.textGray, marginTop: 4 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
    marginLeft: 10,
  },
  description: {
    fontSize: 14,
    color: COLORS.textGray,
    lineHeight: 20,
    marginBottom: 16,
  },
  inputContainer: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 6,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  phonePrefix: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    paddingLeft: 14,
    paddingRight: 6,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textDark,
    paddingVertical: 14,
    paddingRight: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textDark,
    backgroundColor: COLORS.white,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textDark,
  },
  eyeBtn: { paddingHorizontal: 12 },
  otpInput: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    fontSize: 30,
    fontWeight: "700",
    color: COLORS.textDark,
    textAlign: "center",
    letterSpacing: 10,
    backgroundColor: COLORS.white,
    marginBottom: 12,
  },
  timerText: {
    textAlign: "center",
    fontSize: 14,
    color: COLORS.accentOrange,
    fontWeight: "600",
    marginBottom: 8,
  },
  resendLink: { alignItems: "center", paddingVertical: 8, marginBottom: 8 },
  resendText: { color: COLORS.primary, fontSize: 14, fontWeight: "600" },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  backText: { color: COLORS.textGray, fontSize: 14 },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingVertical: 12,
  },
  toggleText: { color: COLORS.primary, fontSize: 14, fontWeight: "600" },
  form: { gap: 4 },
  registerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    paddingBottom: 20,
  },
  registerText: { fontSize: 14, color: COLORS.textGray },
  registerLink: { fontSize: 14, color: COLORS.primary, fontWeight: "700" },
});
