import { useState } from "react";
import AdminLayout from "../components/AdminLayout";

export default function AdminSettings() {
  const [showGMapKey, setShowGMapKey] = useState(false);
  const [showFirebaseKey, setShowFirebaseKey] = useState(false);
  const [pushNotif, setPushNotif] = useState(true);
  const [smsAlert, setSmsAlert] = useState(true);
  const [emailRep, setEmailRep] = useState(false);

  return (
    <AdminLayout
      title="Admin Settings"
      navbarRightContent={
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <span style={{ fontSize: "18px", cursor: "pointer" }}>🔔</span>
          <span style={{ fontSize: "18px", cursor: "pointer" }}>❓</span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ textAlign: "right" }}>
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#1E293B",
                  margin: 0,
                }}
              >
                Gamana Admin
              </p>
              <p
                style={{
                  fontSize: "11px",
                  color: "#64748B",
                  margin: 0,
                }}
              >
                Super User
              </p>
            </div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "#CBD5E1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              👨‍💻
            </div>
          </div>
        </div>
      }
    >
      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          width: "100%",
          boxSizing: "border-box",
          paddingBottom: "100px",
        }}
      >
        {/* FIRST ROW — System Settings + Alert Toggles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "20px",
          }}
        >
          {/* System Settings */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "20px",
                  backgroundColor: "#DBEAFE",
                  padding: "6px",
                  borderRadius: "8px",
                }}
              >
                ⚙
              </span>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#1E293B",
                  }}
                >
                  System Settings
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "#64748B",
                  }}
                >
                  Global platform configurations
                </p>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: "6px",
                  }}
                >
                  Application Name
                </label>
                <input
                  type="text"
                  defaultValue="GamanaLK"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#1E293B",
                    boxSizing: "border-box",
                    backgroundColor: "#F8FAFC",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: "6px",
                  }}
                >
                  Admin Email Contact
                </label>
                <input
                  type="email"
                  defaultValue="support@gamanalk.com"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#1E293B",
                    boxSizing: "border-box",
                    backgroundColor: "#F8FAFC",
                  }}
                />
              </div>
            </div>
            {/* Brand Logo */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "6px",
                }}
              >
                Brand Logo Preview
              </label>
              <div
                style={{
                  border: "1px dashed #CBD5E1",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "#FFFFFF",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#0056B3",
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "18px",
                    }}
                  >
                    🚌
                  </div>
                  <div>
                    <strong
                      style={{
                        fontSize: "16px",
                        color: "#0056B3",
                        display: "block",
                      }}
                    >
                      GamanaLK
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      System Branding • 200x50px PNG or SVG recommended
                    </span>
                  </div>
                </div>
                <button
                  style={{
                    backgroundColor: "#00468C",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Replace Logo
                </button>
              </div>
            </div>
          </div>

          {/* Alert Notifications */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "20px",
                  backgroundColor: "#FEF3C7",
                  padding: "6px",
                  borderRadius: "8px",
                }}
              >
                🔔
              </span>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#1E293B",
                  }}
                >
                  Alert Notifications
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "#64748B",
                  }}
                >
                  Manage automated alerts
                </p>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {[
                {
                  title: "Push Notifications",
                  desc: "Real-time driver alerts",
                  state: pushNotif,
                  toggle: () => setPushNotif(!pushNotif),
                },
                {
                  title: "SMS Alerts",
                  desc: "Critical system failures",
                  state: smsAlert,
                  toggle: () => setSmsAlert(!smsAlert),
                },
                {
                  title: "Email Reports",
                  desc: "Daily operational summaries",
                  state: emailRep,
                  toggle: () => setEmailRep(!emailRep),
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom:
                      idx !== 2 ? "1px solid #F1F5F9" : "none",
                    paddingBottom: idx !== 2 ? "12px" : "0",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        fontSize: "13.5px",
                        color: "#1E293B",
                        display: "block",
                      }}
                    >
                      {item.title}
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      {item.desc}
                    </span>
                  </div>
                  <label
                    style={{
                      position: "relative",
                      display: "inline-block",
                      width: "44px",
                      height: "24px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.state}
                      onChange={item.toggle}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: item.state ? "#0056B3" : "#CBD5E1",
                        borderRadius: "24px",
                        transition: "0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          height: "18px",
                          width: "18px",
                          left: item.state ? "23px" : "3px",
                          bottom: "3px",
                          backgroundColor: "white",
                          borderRadius: "50%",
                          transition: "0.2s",
                        }}
                      />
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECOND ROW — User Management + API Integrations */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "20px",
          }}
        >
          {/* User Management */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "20px",
                    backgroundColor: "#DCFCE7",
                    padding: "6px",
                    borderRadius: "8px",
                  }}
                >
                  👥
                </span>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: "700",
                      color: "#1E293B",
                    }}
                  >
                    User Management
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: "#64748B",
                    }}
                  >
                    Active administrative accounts
                  </p>
                </div>
              </div>
              <button
                style={{
                  backgroundColor: "#DBEAFE",
                  color: "#0056B3",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Add Admin
              </button>
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: "12px",
              }}
            >
              <thead>
                <tr>
                  {["Name", "Role", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        backgroundColor: "#F1F5F9",
                        color: "#475569",
                        fontSize: "13px",
                        fontWeight: 700,
                        padding: "12px 16px",
                        textAlign: h === "Actions" ? "right" : "left",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { initials: "RK", name: "Ruwan Kumara", email: "ruwan.k@gamanalk.lk", role: "SUPER ADMIN", roleBg: "#DCFCE7", roleColor: "#16A34A" },
                  { initials: "SP", name: "Sithum Perera", email: "sithum.p@gamanalk.lk", role: "FLEET MANAGER", roleBg: "#E2E8F0", roleColor: "#475569" },
                ].map((u, i) => (
                  <tr key={i}>
                    <td
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid #F1F5F9",
                        fontSize: "13.5px",
                        color: "#1E293B",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            backgroundColor: i === 0 ? "#0056B3" : "#F59E0B",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          {u.initials}
                        </div>
                        <div>
                          <strong>{u.name}</strong>
                          <span
                            style={{
                              display: "block",
                              fontSize: "11px",
                              color: "#64748B",
                            }}
                          >
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid #F1F5F9",
                        fontSize: "13.5px",
                        color: "#1E293B",
                      }}
                    >
                      <span
                        style={{
                          backgroundColor: u.roleBg,
                          color: u.roleColor,
                          fontSize: "9px",
                          fontWeight: 800,
                          padding: "4px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid #F1F5F9",
                        fontSize: "13.5px",
                        color: "#1E293B",
                        textAlign: "right",
                        cursor: "pointer",
                        color: "#64748B",
                      }}
                    >
                      ✏
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* API & Integrations */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "20px",
                  backgroundColor: "#FEE2E2",
                  padding: "6px",
                  borderRadius: "8px",
                }}
              >
                🧩
              </span>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    fontWeight: "700",
                    color: "#1E293B",
                  }}
                >
                  API & Integrations
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "#64748B",
                  }}
                >
                  External service connectivity
                </p>
              </div>
            </div>

            {/* Google Maps API Key */}
            <div style={{ position: "relative" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "6px",
                }}
              >
                Google Maps API Key
              </label>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <input
                  type={showGMapKey ? "text" : "password"}
                  defaultValue="AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6"
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 14px",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#1E293B",
                    boxSizing: "border-box",
                    backgroundColor: "#F8FAFC",
                    fontFamily: showGMapKey ? "inherit" : "monospace",
                  }}
                />
                <span
                  onClick={() => setShowGMapKey(!showGMapKey)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#64748B",
                  }}
                >
                  {showGMapKey ? "👁️" : "🙈"}
                </span>
              </div>
            </div>

            {/* Firebase Key */}
            <div style={{ position: "relative" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "6px",
                }}
              >
                Firebase Messaging Key
              </label>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <input
                  type={showFirebaseKey ? "text" : "password"}
                  defaultValue="AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6"
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 14px",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#1E293B",
                    boxSizing: "border-box",
                    backgroundColor: "#F8FAFC",
                    fontFamily: showFirebaseKey ? "inherit" : "monospace",
                  }}
                />
                <span
                  onClick={() => setShowFirebaseKey(!showFirebaseKey)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#64748B",
                  }}
                >
                  {showFirebaseKey ? "👁️" : "🙈"}
                </span>
              </div>
            </div>

            <button
              style={{
                width: "100%",
                backgroundColor: "white",
                color: "#0056B3",
                border: "1px solid #0056B3",
                padding: "10px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                marginTop: "4px",
              }}
            >
              🔄 Test Connections
            </button>
          </div>
        </div>

        {/* ─── Sticky Action Footer ─── */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            right: 0,
            width: "calc(100vw - 240px)",
            height: "72px",
            background: "#FFFFFF",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 24px",
            gap: "12px",
            boxSizing: "border-box",
            zIndex: 100,
          }}
        >
          <button
            style={{
              backgroundColor: "#F1F5F9",
              color: "#475569",
              border: "1px solid #CBD5E1",
              padding: "10px 20px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Discard Changes
          </button>
          <button
            style={{
              backgroundColor: "#00468C",
              color: "white",
              border: "none",
              padding: "10px 24px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,70,140,0.2)",
            }}
          >
            Save System Settings
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
