// ─── API Configuration ──────────────────────────────────────────
// Change this to your backend server IP/URL
// For local development:
//   - Android emulator: http://10.0.2.2:5000
//   - iOS simulator: http://localhost:5000
//   - Real device: Use your computer's local IP

import { Platform } from "react-native";

// Auto-detect API base URL based on platform
const getBaseUrl = () => {
  if (__DEV__) {
    // Development mode
    if (Platform.OS === "android") {
      return "http://10.0.2.2:5000"; // Android emulator
    }
    return "http://localhost:5000"; // iOS simulator / web
  }
  // Production - change to your deployed backend URL
  return "https://smartbustracker-api.onrender.com";
};

const API_BASE_URL = getBaseUrl();

// ─── Helper Functions ───────────────────────────────────────────
const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
};

const getAuthHeaders = () => {
  const headers = {};
  // Add auth token if available
  // const token = await AsyncStorage.getItem('authToken');
  // if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// ─── Driver API ─────────────────────────────────────────────────
export const driverAPI = {
  /**
   * Register a new driver
   * @param {Object} formData - Driver registration data
   * @param {string} formData.fullName
   * @param {string} formData.employeeId
   * @param {string} formData.phone
   * @param {string} formData.licenseNumber
   * @param {string} formData.experience
   * @param {File/Blob} licensePhoto - Optional license photo
   */
  register: async (formData, licensePhoto = null) => {
    try {
      const body = new FormData();

      // Append text fields
      Object.keys(formData).forEach((key) => {
        if (formData[key]) {
          body.append(key, formData[key]);
        }
      });

      // Append photo if exists
      if (licensePhoto) {
        body.append("licensePhoto", {
          uri: licensePhoto.uri,
          type: licensePhoto.type || "image/jpeg",
          name: licensePhoto.fileName || "license.jpg",
        });
      }

      const response = await fetch(`${API_BASE_URL}/api/driver/register`, {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
          ...getAuthHeaders(),
        },
        body,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error("Driver Register API Error:", error);
      throw error;
    }
  },

  /**
   * Check driver registration status
   * @param {string} id - Driver ID
   */
  getStatus: async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/driver/status/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      return await handleResponse(response);
    } catch (error) {
      console.error("Driver Status API Error:", error);
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════
  //  PRE-REGISTRATION & OTP-BASED REGISTRATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch all pending pre-registrations (for dropdown)
   */
  getPreRegistrations: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/driver/pre-registrations`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );
      return await handleResponse(response);
    } catch (error) {
      console.error("Get Pre-Registrations Error:", error);
      throw error;
    }
  },

  /**
   * Send OTP to pre-registered phone number
   */
  sendOtp: async (phone, registrationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/driver/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, registrationId }),
      });
      return await handleResponse(response);
    } catch (error) {
      console.error("Send OTP Error:", error);
      throw error;
    }
  },

  /**
   * Verify OTP & complete registration
   */
  verifyOtpAndRegister: async (data) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/driver/verify-otp-register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      return await handleResponse(response);
    } catch (error) {
      console.error("Verify OTP & Register Error:", error);
      throw error;
    }
  },

  /**
   * Verify OTP Only (standalone, used during registration step)
   * @param {string} phone - Phone number
   * @param {string} otp - 6-digit OTP code
   */
  verifyOtpOnly: async (phone, otp) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/driver/verify-otp-only`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, otp }),
        },
      );
      return await handleResponse(response);
    } catch (error) {
      console.error("Verify OTP Only Error:", error);
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════
  //  LOGIN APIs (Phone+OTP and EmployeeID+Password)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Send OTP for login (existing driver)
   * @param {string} phone - Driver's phone number
   */
  sendLoginOtp: async (phone) => {
    try {
      // Send as-is (e.g., 0712345678), backend will normalize to +94712345678
      const response = await fetch(
        `${API_BASE_URL}/api/driver/send-login-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phone.trim() }),
        },
      );
      return await handleResponse(response);
    } catch (error) {
      console.error("Send Login OTP Error:", error);
      throw error;
    }
  },

  /**
   * Login with phone + OTP
   * @param {string} phone - Driver's phone number
   * @param {string} otp - 6-digit OTP code
   */
  loginWithOtp: async (phone, otp) => {
    try {
      console.log("📤 Sending login request:", { phone, otp });
      const response = await fetch(`${API_BASE_URL}/api/driver/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      console.log("📥 Login response status:", response.status);
      return await handleResponse(response);
    } catch (error) {
      console.error("Login With OTP Error:", error);
      throw error;
    }
  },

  /**
   * Login with phone + OTP (with device info for debugging)
   * @param {string} phone - Driver's phone number
   * @param {string} otp - 6-digit OTP code
   * @param {Object} deviceInfo - Device information for debugging
   */
  loginWithOtpDebug: async (phone, otp, deviceInfo = {}) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/driver/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, deviceInfo }),
      });
      return await handleResponse(response);
    } catch (error) {
      console.error("Login With OTP Error:", error);
      throw error;
    }
  },

  /**
   * Login with Employee ID + Password (fallback)
   * @param {string} employeeId - Employee ID
   * @param {string} password - Password
   */
  login: async (employeeId, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/driver/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, password }),
      });
      return await handleResponse(response);
    } catch (error) {
      console.error("Driver Login Error:", error);
      throw error;
    }
  },
};

// ─── Passenger API ──────────────────────────────────────────────
export const passengerAPI = {
  register: async (data) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/passenger/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });

      return await handleResponse(response);
    } catch (error) {
      console.error("Passenger Register API Error:", error);
      throw error;
    }
  },
};

// ─── Health Check ───────────────────────────────────────────────
export const checkAPIHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Health Check Failed:", error);
    return { status: "error", message: "Backend server is not running" };
  }
};

export default API_BASE_URL;
