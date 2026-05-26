import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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

const { width, height } = Dimensions.get("window");

// ─── Color Constants ─────────────────────────────────────────────
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
  dashedBorder: "#CBD5E1",
};

// ─── Steps Enum ──────────────────────────────────────────────────
const STEPS = {
  SELECT_BUS: 1,
  ENTER_DETAILS: 2,
  OTP_VERIFY: 3,
  UPLOAD_ID: 4,
  COMPLETE: 5,
};

export default function DriverRegisterScreen() {
  const router = useRouter();

  // ─── Registration Info (from Admin pre-registration) ────────
  const [preRegistrations, setPreRegistrations] = useState([]);
  const [availableBuses, setAvailableBuses] = useState([]);
  const [selectedReg, setSelectedReg] = useState(null);

  // ─── Form States ─────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(STEPS.SELECT_BUS);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ─── OTP States ──────────────────────────────────────────────
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  // ─── ID Photo Upload States ──────────────────────────────────
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scannedIdNumber, setScannedIdNumber] = useState("");

  // ─── UI States ───────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [showBusPicker, setShowBusPicker] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // ─── Get filtered buses list for modal ─────────────────────
  const getFilteredBuses = () => {
    return preRegistrations.filter(
      (reg) =>
        !searchQuery ||
        reg.busNumber?.toUpperCase().includes(searchQuery.toUpperCase()) ||
        reg.routeNumber?.includes(searchQuery) ||
        reg.fullName?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  };

  // ─── Search state for bus picker ────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Fetch Pre-Registered Buses on Mount ─────────────────────
  useEffect(() => {
    fetchPreRegistrations();
  }, []);

  const fetchPreRegistrations = async () => {
    try {
      const res = await driverAPI.getPreRegistrations();
      const data = res.data || [];
      setPreRegistrations(data);
      setAvailableBuses(data);
    } catch (error) {
      console.error("Error fetching pre-registrations:", error);
      Alert.alert(
        "⚠️ Connection Error",
        "Cannot fetch registered buses. Please check your connection or contact Admin.",
      );
    }
  };

  // ─── Step 1: Select Bus from Admin Pre-Registered List ───────
  const handleSelectBus = (reg) => {
    setSelectedReg(reg);
    setFullName(reg.fullName || "");
    setShowBusPicker(false);
    setCurrentStep(STEPS.ENTER_DETAILS);
  };

  // ─── Step 2: Enter Name, Email, Password ─────────────────────
  const handleProceedToOtp = () => {
    if (!fullName.trim()) {
      Alert.alert("⚠️ Error", "Please enter your full name!");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("⚠️ Error", "Please enter a valid email address!");
      return;
    }
    if (password.length < 6) {
      Alert.alert("⚠️ Error", "Password must be at least 6 characters!");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("⚠️ Error", "Passwords do not match!");
      return;
    }

    setCurrentStep(STEPS.OTP_VERIFY);
    sendOtpCode();
  };

  // ─── Step 3: Send OTP to Pre-Registered Phone ───────────────
  const sendOtpCode = async () => {
    if (!selectedReg) return;
    setIsLoading(true);

    try {
      const res = await driverAPI.sendOtp(selectedReg.phone, selectedReg.id);
      setOtpSent(true);
      setOtpTimer(300); // 5 min countdown
      Alert.alert(
        "📱 OTP Sent!",
        `Please check your phone (${selectedReg.phone}).\n\nDEV: Your OTP is: ${res.data?.otp || "check console"}`,
      );
    } catch (error) {
      Alert.alert(
        "❌ OTP Failed",
        error.message || "Failed to send OTP. Contact Admin.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 3: Verify OTP ────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length < 6) {
      Alert.alert("⚠️ Error", "Please enter the 6-digit OTP code!");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      // Verify OTP with server before proceeding to photo upload
      const res = await driverAPI.verifyOtpOnly(selectedReg.phone, otp);
      if (res.success) {
        setCurrentStep(STEPS.UPLOAD_ID);
      } else {
        Alert.alert("❌ Invalid OTP", res.message || "OTP verification failed");
      }
    } catch (error) {
      if (error.message?.includes("expired")) {
        Alert.alert(
          "⏰ OTP Expired",
          "Your OTP has expired. Please request a new one.",
        );
      } else {
        Alert.alert(
          "❌ Invalid OTP",
          error.message || "OTP verification failed. Please try again.",
        );
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ─── Step 4: Handle ID Photo Upload ──────────────────────────
  const handlePickIdFront = () => {
    Alert.alert("📸 Upload ID Front", "Image picker will open here.");
    // TODO: Implement image picker
    // For demo, we'll simulate with a placeholder
    setIdFront({ uri: "placeholder_front" });
    simulateAutoScan();
  };

  const handlePickIdBack = () => {
    Alert.alert("📸 Upload ID Back", "Image picker will open here.");
    setIdBack({ uri: "placeholder_back" });
  };

  const simulateAutoScan = () => {
    setScanning(true);
    // Simulate OCR scanning
    setTimeout(() => {
      const simId =
        selectedReg?.nic || selectedReg?.licenseNumber || "200045600123";
      setScannedIdNumber(simId);
      setScanning(false);
      Alert.alert("✅ ID Scanned", `Detected ID Number: ${simId}`);
    }, 2000);
  };

  // ─── Step 5: Complete Registration ──────────────────────────
  const handleCompleteRegistration = async () => {
    if (!idFront || !idBack) {
      Alert.alert("⚠️ Error", "Please upload both front and back of your ID!");
      return;
    }
    if (!scannedIdNumber) {
      Alert.alert("⚠️ Error", "ID could not be scanned. Please try again.");
      return;
    }

    setIsRegistering(true);
    try {
      const res = await driverAPI.verifyOtpAndRegister({
        registrationId: selectedReg.id,
        phone: selectedReg.phone,
        otp: otp,
        email: email.trim().toLowerCase(),
        password: password,
        idPhotoFront: idFront.uri,
        idPhotoBack: idBack.uri,
        scannedIdNumber: scannedIdNumber,
      });

      setCurrentStep(STEPS.COMPLETE);

      Alert.alert(
        "🎉 Registration Complete!",
        `Welcome ${res.data?.fullName || fullName.split(" ")[0]}!\n\nYour Employee ID: ${res.data?.employeeId || "DRV-****"}\nBus: ${selectedReg.busNumber} (Route ${selectedReg.routeNumber})\n\nPlease login to start your trips.`,
        [
          {
            text: "Go to Login",
            onPress: () => router.replace("/driver/login"),
          },
        ],
      );
    } catch (error) {
      const msg = error.message || "Something went wrong. Please try again.";
      if (msg.includes("Email is already registered")) {
        Alert.alert(
          "📧 Email Already Exists",
          "This email is already registered. Please use a different email or go to Login.",
          [
            { text: "Use Different Email", style: "default" },
            {
              text: "Go to Login",
              onPress: () => router.replace("/driver/login"),
              style: "default",
            },
          ],
        );
      } else if (msg.includes("ID_MISMATCH")) {
        Alert.alert(
          "🪪 ID Mismatch",
          "The scanned ID does not match our records. Contact your Admin.",
        );
      } else {
        Alert.alert("❌ Registration Failed", msg);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  // ─── Go Back to Previous Step ──────────────────────────────
  const handleGoBack = () => {
    if (currentStep > STEPS.SELECT_BUS) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  // ─── Render Steps ───────────────────────────────────────────
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[
        STEPS.SELECT_BUS,
        STEPS.ENTER_DETAILS,
        STEPS.OTP_VERIFY,
        STEPS.UPLOAD_ID,
      ].map((step, index) => (
        <View key={step} style={styles.stepRow}>
          <View
            style={[
              styles.stepDot,
              currentStep >= step && styles.stepDotActive,
              currentStep === step && styles.stepDotCurrent,
            ]}
          >
            <Text
              style={[
                styles.stepNumber,
                currentStep >= step && styles.stepNumberActive,
              ]}
            >
              {index + 1}
            </Text>
          </View>
          {index < 3 && (
            <View
              style={[
                styles.stepLine,
                currentStep > step && styles.stepLineActive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  // ─── Main Render ────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgLight} />

      {/* ─── Header ────────────────────────────────────────── */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Registration</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ─── Step Progress ─────────────────────────────────── */}
      {currentStep < STEPS.COMPLETE && renderStepIndicator()}

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════════
            STEP 1: SELECT BUS FROM PRE-REGISTERED LIST
            ══════════════════════════════════════════════════════ */}
        {currentStep === STEPS.SELECT_BUS && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="bus-outline" size={22} color={COLORS.primary} />
                <Text style={styles.cardTitle}>Select Your Bus</Text>
              </View>

              <Text style={styles.cardDescription}>
                Choose the bus that your Admin has pre-registered for you. If
                you don't see your bus, contact the Admin.
              </Text>

              {availableBuses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={48}
                    color={COLORS.placeholder}
                  />
                  <Text style={styles.emptyTitle}>No Buses Available</Text>
                  <Text style={styles.emptyText}>
                    Your Admin hasn't registered any buses yet. Please contact
                    your bus station Admin.
                  </Text>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={fetchPreRegistrations}
                  >
                    <Ionicons name="refresh" size={18} color={COLORS.white} />
                    <Text style={styles.retryBtnText}>Refresh</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Bus List */}
                  <TouchableOpacity
                    style={styles.busPickerButton}
                    onPress={() => setShowBusPicker(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.busPickerLeft}>
                      <Ionicons
                        name="search-outline"
                        size={20}
                        color={COLORS.textGray}
                      />
                      <Text
                        style={[
                          styles.busPickerText,
                          selectedReg && styles.busPickerTextSelected,
                        ]}
                      >
                        {selectedReg
                          ? `${selectedReg.busNumber} (Route ${selectedReg.routeNumber})`
                          : "Search & select your bus..."}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={COLORS.textGray}
                    />
                  </TouchableOpacity>

                  {/* Selected Info */}
                  {selectedReg && (
                    <View style={styles.selectedInfo}>
                      <View style={styles.selectedInfoRow}>
                        <Text style={styles.selectedInfoLabel}>Bus</Text>
                        <Text style={styles.selectedInfoValue}>
                          {selectedReg.busNumber}
                        </Text>
                      </View>
                      <View style={styles.selectedInfoRow}>
                        <Text style={styles.selectedInfoLabel}>Route</Text>
                        <Text style={styles.selectedInfoValue}>
                          Route {selectedReg.routeNumber}
                        </Text>
                      </View>
                      <View style={styles.selectedInfoRow}>
                        <Text style={styles.selectedInfoLabel}>Phone</Text>
                        <Text style={styles.selectedInfoValue}>
                          {selectedReg.phone}
                        </Text>
                      </View>
                      <View style={styles.selectedInfoRow}>
                        <Text style={styles.selectedInfoLabel}>
                          NIC/License
                        </Text>
                        <Text style={styles.selectedInfoValue}>
                          {selectedReg.nic || selectedReg.licenseNumber || "—"}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Info Notice */}
            <View style={styles.alertBox}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={COLORS.textGray}
                style={styles.alertIcon}
              />
              <Text style={styles.alertText}>
                Only buses pre-registered by your Admin are shown. This ensures
                only authorized drivers can register for specific buses.
              </Text>
            </View>

            {/* Next Button */}
            <View style={styles.bottomContainer}>
              <TouchableOpacity
                style={[styles.submitBtn, !selectedReg && { opacity: 0.5 }]}
                onPress={() => selectedReg && handleSelectBus(selectedReg)}
                activeOpacity={0.85}
                disabled={!selectedReg}
              >
                <Text style={styles.submitBtnText}>Continue →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 2: ENTER NAME, EMAIL, PASSWORD
            ══════════════════════════════════════════════════════ */}
        {currentStep === STEPS.ENTER_DETAILS && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons
                  name="card-account-details-outline"
                  size={22}
                  color={COLORS.primary}
                />
                <Text style={styles.cardTitle}>Your Details</Text>
              </View>

              <View style={styles.form}>
                {/* Full Name (Auto-filled from pre-registration) */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Your full name"
                    placeholderTextColor={COLORS.placeholder}
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>

                {/* Bus & Route (Read-only) */}
                {selectedReg && (
                  <View style={styles.roFields}>
                    <View style={styles.roField}>
                      <Text style={styles.roLabel}>Bus Number</Text>
                      <Text style={styles.roValue}>
                        {selectedReg.busNumber}
                      </Text>
                    </View>
                    <View style={styles.roField}>
                      <Text style={styles.roLabel}>Route Number</Text>
                      <Text style={styles.roValue}>
                        {selectedReg.routeNumber}
                      </Text>
                    </View>
                    <View style={styles.roField}>
                      <Text style={styles.roLabel}>NIC/License</Text>
                      <Text style={styles.roValue}>
                        {selectedReg.nic || selectedReg.licenseNumber || "—"}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Email */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                {/* Password */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Min. 6 characters"
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

                {/* Confirm Password */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter password"
                    placeholderTextColor={COLORS.placeholder}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              </View>
            </View>

            {/* Next Button */}
            <View style={styles.bottomContainer}>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleProceedToOtp}
                activeOpacity={0.85}
              >
                <Text style={styles.submitBtnText}>Send OTP →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 3: OTP VERIFICATION
            ══════════════════════════════════════════════════════ */}
        {currentStep === STEPS.OTP_VERIFY && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={22}
                  color={COLORS.primary}
                />
                <Text style={styles.cardTitle}>Verify OTP</Text>
              </View>

              <Text style={styles.cardDescription}>
                We sent a 6-digit OTP to your registered phone number{" "}
                <Text style={{ fontWeight: "700" }}>{selectedReg?.phone}</Text>.
                Enter it below to proceed.
              </Text>

              {/* OTP Input */}
              <TextInput
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

              {/* Resend */}
              <TouchableOpacity
                style={styles.resendLink}
                onPress={sendOtpCode}
                disabled={isLoading}
              >
                <Text style={styles.resendText}>
                  {isLoading ? "Resending..." : "Resend OTP"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Next Button */}
            <View style={styles.bottomContainer}>
              <TouchableOpacity
                style={[styles.submitBtn, otp.length < 6 && { opacity: 0.5 }]}
                onPress={handleVerifyOtp}
                activeOpacity={0.85}
                disabled={otp.length < 6 || isVerifyingOtp}
              >
                {isVerifyingOtp ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Verify OTP →</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 4: UPLOAD ID PHOTOS
            ══════════════════════════════════════════════════════ */}
        {currentStep === STEPS.UPLOAD_ID && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons
                  name="id-card-outline"
                  size={22}
                  color={COLORS.primary}
                />
                <Text style={styles.cardTitle}>Upload Your ID</Text>
              </View>

              <Text style={styles.cardDescription}>
                Upload both front and back of your National ID Card or Driving
                License. The ID will be auto-scanned and cross-checked with
                Admin records.
              </Text>

              {/* ID Front */}
              <View style={styles.photoSection}>
                <Text style={styles.photoLabel}>Front Side</Text>
                <TouchableOpacity
                  style={[
                    styles.photoUpload,
                    idFront && styles.photoUploadDone,
                  ]}
                  onPress={handlePickIdFront}
                  activeOpacity={0.7}
                >
                  {idFront ? (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={28}
                        color={COLORS.primary}
                      />
                      <Text style={styles.photoUploadText}>
                        Front Uploaded ✓
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="camera-outline"
                        size={28}
                        color={COLORS.textGray}
                      />
                      <Text style={styles.photoUploadPlaceholder}>
                        Tap to upload front
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* ID Back */}
              <View style={styles.photoSection}>
                <Text style={styles.photoLabel}>Back Side</Text>
                <TouchableOpacity
                  style={[styles.photoUpload, idBack && styles.photoUploadDone]}
                  onPress={handlePickIdBack}
                  activeOpacity={0.7}
                >
                  {idBack ? (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={28}
                        color={COLORS.primary}
                      />
                      <Text style={styles.photoUploadText}>
                        Back Uploaded ✓
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="camera-outline"
                        size={28}
                        color={COLORS.textGray}
                      />
                      <Text style={styles.photoUploadPlaceholder}>
                        Tap to upload back
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Scanning Indicator */}
              {scanning && (
                <View style={styles.scanningContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.scanningText}>
                    Auto-scanning ID Number...
                  </Text>
                </View>
              )}

              {/* Scanned ID Result */}
              {scannedIdNumber ? (
                <View style={styles.scannedResult}>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.scannedResultText}>
                    Detected ID: {scannedIdNumber}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Next Button */}
            <View style={styles.bottomContainer}>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!idFront || !idBack || !scannedIdNumber) && { opacity: 0.5 },
                ]}
                onPress={handleCompleteRegistration}
                activeOpacity={0.85}
                disabled={
                  !idFront || !idBack || !scannedIdNumber || isRegistering
                }
              >
                {isRegistering ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    Complete Registration ✓
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 5: COMPLETE / SUCCESS
            ══════════════════════════════════════════════════════ */}
        {currentStep === STEPS.COMPLETE && (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Ionicons
                name="checkmark-circle"
                size={72}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.successTitle}>Registration Complete!</Text>
            <Text style={styles.successSubtitle}>
              Your account has been created successfully.
            </Text>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => router.replace("/driver/login")}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>Go to Login →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════
          BUS PICKER MODAL
          ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={showBusPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBusPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Your Bus</Text>
              <TouchableOpacity
                onPress={() => setShowBusPicker(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <Ionicons
                name="search-outline"
                size={20}
                color={COLORS.textGray}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by bus number, route..."
                placeholderTextColor={COLORS.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={COLORS.textGray}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Bus List */}
            <FlatList
              data={getFilteredBuses()}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.busItem,
                    selectedReg?.id === item.id && styles.busItemSelected,
                  ]}
                  onPress={() => handleSelectBus(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.busItemLeft}>
                    <View style={styles.busItemIcon}>
                      <Ionicons name="bus" size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.busItemInfo}>
                      <Text style={styles.busItemBusNumber}>
                        {item.busNumber}
                      </Text>
                      <Text style={styles.busItemRoute}>
                        Route {item.routeNumber}
                      </Text>
                      <Text style={styles.busItemDriver}>{item.fullName}</Text>
                    </View>
                  </View>
                  {selectedReg?.id === item.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListText}>
                    {searchQuery
                      ? "No buses match your search"
                      : "No buses available"}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ══════════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  scrollContainer: {
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
  },
  stepDotCurrent: {
    borderWidth: 3,
    borderColor: COLORS.accentOrange,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textGray,
  },
  stepNumberActive: {
    color: COLORS.white,
  },
  stepLine: {
    width: 40,
    height: 3,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: 4,
    borderRadius: 2,
  },
  stepLineActive: {
    backgroundColor: COLORS.primary,
  },
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
    marginLeft: 10,
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.textGray,
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textGray,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  retryBtnText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },
  busPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: COLORS.bgLight,
  },
  busPickerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  busPickerText: {
    fontSize: 15,
    color: COLORS.placeholder,
    flex: 1,
  },
  busPickerTextSelected: {
    color: COLORS.textDark,
    fontWeight: "600",
  },
  selectedInfo: {
    marginTop: 16,
    backgroundColor: COLORS.bgLight,
    borderRadius: 12,
    padding: 14,
  },
  selectedInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  selectedInfoLabel: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  selectedInfoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  alertBox: {
    flexDirection: "row",
    backgroundColor: COLORS.alertBg,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    alignItems: "flex-start",
  },
  alertIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  alertText: {
    fontSize: 13,
    color: COLORS.textGray,
    lineHeight: 18,
    flex: 1,
  },
  bottomContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  form: {
    gap: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 6,
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
  eyeBtn: {
    paddingHorizontal: 12,
  },
  roFields: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  roField: {
    flex: 1,
    backgroundColor: COLORS.alertBg,
    borderRadius: 10,
    padding: 12,
  },
  roLabel: {
    fontSize: 12,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  roValue: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textDark,
  },
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
  resendLink: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 8,
  },
  resendText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  photoSection: {
    marginBottom: 16,
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  photoUpload: {
    borderWidth: 2,
    borderColor: COLORS.dashedBorder,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgLight,
  },
  photoUploadDone: {
    borderColor: COLORS.primary,
    borderStyle: "solid",
    backgroundColor: "#EEF2FF",
  },
  photoUploadText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 6,
  },
  photoUploadPlaceholder: {
    fontSize: 14,
    color: COLORS.placeholder,
    marginTop: 6,
  },
  scanningContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  scanningText: {
    fontSize: 14,
    color: COLORS.textGray,
    marginTop: 10,
  },
  scannedResult: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginTop: 8,
  },
  scannedResultText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    flex: 1,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.textDark,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 15,
    color: COLORS.textGray,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
  },
  // ─── Modal ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.75,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgLight,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: COLORS.bgLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textDark,
  },
  modalList: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  busItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    borderRadius: 12,
    marginBottom: 4,
  },
  busItemSelected: {
    backgroundColor: "#EEF2FF",
  },
  busItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  busItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  busItemInfo: {
    flex: 1,
  },
  busItemBusNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  busItemRoute: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
    marginTop: 2,
  },
  busItemDriver: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 2,
  },
  emptyList: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyListText: {
    fontSize: 14,
    color: COLORS.textGray,
  },
});
