import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";

export default function BusManagement() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth > 768 && windowWidth <= 1024;

  const busData = [
    {
      id: "NB-1234",
      driver: "Anura Kumara",
      route: "138",
      status: "Active",
      location: "Maharagama Terminal",
    },
    {
      id: "WP-5678",
      driver: "Sunil Perera",
      route: "120",
      status: "On Break",
      location: "Pettah Central",
    },
    {
      id: "CP-9012",
      driver: "Dilan Mahendra",
      route: "177",
      status: "Inactive",
      location: "Workshop A",
    },
    {
      id: "NB-4421",
      driver: "Kamal Fernando",
      route: "138",
      status: "Active",
      location: "Homagama Junction",
    },
    {
      id: "WP-2133",
      driver: "Rohan Silva",
      route: "122",
      status: "Active",
      location: "Fort Railway Station",
    },
  ];

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Active":
        return {
          backgroundColor: "#ECFDF5",
          color: "#065F46",
          dotColor: "#10B981",
        };
      case "On Break":
        return {
          backgroundColor: "#FEF3C7",
          color: "#92400E",
          dotColor: "#F59E0B",
        };
      case "Inactive":
        return {
          backgroundColor: "#FEE2E2",
          color: "#981B1B",
          dotColor: "#EF4444",
        };
      default:
        return {
          backgroundColor: "#F3F4F6",
          color: "#374151",
          dotColor: "#9CA3AF",
        };
    }
  };

  return (
    <AdminLayout
      searchPlaceholder="Search by bus number or route..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      navbarRightContent={
        <button
          style={{
            backgroundColor: "#00468C",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            fontWeight: "600",
            cursor: "pointer",
            fontSize: "12px",
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          + Add New Bus
        </button>
      }
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr"
              : isTablet
                ? "repeat(2, 1fr)"
                : "repeat(4, 1fr)",
            gap: "20px",
          }}
        >
          {[
            {
              title: "Total Fleet",
              value: "124",
              color: "#00468C",
              icon: "🚌",
            },
            {
              title: "Currently Active",
              value: "86",
              color: "#16A34A",
              icon: "✅",
            },
            { title: "On Break", value: "14", color: "#D97706", icon: "⏱️" },
            {
              title: "Inactive/Maintenance",
              value: "24",
              color: "#DC2626",
              icon: "🛠️",
            },
          ].map((card, idx) => (
            <div
              key={idx}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                padding: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
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
              <div>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#64748B",
                    margin: "0 0 4px 0",
                  }}
                >
                  {card.title}
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
              <div style={{ fontSize: "24px", opacity: 0.8 }}>{card.icon}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "20px",
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
            <h2
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#1E293B",
                margin: 0,
              }}
            >
              Fleet Overview
            </h2>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                🎛️ Filter
              </button>
              <button
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                📥 Export
              </button>
            </div>
          </div>

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
                    "Bus Number",
                    "Driver Name",
                    "Route",
                    "Status",
                    "Last Location",
                    "Actions",
                  ].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: "14px 16px",
                        backgroundColor: "#F8FAFC",
                        color: "#64748B",
                        fontSize: "12px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                        borderBottom: "1px solid #E2E8F0",
                        textAlign: i === 5 ? "right" : "left",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {busData.map((bus) => {
                  const s = getStatusStyle(bus.status);
                  return (
                    <tr key={bus.id}>
                      <td
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #F1F5F9",
                          fontWeight: "700",
                          color: "#00468C",
                          fontSize: "14px",
                        }}
                      >
                        {bus.id}
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #F1F5F9",
                          color: "#334155",
                          fontSize: "14px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              backgroundColor: "#E2E8F0",
                              fontSize: "10px",
                              fontWeight: "bold",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            AK
                          </div>
                          {bus.driver}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #F1F5F9",
                          color: "#334155",
                          fontSize: "14px",
                        }}
                      >
                        <span
                          style={{
                            border: "1px solid #00468C",
                            color: "#00468C",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "700",
                          }}
                        >
                          {bus.route}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #F1F5F9",
                          color: "#334155",
                          fontSize: "14px",
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: s.backgroundColor,
                            color: s.color,
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "600",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              backgroundColor: s.dotColor,
                            }}
                          />
                          {bus.status}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #F1F5F9",
                          color: "#64748B",
                          fontSize: "14px",
                        }}
                      >
                        {bus.location}
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #F1F5F9",
                          color: "#334155",
                          fontSize: "16px",
                          textAlign: "right",
                          cursor: "pointer",
                        }}
                      >
                        ✏️ 🗑️
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "16px",
              fontSize: "13px",
              color: "#64748B",
            }}
          >
            <span>Showing 5 of 124 buses</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                ◀
              </button>
              <button
                style={{
                  backgroundColor: "#00468C",
                  color: "white",
                  border: "none",
                  width: "28px",
                  height: "28px",
                  borderRadius: "4px",
                  fontWeight: "bold",
                }}
              >
                1
              </button>
              <button
                style={{
                  border: "1px solid #E5E7EB",
                  background: "white",
                  width: "28px",
                  height: "28px",
                  borderRadius: "4px",
                }}
              >
                2
              </button>
              <button
                style={{
                  border: "1px solid #E5E7EB",
                  background: "white",
                  width: "28px",
                  height: "28px",
                  borderRadius: "4px",
                }}
              >
                3
              </button>
              <button
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                ▶
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile || isTablet ? "1fr" : "2fr 1fr",
            gap: "24px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "16px",
              overflow: "hidden",
              position: "relative",
              minHeight: "280px",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#0F172A",
                backgroundImage:
                  "radial-gradient(#1E293B 1px, transparent 1px)",
                backgroundSize: "16px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "16px",
                  left: "16px",
                  backgroundColor: "white",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                📡 Real-time Fleet Map
              </span>
              <p style={{ color: "#475569", fontSize: "13px" }}>
                [ Aerial Tracking Mesh Visual Interface ]
              </p>
              <div
                style={{
                  position: "absolute",
                  bottom: "16px",
                  right: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <button
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    border: "none",
                    background: "white",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
                <button
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    border: "none",
                    background: "white",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  -
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#00468C",
              color: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h3
                style={{
                  margin: "0 0 6px 0",
                  fontSize: "16px",
                  fontWeight: "700",
                }}
              >
                Fleet Health Check
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  opacity: 0.9,
                  lineHeight: "1.4",
                }}
              >
                4 buses require immediate maintenance checks based on telematics
                data.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                margin: "16px 0",
              }}
            >
              {[
                { bus: "NB-9921", issue: "Brake pad wear alert" },
                { bus: "WP-4412", issue: "Engine overheating risk" },
              ].map((alert, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.1)",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <span>⚠️</span>
                  <div>
                    <p
                      style={{ margin: 0, fontSize: "13px", fontWeight: "700" }}
                    >
                      {alert.bus}
                    </p>
                    <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>
                      {alert.issue}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button
              style={{
                backgroundColor: "#F59E0B",
                color: "#1E293B",
                border: "none",
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                fontWeight: "700",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Review Alerts
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
