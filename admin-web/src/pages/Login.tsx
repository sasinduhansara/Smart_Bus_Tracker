import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@gamanalak.com");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await adminAPI.login(email, password);
      const { token, admin } = res.data.data;
      localStorage.setItem("adminToken", token);
      localStorage.setItem("adminUser", JSON.stringify(admin));
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.mainContainer}>
      {/* මුළු Screen එක පුරාම යන Background Dot Pattern එක */}
      <div style={styles.bgPatternOverlay} />

      <div style={styles.centerContentArea}>
        {/* ─── BRAND HEADER ───────────────────────────────── */}
        <div style={styles.headerSection}>
          <div style={styles.logoWrapper}>
            <svg
              width="42"
              height="42"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="24" height="24" rx="6" fill="#00468C" />
              <path
                d="M17 14.5V7C17 5.5 15.5 4 14 4H10C8.5 4 7 5.5 7 7V14.5C7 15.5 7.5 16.5 8.5 17L7.5 18.5H9L10 17H14l1 1.5h1.5l-1-1.5c1-.5 1.5-1.5 1.5-2.5ZM10 6h4v2h-4V6Zm-1.5 7.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1Zm7 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1ZM15.5 10h-7V9h7v1Z"
                fill="white"
              />
            </svg>
          </div>
          <h1 style={styles.mainTitle}>GamanaLK</h1>
          <p style={styles.subTitle}>Admin Portal</p>
        </div>

        {/* ─── LOGIN CARD ──────────────────────────────────── */}
        <div style={styles.authCard}>
          {error && <div style={styles.errorAlert}>Login failed</div>}

          <form onSubmit={handleLogin} style={styles.formLayout}>
            {/* Username / Email */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Username / Email</label>
              <div style={styles.inputIconWrapper}>
                <span style={styles.inputIcon}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9CA3AF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  style={styles.formInput}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gamanalak.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div style={styles.fieldGroup}>
              <div style={styles.passwordLabelRow}>
                <label style={styles.fieldLabel}>Password</label>
                <a href="#forgot" style={styles.forgotPasswordLink}>
                  Forgot Password?
                </a>
              </div>
              <div style={styles.inputIconWrapper}>
                <span style={styles.inputIcon}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9CA3AF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="3"
                      y="11"
                      width="18"
                      height="11"
                      rx="2"
                      ry="2"
                    ></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  style={styles.formInput}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.togglePasswordBtn}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9CA3AF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>

            {/* Action Submit Button */}
            <button
              style={{
                ...styles.loginSubmitBtn,
                ...(loading ? styles.btnDisabled : {}),
              }}
              type="submit"
              disabled={loading}
            >
              <span>{loading ? "Logging in..." : "Login"}</span>
              <svg
                style={{ marginLeft: "6px" }}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </form>

          {/* Support Section */}
          <div style={styles.dividerComponent}>
            <div style={styles.lineElement} />
            <span style={styles.lineLabel}>SYSTEM SUPPORT</span>
            <div style={styles.lineElement} />
          </div>

          <button type="button" style={styles.itDeskBtn}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#374151"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span style={styles.itDeskBtnText}>Contact IT Desk</span>
          </button>
        </div>

        {/* ─── SECURITY BANNER ──────────────────────────────── */}
        <div style={styles.securityWarningBox}>
          <svg
            style={{ flexShrink: 0 }}
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#856404"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span style={styles.securityText}>
            Secure administrative environment. All activities are logged for
            auditing purposes.
          </span>
        </div>

        {/* ─── FOOTER METADATA ──────────────────────────────── */}
        <div style={styles.footerContainer}>
          <p style={styles.copyRight}>© 2024 GamanaLK. All rights reserved.</p>
          <p style={styles.systemVersion}>System Version v1.2.0</p>
        </div>
      </div>
    </div>
  );
}

