import { useState } from "react";
import AdminLayout from "../components/AdminLayout";

interface ActiveBus {
  id: string;
  route: string;
  speed: string;
  status: string;
  lastUpdate: string;
  statusColor: string;
  statusBg: string;
}

const activeFleet: ActiveBus[] = [
  {
    id: "NB-4022",
    route: "Route 138 - Colombo",
    speed: "42 km/h",
    status: "ON TIME",
    lastUpdate: "2 min ago",
    statusColor: "#22C55E",
    statusBg: "#DCFCE7",
  },
  {
    id: "LY-8821",
    route: "Route 177 - Kaduwela",
    speed: "15 km/h",
    status: "DELAYED",
    lastUpdate: "Just now",
    statusColor: "#D97706",
    statusBg: "#FEF3C7",
  },
  {
    id: "WP-1109",
    route: "Route 120 - Piliyandala",
    speed: "55 km/h",
    status: "ON TIME",
    lastUpdate: "5 min ago",
    statusColor: "#22C55E",
    statusBg: "#DCFCE7",
  },
];

const busMarkers = [
  { id: "NB-4022", top: "25%", left: "75%", borderColor: "#0056B3" },
  { id: "LY-8821", top: "60%", left: "55%", borderColor: "#D97706" },
  { id: "WP-1109", top: "65%", left: "80%", borderColor: "#0056B3" },
];

