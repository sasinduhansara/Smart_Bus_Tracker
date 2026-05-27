import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { adminAPI } from "../services/api";

interface RouteStats {
  totalRoutes: number;
  totalBuses: number;
  averageStops: number;
  coverage: number;
}

interface RouteDriver {
  name: string;
  bus: string;
  status: string;
  employee_id: string;
}

interface Route {
  number: string;
  name: string;
  type: string;
  start: string;
  end: string;
  stops: number;
  totalBuses: number;
  activeBuses: number;
  drivers: RouteDriver[];
}

export default function RouteManagement() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stats, setStats] = useState<RouteStats>({
    totalRoutes: 0,
    totalBuses: 0,
    averageStops: 0,
    coverage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const res = await adminAPI.getRoutes();
      const data = res.data.data;
      setRoutes(data.routes || []);
      setStats(data.stats || {
        totalRoutes: 0,
        totalBuses: 0,
        averageStops: 0,
        coverage: 0,
      });
    } catch (err) {
      console.error("Error fetching routes:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRoutes = routes.filter((route) => {
    const query = searchTerm.toLowerCase().trim();
    return (
      !query ||
      route.number.includes(query) ||
      route.name.toLowerCase().includes(query) ||
      route.type.toLowerCase().includes(query) ||
      route.start.toLowerCase().includes(query) ||
      route.end.toLowerCase().includes(query)
    );
  });

  const counterCards = [
    { label: "TOTAL ROUTES", value: String(stats.totalRoutes), color: "#1E3A8A" },
    { label: "ASSIGNED BUSES", value: String(stats.totalBuses), color: "#B45309" },
    { label: "AVERAGE STOPS", value: String(stats.averageStops), color: "#065F46" },
    { label: "COVERAGE", value: `${stats.coverage}%`, color: "#1D4ED8" },
  ];

  return (
    <AdminLayout
      title="Route Management"
      showSearch
      searchPlaceholder="Search routes..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
    >
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
        {/* ─── Header ─── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "22px",
                fontWeight: "800",
                color: "#1E293B",
                margin: "0 0 4px 0",
              }}
            >
              Route Management
            </h2>
            <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
              {loading ? "Loading..." : `${stats.totalRoutes} route${stats.totalRoutes !== 1 ? "s" : ""} configured`}
            </p>
          </div>
        </div>

        {/* ─── Counter Cards ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "20px",
            width: "100%",
          }}
        >
          {counterCards.map((card, i) => (
            <div
              key={i}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                padding: "16px 20px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.01)",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  color: "#64748B",
                  margin: "0 0 6px 0",
                  letterSpacing: "0.5px",
                }}
              >
                {card.label}
              </p>
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: "800",
                  color: card.color,
                  margin: 0,
                }}
              >
                {loading ? "..." : card.value}
              </p>
            </div>
          ))}
        </div>

        {/* ─── Routes Table ─── */}
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
            Loading routes...
          </div>
        ) : filteredRoutes.length === 0 ? (
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
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🗺️</div>
            <h3 style={{ margin: "0 0 4px 0", color: "#1E293B" }}>
              No routes found
            </h3>
            <p style={{ margin: 0, fontSize: "13px" }}>
              {searchTerm
                ? `No routes match "${searchTerm}". Try a different search.`
                : "No routes available yet. Register a bus with a route number to create one."}
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Route",
                      "Type",
                      "Buses Assigned",
                      "Active",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "16px 24px",
                          backgroundColor: "#F8FAFC",
                          color: "#64748B",
                          fontSize: "12px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          borderBottom: "1px solid #E2E8F0",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutes.map((route, index) => (
                    <tr key={index}>
                      {/* Route Number & Name */}
                      <td
                        style={{
                          padding: "24px",
                          borderBottom: "1px solid #F1F5F9",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "16px",
                              fontWeight: "700",
                              color: "#1E293B",
                            }}
                          >
                            🗺️ {route.number} {route.name}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              color: "#B45309",
                            }}
                          >
                            {route.type}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#64748B",
                              marginTop: "4px",
                            }}
                          >
                            {route.start} → {route.end}
                          </span>
                        </div>
                      </td>

                      {/* Type */}
                      <td
                        style={{
                          padding: "24px",
                          borderBottom: "1px solid #F1F5F9",
                          verticalAlign: "middle",
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: "#E2E8F0",
                            color: "#475569",
                            padding: "6px 12px",
                            borderRadius: "16px",
                            fontSize: "12px",
                            fontWeight: "700",
                          }}
                        >
                          {route.type}
                        </span>
                      </td>

                      {/* Buses Assigned */}
                      <td
                        style={{
                          padding: "24px",
                          borderBottom: "1px solid #F1F5F9",
                          verticalAlign: "middle",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "20px",
                            fontWeight: "800",
                            color: "#1D4ED8",
                          }}
                        >
                          {route.totalBuses}
                        </span>
                      </td>

                      {/* Active */}
                      <td
                        style={{
                          padding: "24px",
                          borderBottom: "1px solid #F1F5F9",
                          verticalAlign: "middle",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "20px",
                            fontWeight: "800",
                            color: "#16A34A",
                          }}
                        >
                          {route.activeBuses}
                        </span>
                        {route.drivers.length > 0 && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#64748B",
                              marginTop: "4px",
                            }}
                          >
                            {route.drivers.map((d) => d.name).join(", ")}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        style={{
                          padding: "24px",
                          borderBottom: "1px solid #F1F5F9",
                          verticalAlign: "middle",
                          textAlign: "center",
                        }}
                      >
                        <button
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "14px",
                            color: "#64748B",
                          }}
                        >
                          🔽
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                backgroundColor: "#FFFFFF",
                borderTop: "1px solid #F1F5F9",
                fontSize: "13px",
                color: "#64748B",
              }}
            >
              <span>
                Showing {filteredRoutes.length} of {routes.length} route
                {routes.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
