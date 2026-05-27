import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { adminAPI } from "../services/api";

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: string; // critical, warning, info
  busNumber: string;
  routeNumber: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_by: string;
  created_at: string;
}

interface AlertStats {
  total: number;
  unresolved: number;
  critical: number;
  resolvedToday: number;
  resolutionRate: number;
}

type FilterKey = "all" | "unresolved" | "critical";

const FILTER_TABS: { label: string; key: FilterKey }[] = [
  { label: "All", key: "all" },
  { label: "Unresolved", key: "unresolved" },
  { label: "Critical", key: "critical" },
];

const SEVERITY_CONFIG: Record<string, { icon: string; color: string; bg: string; borderColor: string; label: string }> = {
  critical: {
    icon: "🚨",
    color: "#BA1A1A",
    bg: "#FEE2E2",
    borderColor: "#BA1A1A",
    label: "CRITICAL",
  },
  warning: {
    icon: "⚠️",
    color: "#D97706",
    bg: "#FEF3C7",
    borderColor: "#D97706",
    label: "WARNING",
  },
  info: {
    icon: "ℹ️",
    color: "#2563EB",
    bg: "#DBEAFE",
    borderColor: "#2563EB",
    label: "INFO",
  },
};

function getTimeAgo(isoString: string): string {
  if (!isoString) return "";
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
}

export default function SystemAlerts() {
  const [activeTab, setActiveTab] = useState<FilterKey>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState<AlertStats>({
    total: 0,
    unresolved: 0,
    critical: 0,
    resolvedToday: 0,
    resolutionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await adminAPI.getAlerts();
      const data = res.data.data;
      setAlerts(data.alerts || []);
      setStats(data.stats);
    } catch (err) {
      console.error("Error fetching alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await adminAPI.resolveAlert(alertId);
      fetchAlerts();
    } catch (err) {
      console.error("Error resolving alert:", err);
    }
  };

  const handleDelete = async (alertId: string) => {
    try {
      await adminAPI.deleteAlert(alertId);
      fetchAlerts();
    } catch (err) {
      console.error("Error deleting alert:", err);
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "unresolved" && !alert.resolved) ||
      (activeTab === "critical" && alert.severity === "critical" && !alert.resolved);

    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !query ||
      alert.title.toLowerCase().includes(query) ||
      alert.message.toLowerCase().includes(query) ||
      alert.busNumber.toLowerCase().includes(query) ||
      alert.routeNumber.includes(query);

    return matchesTab && matchesSearch;
  });

  const getTabCount = (key: FilterKey): number => {
    if (key === "all") return stats.total;
    if (key === "unresolved") return stats.unresolved;
    if (key === "critical") return stats.critical;
    return 0;
  };

  return (
    <AdminLayout
      title="System Alerts & Notifications"
      showSearch
      searchPlaceholder="Search alerts, bus IDs, or routes..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
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
              {loading ? "Loading..." : `${stats.unresolved} unresolved, ${stats.critical} critical`}
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
            {FILTER_TABS.map((tab) => {
              const count = getTabCount(tab.key);
              const label = `${tab.label} (${count})`;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    transition: "all 0.2s ease",
                    backgroundColor:
                      activeTab === tab.key ? "#FFFFFF" : "transparent",
                    color: activeTab === tab.key ? "#1E293B" : "#64748B",
                    boxShadow:
                      activeTab === tab.key
                        ? "0 1px 3px rgba(0,0,0,0.1)"
                        : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Alert List ─── */}
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#94A3B8",
              background: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E2E8F0",
            }}
          >
            Loading alerts...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#94A3B8",
              background: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E2E8F0",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🔔</div>
            <h3 style={{ margin: "0 0 4px 0", color: "#1E293B" }}>
              No alerts found
            </h3>
            <p style={{ margin: 0, fontSize: "13px" }}>
              {searchTerm
                ? `No alerts match "${searchTerm}".`
                : "All clear! No alerts match the current filter."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filteredAlerts.map((alert) => {
              const severityConf = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
              return (
                <div
                  key={alert.id}
                  style={{
                    background: "#FFFFFF",
                    border: `1px solid ${alert.resolved ? "#E2E8F0" : severityConf.borderColor}`,
                    borderLeft: alert.resolved ? "4px solid #16A34A" : `4px solid ${severityConf.borderColor}`,
                    borderRadius: "14px",
                    padding: "20px 24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                    opacity: alert.resolved ? 0.7 : 1,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "18px",
                          backgroundColor: severityConf.bg,
                          padding: "6px",
                          borderRadius: "8px",
                        }}
                      >
                        {alert.resolved ? "✅" : severityConf.icon}
                      </span>
                      <div>
                        <h4
                          style={{
                            margin: 0,
                            fontSize: "15px",
                            fontWeight: 700,
                            color: alert.resolved ? "#16A34A" : "#1E293B",
                          }}
                        >
                          {alert.title}
                        </h4>
                        {!alert.resolved && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: "800",
                              color: severityConf.color,
                              letterSpacing: "0.5px",
                            }}
                          >
                            {severityConf.label}
                          </span>
                        )}
                        {alert.resolved && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: "800",
                              color: "#16A34A",
                            }}
                          >
                            RESOLVED
                          </span>
                        )}
                      </div>
                    </div>
                    <p
                      style={{
                        margin: "0 0 12px 0",
                        fontSize: "13px",
                        color: "#475569",
                        lineHeight: "1.5",
                      }}
                    >
                      {alert.message}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      {alert.busNumber && (
                        <span
                          style={{
                            background: "#F1F5F9",
                            color: "#475569",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          🚌 {alert.busNumber}
                        </span>
                      )}
                      {alert.routeNumber && (
                        <span
                          style={{
                            background: "#F1F5F9",
                            color: "#475569",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          Route {alert.routeNumber}
                        </span>
                      )}
                      {alert.resolved && alert.resolved_by && (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#64748B",
                          }}
                        >
                          Resolved by {alert.resolved_by}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#94A3B8",
                        }}
                      >
                        {getTimeAgo(alert.created_at)}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexShrink: 0,
                      alignItems: "flex-start",
                    }}
                  >
                    {!alert.resolved && (
                      <button
                        onClick={() => handleResolve(alert.id)}
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
                        Resolve
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(alert.id)}
                      style={{
                        backgroundColor: "white",
                        color: "#EF4444",
                        border: "1px solid #FCA5A5",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 📊 Bottom KPIs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
          }}
        >
          {/* Unresolved */}
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
              UNRESOLVED
            </span>
            <p
              style={{
                margin: "4px 0",
                fontSize: "32px",
                fontWeight: 800,
                color: "#D97706",
              }}
            >
              {loading ? "..." : stats.unresolved}
            </p>
          </div>

          {/* Critical */}
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
              CRITICAL
            </span>
            <p
              style={{
                margin: "4px 0",
                fontSize: "32px",
                fontWeight: 800,
                color: "#DC2626",
              }}
            >
              {loading ? "..." : stats.critical}
            </p>
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
              {loading ? "..." : stats.resolvedToday}
            </p>
          </div>

          {/* Resolution Rate */}
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
              RESOLUTION RATE
            </span>
            <p
              style={{
                margin: "4px 0",
                fontSize: "32px",
                fontWeight: 800,
                color: "#1D4ED8",
              }}
            >
              {loading ? "..." : `${stats.resolutionRate}%`}
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
