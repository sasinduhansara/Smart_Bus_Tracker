import { useState } from "react";
import AdminLayout from "../components/AdminLayout";

export default function SystemAlerts() {
  const [activeTab, setActiveTab] = useState("All (24)");

  return (
    <AdminLayout
      title="System Alerts & Notifications"
      showSearch
      searchPlaceholder="Search alerts, bus IDs, or routes..."
    >
      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* ─── Header & Tabs ─── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "800",
                color: "#1E293B",
                margin: "0 0 4px 0",
              }}
            >
              System Alerts & Notifications
            </h2>
            <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
              Monitor and resolve real-time operational issues across the fleet.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              background: "#E2E8F0",
              padding: "4px",
              borderRadius: "8px",
              gap: "4px",
            }}
          >
            {["All (24)", "Unresolved (8)", "Critical (3)"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  transition: "all 0.2s ease",
                  backgroundColor:
                    activeTab === tab ? "#FFFFFF" : "transparent",
                  color: activeTab === tab ? "#1E293B" : "#64748B",
                  boxShadow:
                    activeTab === tab
                      ? "0 1px 3px rgba(0,0,0,0.1)"
                      : "none",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 🛑 1. CRITICAL BANNER — Bus Breakdown */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            display: "flex",
            overflow: "hidden",
            minHeight: "220px",
            flexDirection: "row",
          }}
        >
          {/* Red Side Block */}
          <div
            style={{
              backgroundColor: "#BA1A1A",
              width: "100px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              color: "white",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "28px" }}>🚨</span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "800",
                letterSpacing: "1px",
              }}
            >
              CRITICAL
            </span>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "18px",
                    fontWeight: "800",
                    color: "#BA1A1A",
                  }}
                >
                  Bus Breakdown: WP NB-4521
                </h3>
                <span
                  style={{ fontSize: "12px", color: "#64748B", fontWeight: "500" }}
                >
                  2 mins ago
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#475569",
                  lineHeight: "1.5",
                }}
              >
                Mechanical failure reported on Route 138 (Maharagama - Pettah). Bus
                is currently stationary near Town Hall junction. 42 passengers
                affected.
              </p>
            </div>

            {/* Badges */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {["Route 138", "WP NB-4521", "Loc: 6.9189, 79.8624"].map(
                (badge) => (
                  <span
                    key={badge}
                    style={{
                      background: "#F1F5F9",
                      color: "#475569",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {badge}
                  </span>
                )
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", paddingTop: "8px", flexWrap: "wrap" }}>
              <button
                style={{
                  backgroundColor: "#00468C",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Dispatch Backup
              </button>
              <button
                style={{
                  backgroundColor: "#FFFFFF",
                  color: "#00468C",
                  border: "1px solid #E2E8F0",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                View Details
              </button>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748B",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontWeight: 600,
                }}
              >
                <span>✔</span> Mark as Resolved
              </button>
            </div>
          </div>

          {/* Right Map Preview */}
          <div
            style={{
              width: "240px",
              backgroundColor: "#1E293B",
              borderLeft: "1px solid #E2E8F0",
              position: "relative",
              flexShrink: 0,
              display: "flex",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.15,
                backgroundImage:
                  "radial-gradient(#FFFFFF 1px, transparent 1px)",
                backgroundSize: "10px 10px",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                backgroundColor: "rgba(255,255,255,0.95)",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                maxWidth: "200px",
              }}
            >
              <strong
                style={{
                  fontSize: "11px",
                  color: "#00468C",
                  display: "block",
                }}
              >
                Incident Area
              </strong>
              <span style={{ fontSize: "10px", color: "#64748B" }}>
                Cinnamon Gardens, Col 07. Proximity to 3 active backup buses.
              </span>
            </div>
            <div
              style={{
                position: "absolute",
                top: "65%",
                left: "55%",
                width: "12px",
                height: "12px",
                backgroundColor: "#BA1A1A",
                borderRadius: "50%",
                boxShadow: "0 0 0 6px rgba(186,26,26,0.3)",
              }}
            />
          </div>
        </div>

        {/* ⚠️ 2. SECONDARY GRID — Warning & Info */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
          }}
        >
          {/* Route Deviation */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderLeft: "4px solid #D97706",
              borderRadius: "14px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      backgroundColor: "#FEF3C7",
                      padding: "6px",
                      borderRadius: "6px",
                      fontSize: "16px",
                    }}
                  >
                    🔄
                  </span>
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#1E293B",
                      }}
                    >
                      Route Deviation
                    </h4>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#D97706",
                        fontWeight: "800",
                      }}
                    >
                      WARNING
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                  15 mins ago
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#475569",
                  lineHeight: "1.5",
                }}
              >
                Bus WP GA-9980 (Route 122) has deviated from the assigned path by
                1.2km near Kottawa. GPS path shows unofficial shortcut.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                style={{
                  backgroundColor: "#78350F",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Contact Driver
              </button>
              <button
                style={{
                  backgroundColor: "white",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Details
              </button>
            </div>
          </div>

          {/* Delay Alert */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderLeft: "4px solid #2563EB",
              borderRadius: "14px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      backgroundColor: "#DBEAFE",
                      padding: "6px",
                      borderRadius: "6px",
                      fontSize: "16px",
                    }}
                  >
                    🕒
                  </span>
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#1E293B",
                      }}
                    >
                      Delay Alert
                    </h4>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#2563EB",
                        fontWeight: "800",
                      }}
                    >
                      INFO
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                  28 mins ago
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#475569",
                  lineHeight: "1.5",
                }}
              >
                Expected +15 min delay for all services arriving at Kandy Clock
                Tower due to local parade. ETA updates pushed to passenger app.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                style={{
                  backgroundColor: "#E2E8F0",
                  color: "#475569",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>
              <button
                style={{
                  backgroundColor: "white",
                  color: "#2563EB",
                  border: "1px solid #3B82F6",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Broadcast Update
              </button>
            </div>
          </div>
        </div>

        {/* ⚙️ 3. Cloud Sync Delay Bar */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flex: 1,
              minWidth: "200px",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                backgroundColor: "#F1F5F9",
                padding: "8px",
                borderRadius: "8px",
              }}
            >
              ⚙
            </span>
            <div>
              <h4
                style={{
                  margin: "0 0 2px 0",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#1E293B",
                }}
              >
                System Alert: Cloud Sync Delay
              </h4>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                Database synchronization with the Matara hub is currently
                experiencing high latency (250ms). Telemetry data may be delayed
                by up to 30 seconds.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <button
              style={{
                backgroundColor: "white",
                color: "#475569",
                border: "1px solid #CBD5E1",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              View Logs
            </button>
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
              Acknowledge
            </button>
          </div>
        </div>

        {/* 📊 4. Bottom KPIs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
          }}
        >
          {/* Resolved Recently */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minHeight: "140px",
            }}
          >
            <h4
              style={{
                margin: "0 0 12px 0",
                fontSize: "13px",
                fontWeight: 700,
                color: "#1E293B",
              }}
            >
              Resolved Recently
            </h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "#16A34A" }}>✔</span>
                <div>
                  <strong>Speeding: NB-9002</strong>
                  <br />
                  <span style={{ fontSize: "10px", color: "#64748B" }}>
                    Resolved by Supervisor A. Siriwardena
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ color: "#16A34A" }}>✔</span>
                <div>
                  <strong>Fuel Alert: GA-1123</strong>
                  <br />
                  <span style={{ fontSize: "10px", color: "#64748B" }}>
                    Station stop confirmed by driver
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Avg Response */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              padding: "20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minHeight: "140px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                color: "#64748B",
                fontWeight: 700,
                letterSpacing: "0.5px",
              }}
            >
              AVERAGE RESPONSE
            </span>
            <p
              style={{
                margin: "4px 0",
                fontSize: "32px",
                fontWeight: 800,
                color: "#00468C",
              }}
            >
              4.2m
            </p>
            <span style={{ fontSize: "11px", color: "#16A34A" }}>
              📉 12% from yesterday
            </span>
          </div>

          {/* Critical Ratio */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              padding: "20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minHeight: "140px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                color: "#64748B",
                fontWeight: 700,
                letterSpacing: "0.5px",
              }}
            >
              CRITICAL RATIO
            </span>
            <p
              style={{
                margin: "4px 0",
                fontSize: "32px",
                fontWeight: 800,
                color: "#DC2626",
              }}
            >
              1:12
            </p>
            <span style={{ fontSize: "11px", color: "#64748B" }}>
              Alerts per fleet unit
            </span>
          </div>

          {/* Resolved Today */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              padding: "20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minHeight: "140px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                color: "#64748B",
                fontWeight: 700,
                letterSpacing: "0.5px",
              }}
            >
              RESOLVED TODAY
            </span>
            <p
              style={{
                margin: "4px 0",
                fontSize: "32px",
                fontWeight: 800,
                color: "#16A34A",
              }}
            >
              118
            </p>
            <span style={{ fontSize: "11px", color: "#16A34A" }}>
              92% resolution rate
            </span>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
