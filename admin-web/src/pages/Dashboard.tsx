import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";

export default function Dashboard() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth > 768 && windowWidth <= 1024;

  const summaryCards = [
    {
      title: "ACTIVE BUSES",
      value: "124",
      icon: "🚌",
      bg: "#EFF6FF",
      color: "#1D4ED8",
    },
    {
      title: "TOTAL PASSENGERS",
      value: "8.2k",
      icon: "👥",
      bg: "#FEF3C7",
      color: "#B45309",
    },
    {
      title: "ACTIVE ROUTES",
      value: "45",
      icon: "🗺️",
      bg: "#ECFDF5",
      color: "#047857",
    },
    {
      title: "SYSTEM ALERTS",
      value: "3",
      icon: "⚠️",
      bg: "#FEE2E2",
      color: "#B91C1C",
    },
  ];

  const activityFeed = [
    {
      text: "Route 120 reaching stop: Bambalapitiya",
      time: "JUST NOW",
      critical: false,
    },
    {
      text: "Emergency brake alert: Bus NB-1233",
      time: "2 MINS AGO",
      critical: true,
    },
    {
      text: "New maintenance log for Bus NB-5501",
      time: "10 MINS AGO",
      critical: false,
    },
  ];

  return (
    <AdminLayout>
      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Summary Cards Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? windowWidth <= 480
                ? "1fr"
                : "repeat(2, 1fr)"
              : "repeat(4, 1fr)",
            gap: "20px",
            width: "100%",
          }}
        >
          {summaryCards.map((card, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: "#FFFFFF",
                padding: "20px 16px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                boxSizing: "border-box",
                transition: "box-shadow 0.2s ease, transform 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 4px 6px -1px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  flexShrink: 0,
                  backgroundColor: card.bg,
                  color: card.color,
                }}
              >
                {card.icon}
              </div>
              <div>
                <p
                  style={{
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "#9CA3AF",
                    margin: 0,
                    letterSpacing: "0.5px",
                  }}
                >
                  {card.title}
                </p>
                <p
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "#111827",
                    margin: 0,
                  }}
                >
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Data Grid Panels */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              isMobile || isTablet ? "1fr" : "repeat(3, 1fr)",
            gap: "24px",
            width: "100%",
          }}
        >
          {/* Live Fleet Map */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "10px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              minHeight: "290px",
              gridColumn: isMobile || isTablet ? "auto" : "span 2",
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
              <h3
                style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#374151",
                  margin: 0,
                }}
              >
                📍 Live Fleet Map
              </h3>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#00468C",
                  backgroundColor: "#EFF6FF",
                  padding: "3px 8px",
                  borderRadius: "10px",
                }}
              >
                • Colombo Central
              </span>
            </div>
            <div
              style={{
                flex: 1,
                backgroundColor: "#E5E7EB",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
                minHeight: "220px",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  color: "#9CA3AF",
                  fontWeight: "500",
                  margin: 0,
                }}
              >
                [ Map Interface Live Tracking view ]
              </p>
            </div>
          </div>

          {/* Live Activity */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "10px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              minHeight: "290px",
            }}
          >
            <div style={{ marginBottom: "16px" }}>
              <h3
                style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#374151",
                  margin: 0,
                }}
              >
                ⚡ Live Activity
              </h3>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                overflowY: "auto",
                flex: 1,
              }}
            >
              {activityFeed.map((feed, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      marginTop: "5px",
                      backgroundColor: feed.critical ? "#EF4444" : "#3B82F6",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <p
                      style={{
                        fontSize: "13px",
                        margin: 0,
                        color: feed.critical ? "#B91C1C" : "#374151",
                        fontWeight: feed.critical ? "700" : "500",
                      }}
                    >
                      {feed.text}
                    </p>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#9CA3AF",
                        fontWeight: "600",
                      }}
                    >
                      System Update • {feed.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ETA Prediction Accuracy */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "10px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              minHeight: "290px",
              gridColumn: isMobile || isTablet ? "auto" : "span 2",
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
              <h3
                style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#374151",
                  margin: 0,
                }}
              >
                📈 ETA Prediction Accuracy
              </h3>
              <span
                style={{
                  fontSize: "11px",
                  color: "#6B7280",
                  backgroundColor: "#F3F4F6",
                  padding: "3px 8px",
                  borderRadius: "4px",
                }}
              >
                Last 24 Hours
              </span>
            </div>
            <div
              style={{
                flex: 1,
                backgroundColor: "#F9FAFB",
                border: "1px dashed #D1D5DB",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "220px",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  color: "#9CA3AF",
                  fontWeight: "500",
                  margin: 0,
                }}
              >
                [ Accuracy Curve Performance Chart ]
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "10px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              minHeight: "290px",
            }}
          >
            <div style={{ marginBottom: "16px" }}>
              <h3
                style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#374151",
                  margin: 0,
                }}
              >
                🛠️ Quick Actions
              </h3>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                justifyContent: "center",
                flex: 1,
              }}
            >
              <button
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  backgroundColor: "#00468C",
                  color: "white",
                  border: "none",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                + Add New Driver
              </button>
              <button
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  backgroundColor: "#F59E0B",
                  color: "white",
                  border: "none",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                + Add New Bus Route
              </button>
              <button
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  backgroundColor: "white",
                  color: "#374151",
                  border: "1px solid #D1D5DB",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#F9FAFB";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "white";
                }}
              >
                📄 View Fleet Reports
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
