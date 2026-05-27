import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import { adminAPI } from "../services/api";

interface Driver {
  id: string;
  _id?: string;
  fullName: string;
  status: string;
  bus_number: string;
  route_number: string;
  phone: string;
  employee_id: string;
  licenseNumber: string;
  nic: string;
  created_at?: string;
  updated_at?: string;
}

interface DriverStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

const FILTER_OPTIONS = [
  { label: "All Drivers", key: "all" },
  { label: "Approved", key: "approved" },
  { label: "Pending", key: "pending" },
  { label: "Rejected", key: "rejected" },
] as const;

type FilterKey = (typeof FILTER_OPTIONS)[number]["key"];

export default function DriverManagement() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<DriverStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchDrivers();
    fetchStats();
  }, []);

  const fetchDrivers = async () => {
    try {
      const res = await adminAPI.getDrivers({ limit: 100 });
      setDrivers(res.data.data.drivers || []);
    } catch (err) {
      console.error("Error fetching drivers:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await adminAPI.getStats();
      setStats(res.data.data);
    } catch (err) {
      console.error("Error fetching driver stats:", err);
    }
  };

  const filteredDrivers = drivers.filter((driver) => {
    const matchesFilter =
      activeFilter === "all" || driver.status === activeFilter;
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !query ||
      driver.fullName.toLowerCase().includes(query) ||
      driver.employee_id.toLowerCase().includes(query) ||
      driver.bus_number.toLowerCase().includes(query) ||
      driver.phone.includes(query) ||
      driver.nic.includes(query);
    return matchesFilter && matchesSearch;
  });

  const getFilterCount = (key: FilterKey): number => {
    if (key === "all") return stats.total;
    if (key === "approved") return stats.approved;
    if (key === "pending") return stats.pending;
    if (key === "rejected") return stats.rejected;
    return 0;
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "approved":
        return { label: "Active", bg: "#E2FBE8", color: "#16A34A" };
      case "pending":
        return { label: "Pending", bg: "#FEF3C7", color: "#D97706" };
      case "rejected":
        return { label: "Rejected", bg: "#FEE2E2", color: "#EF4444" };
      default:
        return { label: status, bg: "#F1F5F9", color: "#64748B" };
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AdminLayout
      title="Driver Management"
      showSearch
      searchPlaceholder="Search driver by name, ID, bus, phone..."
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
        {/* ─── Header ─── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
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
              Driver Management
            </h2>
            <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
              {loading
                ? "Loading..."
                : `Manage and monitor ${stats.approved} active personnel across regional routes.`}
            </p>
          </div>
          <button
            onClick={() => navigate("/bus-registration")}
            style={{
              backgroundColor: "#0056B3",
              color: "white",
              border: "none",
              padding: "12px 20px",
              borderRadius: "8px",
              fontWeight: "700",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>+</span> Add New Driver
          </button>
        </div>

        {/* ─── Filter Bar ─── */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", gap: "10px" }}>
            {FILTER_OPTIONS.map((filter) => {
              const isSelected = activeFilter === filter.key;
              const count = getFilterCount(filter.key);
              return (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: isSelected ? "#0056B3" : "#F1F5F9",
                    color: isSelected ? "#FFFFFF" : "#475569",
                  }}
                >
                  {filter.label}
                  <span
                    style={{
                      fontSize: "11px",
                      opacity: 0.8,
                      backgroundColor: isSelected
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.05)",
                      padding: "2px 6px",
                      borderRadius: "10px",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Pending applications tag ─── */}
        {stats.pending > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              fontWeight: "600",
              color: "#475569",
            }}
          >
            <div style={{ display: "flex" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  backgroundColor: "#FEF3C7",
                  border: "2px solid #F8FAFC",
                  zIndex: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                }}
              >
                ⏳
              </div>
            </div>
            <span>
              <strong style={{ color: "#D97706" }}>{stats.pending} New</strong>{" "}
              application{stats.pending !== 1 ? "s" : ""} pending
            </span>
          </div>
        )}

        {/* ─── Cards Grid ─── */}
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
            Loading driver data...
          </div>
        ) : filteredDrivers.length === 0 ? (
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
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>👨‍✈️</div>
            <h3 style={{ margin: "0 0 4px 0", color: "#1E293B" }}>
              No drivers found
            </h3>
            <p style={{ margin: 0, fontSize: "13px" }}>
              {searchTerm
                ? `No drivers match "${searchTerm}". Try a different search.`
                : "No drivers match the selected filter."}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "20px",
              width: "100%",
            }}
          >
            {filteredDrivers.map((driver) => {
              const statusStyle = getStatusStyle(driver.status);
              const hasBus = driver.bus_number && driver.bus_number !== "";
              return (
                <div
                  key={driver.id}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "24px 20px 16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
                  }}
                >
                  {/* Status Tag */}
                  <span
                    style={{
                      position: "absolute",
                      top: "20px",
                      right: "20px",
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      textTransform: "uppercase",
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.color,
                    }}
                  >
                    {statusStyle.label}
                  </span>

                  {/* Avatar */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: "14px",
                      position: "relative",
                      width: "64px",
                      height: "64px",
                      margin: "0 auto 12px auto",
                    }}
                  >
                    <div
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        backgroundColor: "#E2E8F0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                        fontWeight: "800",
                        color: "#475569",
                      }}
                    >
                      {getInitials(driver.fullName)}
                    </div>
                    <span
                      style={{
                        position: "absolute",
                        bottom: "2px",
                        right: "2px",
                        width: "12px",
                        height: "12px",
                        backgroundColor:
                          driver.status === "approved" ? "#16A34A" : "#CBD5E1",
                        border: "2px solid white",
                        borderRadius: "50%",
                      }}
                    />
                  </div>

                  {/* Driver Details */}
                  <div style={{ textAlign: "center", marginBottom: "16px" }}>
                    <h3
                      style={{
                        margin: "0 0 2px 0",
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#1E293B",
                      }}
                    >
                      {driver.fullName}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        color: "#94A3B8",
                        fontWeight: 600,
                      }}
                    >
                      {driver.employee_id || "N/A"}
                    </p>
                  </div>

                  {/* Bus / Route Badge */}
                  <div style={{ marginBottom: "12px" }}>
                    {!hasBus ? (
                      <div
                        style={{
                          backgroundColor: "#F1F5F9",
                          color: "#94A3B8",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          textAlign: "center",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        🚫 Unassigned
                      </div>
                    ) : (
                      <div
                        style={{
                          backgroundColor: "#FEF3C7",
                          color: "#B45309",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        🚌{" "}
                        <span>
                          {driver.bus_number} (Route {driver.route_number})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Phone */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#64748B",
                      fontSize: "13px",
                      justifyContent: "center",
                      marginBottom: "20px",
                    }}
                  >
                    <span>📞</span> {driver.phone}
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "12px",
                      borderTop: "1px solid #F1F5F9",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0056B3",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      View Profile
                    </button>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        color: "#94A3B8",
                        cursor: "pointer",
                        fontSize: "16px",
                      }}
                    >
                      ⋮
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add New Driver Card */}
            <div
              onClick={() => navigate("/bus-registration")}
              style={{
                background: "#F8FAFC",
                border: "2px dashed #CBD5E1",
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                minHeight: "280px",
                color: "#64748B",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#F1F5F9";
                e.currentTarget.style.borderColor = "#0056B3";
                e.currentTarget.style.color = "#0056B3";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#F8FAFC";
                e.currentTarget.style.borderColor = "#CBD5E1";
                e.currentTarget.style.color = "#64748B";
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  marginBottom: "12px",
                  color: "#475569",
                }}
              >
                👤+
              </div>
              <strong
                style={{
                  fontSize: "14px",
                  color: "#1E293B",
                  marginBottom: "4px",
                }}
              >
                Add New Driver
              </strong>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "#94A3B8",
                  textAlign: "center",
                  padding: "0 16px",
                }}
              >
                Register a new driver profile
              </p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
