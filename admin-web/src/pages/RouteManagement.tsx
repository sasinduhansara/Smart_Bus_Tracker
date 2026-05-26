import { useState } from "react";
import AdminLayout from "../components/AdminLayout";

interface Route {
  number: string;
  name: string;
  type: string;
  start: string;
  end: string;
  stops: number;
  activeBuses: number;
}

const routesData: Route[] = [
  {
    number: "138",
    name: "Kottawa - Pettah",
    type: "Expressway & Main Road",
    start: "Kottawa Terminal",
    end: "Pettah Central",
    stops: 42,
    activeBuses: 18,
  },
  {
    number: "177",
    name: "Kaduwela - Kollupitiya",
    type: "Semi-Luxury Service",
    start: "Kaduwela Depot",
    end: "Kollupitiya Junction",
    stops: 28,
    activeBuses: 12,
  },
  {
    number: "01",
    name: "Colombo - Kandy",
    type: "Intercity AC",
    start: "Bastian Mawatha",
    end: "Kandy Goods Shed",
    stops: 15,
    activeBuses: 32,
  },
];

export default function RouteManagement() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRoutes = routesData.filter((route) => {
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
              Configure and monitor all public transport routes.
            </p>
          </div>
          <button
            style={{
              backgroundColor: "#00468C",
              color: "white",
              border: "none",
              padding: "12px 20px",
              borderRadius: "8px",
              fontWeight: "700",
              cursor: "pointer",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>+</span> Add New Route
          </button>
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
          {[
            { label: "TOTAL ROUTES", value: "24", color: "#1E3A8A" },
            { label: "ACTIVE BUSES", value: "156", color: "#B45309" },
            { label: "AVERAGE STOPS", value: "32", color: "#065F46" },
            { label: "COVERAGE", value: "88%", color: "#1D4ED8" },
          ].map((card, i) => (
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
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {/* ─── Routes Table ─── */}
        {filteredRoutes.length === 0 ? (
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
                : "No routes available."}
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
                      "Map",
                      "Route Info",
                      "Start / End",
                      "Stops",
                      "Active Buses",
                      "Actions",
                    ].map((h, i) => (
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
                          textAlign:
                            i === 3 || i === 5 ? "center" : "left",
                          width:
                            i === 0
                              ? "100px"
                              : i === 5
                                ? "80px"
                                : undefined,
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
                      {/* Map Thumbnail */}
                      <td
                        style={{
                          padding: "24px",
                          borderBottom: "1px solid #F1F5F9",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          style={{
                            width: "72px",
                            height: "44px",
                            borderRadius: "6px",
                            backgroundColor: "#64748B",
                            backgroundImage:
                              "radial-gradient(#475569 1px, transparent 1px)",
                            backgroundSize: "8px 8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "rgba(255,255,255,0.3)",
                            fontSize: "10px",
                          }}
                        >
                          🗺️
                        </div>
                      </td>

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
                            {route.number} {route.name}
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
                        </div>
                      </td>

                      {/* Start / End */}
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
                            gap: "8px",
                            fontSize: "13px",
                            fontWeight: "500",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                display: "inline-block",
                                backgroundColor: "#1D4ED8",
                              }}
                            />
                            <span style={{ color: "#64748B" }}>
                              {route.start}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                display: "inline-block",
                                backgroundColor: "#EF4444",
                              }}
                            />
                            <span style={{ color: "#1E293B" }}>
                              {route.end}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Stops */}
                      <td
                        style={{
                          padding: "24px",
                          borderBottom: "1px solid #F1F5F9",
                          verticalAlign: "middle",
                          textAlign: "center",
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
                          {route.stops} Stops
                        </span>
                      </td>

                      {/* Active Buses */}
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
                            paddingLeft: "12px",
                          }}
                        >
                          {route.activeBuses}
                        </span>
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

            {/* Pagination Footer */}
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
              <span>Showing 1 to 10 of 24 routes</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  style={{
                    border: "1px solid #E2E8F0",
                    background: "white",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  ◀
                </button>
                <button
                  style={{
                    border: "1px solid #E2E8F0",
                    background: "white",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  ▶
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