export default function LiveTracking() {
  const [selectedBus, setSelectedBus] = useState("LY-8821");

  return (
    <AdminLayout
      title="Live Tracking"
      showSearch
      searchPlaceholder="Search by bus ID or driver..."
      navbarRightContent={
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            style={{
              backgroundColor: "#00468C",
              color: "white",
              border: "none",
              padding: "10px 16px",
              borderRadius: "8px",
              fontWeight: "700",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            All Buses
          </button>
          <button
            style={{
              backgroundColor: "#FFFFFF",
              color: "#475569",
              border: "1px solid #E2E8F0",
              padding: "10px 16px",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            By Route 🔽
          </button>
          <button
            style={{
              backgroundColor: "#FFFFFF",
              color: "#475569",
              border: "1px solid #E2E8F0",
              padding: "10px 16px",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            By Status 🔽
          </button>
        </div>
      }
    >
      {/* 🗺️ Map Viewport */}
      <div
        style={{
          flex: 1,
          width: "100%",
          position: "relative",
          backgroundColor: "#1E293B",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          overflow: "hidden",
        }}
      >
        {/* Top-right stats cards */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "24px",
            display: "flex",
            gap: "12px",
            zIndex: 5,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "10px 16px",
              borderRadius: "10px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ color: "#16A34A", fontSize: "18px" }}>📈</span>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "10px",
                  color: "#64748B",
                  fontWeight: "700",
                }}
              >
                AVG. SPEED
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: "800",
                  color: "#1E293B",
                }}
              >
                38 km/h
              </p>
            </div>
          </div>
          <div
            style={{
              background: "white",
              padding: "10px 16px",
              borderRadius: "10px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ color: "#DC2626", fontSize: "18px" }}>⚠️</span>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "10px",
                  color: "#64748B",
                  fontWeight: "700",
                }}
              >
                ALERTS
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: "800",
                  color: "#DC2626",
                }}
              >
                02 High
              </p>
            </div>
          </div>
        </div>

        {/* Floating Fleet Panel (Left) */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            width: "320px",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(8px)",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
            zIndex: 5,
            maxHeight: "calc(100vh - 160px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px",
              borderBottom: "1px solid #F1F5F9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "800",
                color: "#1E293B",
              }}
            >
              Active Fleet
            </h3>
            <span
              style={{
                backgroundColor: "#22C55E",
                color: "white",
                fontSize: "11px",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "12px",
              }}
            >
              24 Live
            </span>
          </div>
          <div
            style={{
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              overflowY: "auto",
            }}
          >
            {activeFleet.map((bus) => (
              <div
                key={bus.id}
                onClick={() => setSelectedBus(bus.id)}
                style={{
                  padding: "16px",
                  border: `1px solid ${
                    selectedBus === bus.id ? "#0056B3" : "#E2E8F0"
                  }`,
                  borderRadius: "12px",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow:
                    selectedBus === bus.id
                      ? "0 0 0 1px #0056B3"
                      : undefined,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>🚌</span>
                    <div>
                      <strong style={{ fontSize: "14px", color: "#1E293B" }}>
                        {bus.id}
                      </strong>
                      <p style={{ margin: 0, fontSize: "11px", color: "#64748B" }}>
                        {bus.route}
                      </p>
                    </div>
                  </div>
                  <span
                    style={{
                      backgroundColor: bus.statusBg,
                      color: bus.statusColor,
                      fontSize: "9px",
                      fontWeight: "800",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {bus.status}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    color: "#64748B",
                    paddingTop: "4px",
                  }}
                >
                  <span>
                    Speed: <strong style={{ color: "#334155" }}>{bus.speed}</strong>
                  </span>
                  <span>{bus.lastUpdate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Road Lines */}
        <svg
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        >
          <path
            d="M 100 350 Q 400 200 800 450 T 1200 300"
            fill="none"
            stroke="#334155"
            strokeWidth="6"
          />
          <path
            d="M 300 100 Q 550 400 650 700"
            fill="none"
            stroke="#334155"
            strokeWidth="4"
          />
          <path
            d="M 100 350 Q 400 200 800 450 T 1200 300"
            fill="none"
            stroke="#475569"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
        </svg>

        {/* Bus Markers */}
        {busMarkers.map((marker) => (
          <div
            key={marker.id}
            onClick={() => setSelectedBus(marker.id)}
            style={{
              position: "absolute",
              top: marker.top,
              left: marker.left,
              width: "36px",
              height: "36px",
              background: "#FFFFFF",
              border: `2px solid ${marker.borderColor}`,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              cursor: "pointer",
              fontSize: "16px",
              zIndex: 4,
            }}
          >
            🚌
          </div>
        ))}

        {/* Selected Bus Popup (LY-8821) */}
        {selectedBus === "LY-8821" && (
          <div
            style={{
              position: "absolute",
              top: "45%",
              left: "55%",
              width: "260px",
              background: "#FFFFFF",
              borderRadius: "14px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              overflow: "hidden",
              zIndex: 6,
              border: "1px solid #E2E8F0",
            }}
          >
            <div
              style={{
                backgroundColor: "#00468C",
                color: "white",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ fontSize: "14px" }}>LY-8821</strong>
                  <p style={{ margin: 0, fontSize: "10px", opacity: 0.9 }}>
                    Route 177 | Kaduwela - Fort
                  </p>
                </div>
                <span style={{ fontSize: "14px", cursor: "pointer" }}>📹</span>
              </div>
            </div>
            <div style={{ padding: "14px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#94A3B8",
                      fontWeight: "700",
                    }}
                  >
                    DRIVER
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#1E293B",
                    }}
                  >
                    Nimal Perera
                  </p>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#94A3B8",
                      fontWeight: "700",
                    }}
                  >
                    SPEED
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#1E293B",
                    }}
                  >
                    15 km/h
                  </p>
                </div>
              </div>
              <div
                style={{
                  backgroundColor: "#FEF3C7",
                  border: "1px solid #F59E0B",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "14px",
                }}
              >
                <span style={{ fontSize: "16px" }}>⏱️</span>
                <div>
                  <span
                    style={{
                      fontSize: "9px",
                      color: "#B45309",
                      fontWeight: "700",
                      display: "block",
                    }}
                  >
                    ETA TO NEXT STOP
                  </span>
                  <strong style={{ fontSize: "13px", color: "#B45309" }}>
                    8 Minutes
                  </strong>
                </div>
              </div>
              <button
                style={{
                  width: "100%",
                  backgroundColor: "#E0E7FF",
                  color: "#4F46E5",
                  border: "none",
                  padding: "10px",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                View Live Feed
              </button>
            </div>
          </div>
        )}

        {/* Map Controls */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            right: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: 5,
          }}
        >
          {["+", "-", "🎯"].map((label) => (
            <button
              key={label}
              style={{
                width: "40px",
                height: "40px",
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                color: "#334155",
                cursor: "pointer",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
            >
              {label}
            </button>
          ))}
          <button
            style={{
              width: "40px",
              height: "40px",
              background: "#00468C",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              color: "white",
              cursor: "pointer",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            }}
          >
            🗺️
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