// ─── STYLES (DESKTOP FULL-SCREEN FIX WITH NO SCROLLBARS) ─────────────────
const styles: Record<string, React.CSSProperties> = {
  mainContainer: {
    width: "100vw", // Browser එකේ මුළු පළලම ගන්නවා (දෙපැත්තේ තීරු නැති වෙන්න)
    height: "100vh", // Viewport උස 100% ක්ම ගන්නවා
    position: "fixed", // Screen එකටම Lock කරලා තියෙන්නේ
    top: 0,
    left: 0,
    display: "flex",
    alignItems: "center", // Vertical මැදට ගන්නවා
    justifyContent: "center", // Horizontal මැදට ගන්නවා
    backgroundColor: "#F3F4F6", // Light gray background එක මුළු screen එකටම වැදෙනවා
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: "border-box",
    overflow: "hidden", // Scrollbars සේරම block කළා
  },
  bgPatternOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundImage: `radial-gradient(#E5E7EB 1.2px, transparent 1.2px)`,
    backgroundSize: "24px 24px",
    opacity: 0.8,
    zIndex: 1,
  },
  centerContentArea: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: "385px", // Card එක සහ අනිත් දේවල් නියමිත සයිස් එකට තියාගන්නවා
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "0 20px",
    boxSizing: "border-box",
  },

  // Header Styles
  headerSection: {
    textAlign: "center",
    marginBottom: "18px",
  },
  logoWrapper: {
    display: "inline-flex",
    marginBottom: "8px",
  },
  mainTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#00468C",
    margin: 0,
  },
  subTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#4B5563",
    margin: "2px 0 0 0",
  },

  // Form Card Styles
  authCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
    padding: "26px 26px",
    width: "100%",
    boxSizing: "border-box",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
  },
  errorAlert: {
    backgroundColor: "#FEE2E2",
    color: "#DC2626",
    padding: "10px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
    marginBottom: "16px",
    textAlign: "center",
    border: "1px solid #FCA5A5",
  },
  formLayout: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    textAlign: "left",
  },
  passwordLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  fieldLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
  },
  forgotPasswordLink: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#00468C",
    textDecoration: "none",
  },
  inputIconWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "12px",
    display: "flex",
    alignItems: "center",
  },
  formInput: {
    width: "100%",
    padding: "10px 12px 10px 38px",
    fontSize: "14px",
    color: "#1F2937",
    backgroundColor: "#FFFFFF",
    borderRadius: "6px",
    border: "1px solid #D1D5DB",
    boxSizing: "border-box",
    outline: "none",
  },
  togglePasswordBtn: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    padding: 0,
  },
  loginSubmitBtn: {
    backgroundColor: "#00468C",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "6px",
    padding: "11px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "4px",
  },
  btnDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },

  // Divider
  dividerComponent: {
    display: "flex",
    alignItems: "center",
    margin: "20px 0 14px 0",
  },
  lineElement: {
    flex: 1,
    height: "1px",
    backgroundColor: "#E5E7EB",
  },
  lineLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#9CA3AF",
    padding: "0 8px",
    letterSpacing: "0.5px",
  },
  itDeskBtn: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    border: "1px solid #D1D5DB",
    borderRadius: "6px",
    padding: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  itDeskBtnText: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
  },

  // Security Warning
  securityWarningBox: {
    backgroundColor: "#FCF8E3",
    border: "1px solid #FBEED5",
    borderRadius: "6px",
    padding: "10px 14px",
    marginTop: "14px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textAlign: "left",
    boxSizing: "border-box",
    width: "100%",
  },
  securityText: {
    fontSize: "11px",
    color: "#856404",
    fontWeight: "600",
    lineHeight: "1.4",
  },

  // Footer Metadata
  footerContainer: {
    textAlign: "center",
    marginTop: "18px",
  },
  copyRight: {
    fontSize: "11px",
    color: "#6B7280",
    fontWeight: "500",
    margin: 0,
  },
  systemVersion: {
    fontSize: "10px",
    color: "#9CA3AF",
    margin: "2px 0 0 0",
  },
};
