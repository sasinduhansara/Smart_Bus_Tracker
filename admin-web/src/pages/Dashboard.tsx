import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { adminAPI } from "../services/api";

interface DashboardStats {
  activeBuses: number;
  totalFleet: number;
  totalPassengers: number;
  totalRoutes: number;
  totalDrivers: number;
  approvedDrivers: number;
  pendingDrivers: number;
  rejectedDrivers: number;
  pendingRegistrations: number;
  completedRegistrations: number;
}

interface ActivityItem {
  text: string;
  time: string;
  critical: boolean;
}

export default function Dashboard() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  const [stats, setStats] = useState<DashboardStats>({
    activeBuses: 0,
    totalFleet: 0,
    totalPassengers: 0,
    totalRoutes: 0,
    totalDrivers: 0,
    approvedDrivers: 0,
    pendingDrivers: 0,
    rejectedDrivers: 0,
    pendingRegistrations: 0,
    completedRegistrations: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    fetchDashboardStats();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const res = await adminAPI.getDashboardStats();
      const data = res.data.data;
      setStats(data.stats);
      setRecentActivity(data.recentActivity || []);
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth > 768 && windowWidth <= 1024;

  const summaryCards = [
    {
      title: "ACTIVE BUSES",
      value: String(stats.activeBuses),
      icon: "🚌",
      bg: "#EFF6FF",
      color: "#1D4ED8",
    },
    {
      title: "TOTAL PASSENGERS",
      value: stats.totalPassengers > 0 ? String(stats.totalPassengers) : "0",
      icon: "👥",
      bg: "#FEF3C7",
      color: "#B45309",
    },
    {
      title: "ACTIVE ROUTES",
      value: String(stats.totalRoutes),
      icon: "🗺️",
      bg: "#ECFDF5",
      color: "#047857",
    },
    {
      title: "TOTAL DRIVERS",
      value: String(stats.totalDrivers),
      icon: "👤",
      bg: "#FEE2E2",
      color: "#B91C1C",
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
                {stats.activeBuses} bus{stats.activeBuses !== 1 ? "es" : ""} active
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
                ⚡ Recent Activity
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
              {loading ? (
                <p style={{ fontSize: "12px", color: "#9CA3AF" }}>Loading...</p>
              ) : recentActivity.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#9CA3AF" }}>
                  No recent activity
                </p>
              ) : (
                recentActivity.map((feed, idx) => (
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
                      {feed.time && (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#9CA3AF",
                            fontWeight: "600",
                          }}
                        >
                          {feed.time}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Driver Stats */}
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
                📊 Driver Overview
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
                Live
              </span>
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  backgroundColor: "#ECFDF5",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#065F46" }}>
                  ✅ Approved
                </span>
                <span style={{ fontSize: "20px", fontWeight: "800", color: "#065F46" }}>
                  {stats.approvedDrivers}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  backgroundColor: "#FEF3C7",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#92400E" }}>
                  ⏳ Pending
                </span>
                <span style={{ fontSize: "20px", fontWeight: "800", color: "#92400E" }}>
                  {stats.pendingDrivers}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  backgroundColor: "#FEE2E2",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#991B1B" }}>
                  ❌ Rejected
                </span>
                <span style={{ fontSize: "20px", fontWeight: "800", color: "#991B1B" }}>
                  {stats.rejectedDrivers}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  backgroundColor: "#F3F4F6",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  📝 Pending Registrations
                </span>
                <span style={{ fontSize: "20px", fontWeight: "800", color: "#374151" }}>
                  {stats.pendingRegistrations}
                </span>
              </div>
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
                onClick={() => window.location.href = "/driver-management"}
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
                onClick={() => window.location.href = "/route-management"}
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
                onClick={() => window.location.href = "/bus-management"}
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
                📄 View Fleet
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
