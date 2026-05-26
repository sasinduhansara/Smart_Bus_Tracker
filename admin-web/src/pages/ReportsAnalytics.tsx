import AdminLayout from "../components/AdminLayout";

export default function ReportsAnalytics() {
  return (
    <AdminLayout
      title="Reports & Analytics"
      navbarRightContent={
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              padding: "8px 14px",
              backgroundColor: "#FFFFFF",
              fontSize: "13px",
              fontWeight: "600",
              color: "#475569",
              cursor: "pointer",
            }}
          >
            📅 Oct 1, 2023 - Oct 31, 2023 🔽
          </div>
          <button
            style={{
              backgroundColor: "#00468C",
              color: "white",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              fontWeight: "700",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            📄 Export as PDF
          </button>
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
        }}
      >
        {/* 📈 1. TOP THREE STAT CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
          }}
        >
          {[
            {
              label: "TOTAL TRIPS",
              value: "1,482",
              trend: "📈 +12.5% from last month",
              trendColor: "#16A34A",
              icon: "🔀",
              iconBg: "#EEF2F6",
            },
            {
              label: "AVG. ETA ACCURACY",
              value: "94.2%",
              trend: "📈 +2.1% from last month",
              trendColor: "#16A34A",
              icon: "⏱",
              iconBg: "#FEF3C7",
            },
            {
              label: "MOST USED ROUTE",
              value: "138-Mahama...",
              trend: "High traffic density observed",
              trendColor: "#64748B",
              icon: "📍",
              iconBg: "#DCFCE7",
            },
          ].map((card, i) => (
            <div
              key={i}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "14px",
                padding: "20px",
                position: "relative",
                boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "11px",
                  color: "#64748B",
                  fontWeight: "700",
                }}
              >
                {card.label}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "36px",
                  fontWeight: "800",
                  color: "#1E293B",
                }}
              >
                {card.value}
              </p>
              <span
                style={{
                  fontSize: "12px",
                  color: card.trendColor,
                  fontWeight: "600",
                }}
              >
                {card.trend}
              </span>
              <span
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  fontSize: "20px",
                  backgroundColor: card.iconBg,
                  padding: "6px",
                  borderRadius: "8px",
                }}
              >
                {card.icon}
              </span>
            </div>
          ))}
        </div>

        {/* 📊 2. MIDDLE ROW — Daily Passenger + Fleet Donut */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
          }}
        >
          {/* Daily Passenger Chart */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#1E293B",
                }}
              >
                Daily Passenger Count
              </h3>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                <span style={{ color: "#0056B3" }}>● Current</span>
                <span style={{ color: "#94A3B8" }}>● Previous</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                height: "140px",
                gap: "10px",
                paddingBottom: "10px",
              }}
            >
              {[40, 60, 95, 80, 100, 75, 90, 85, 65].map((height, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    backgroundColor:
                      i === 4
                        ? "#00468C"
                        : i % 2 === 0
                          ? "#A2BDE2"
                          : "#5185C6",
                    height: `${height}%`,
                    borderRadius: "4px 4px 0 0",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Fleet Status Donut */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "15px",
                fontWeight: "700",
                color: "#1E293B",
              }}
            >
              Fleet Status
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                justifyContent: "space-around",
                flexWrap: "wrap",
              }}
            >
              {/* Donut */}
              <div
                style={{
                  width: "130px",
                  height: "130px",
                  borderRadius: "50%",
                  background:
                    "conic-gradient(#0056B3 0% 75%, #D97706 75% 88%, #DC2626 88% 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: "96px",
                    height: "96px",
                    background: "#FFFFFF",
                    borderRadius: "50%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <strong style={{ fontSize: "20px", color: "#1E293B" }}>
                    156
                  </strong>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#64748B",
                      fontWeight: "600",
                    }}
                  >
                    Buses
                  </span>
                </div>
              </div>
              {/* Legend */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  width: "100px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#0056B3" }}>● Active</span>{" "}
                  <strong>128</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#D97706" }}>● Maint.</span>{" "}
                  <strong>18</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#DC2626" }}>● Inactive</span>{" "}
                  <strong>10</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 📈 3. ROW TWO — Top 5 Routes + Monthly ETA Trend */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
          }}
        >
          {/* Top 5 Route Performance */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "24px",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "14px",
                fontWeight: "700",
                color: "#1E293B",
              }}
            >
              Top 5 Route Performance
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {[
                { label: "ROUTE 138 (MAHARAGAMA)", count: "8.2K", width: "95%" },
                { label: "ROUTE 120 (PILIYANDALA)", count: "7.4K", width: "85%" },
                { label: "ROUTE 154 (ANGODA)", count: "6.1K", width: "70%" },
                { label: "ROUTE 100 (PANADURA)", count: "5.8K", width: "65%" },
                { label: "ROUTE 177 (KADUWELA)", count: "4.2K", width: "45%" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#475569",
                    }}
                  >
                    <span>{item.label}</span>
                    <span>{item.count}</span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      backgroundColor: "#E2E8F0",
                      borderRadius: "4px",
                    }}
                  >
                    <div
                      style={{
                        height: "8px",
                        backgroundColor: "#0056B3",
                        borderRadius: "4px",
                        width: item.width,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly ETA Accuracy Trend */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "24px",
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
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#1E293B",
                }}
              >
                Monthly ETA Accuracy Trend
              </h3>
              <span
                style={{
                  backgroundColor: "#DCFCE7",
                  color: "#16A34A",
                  fontSize: "10px",
                  fontWeight: "700",
                  padding: "4px 8px",
                  borderRadius: "6px",
                }}
              >
                Improving
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                height: "130px",
                padding: "0 10px",
                gap: "16px",
              }}
            >
              {[
                { label: "Jun", val: "75%" },
                { label: "Jul", val: "88%" },
                { label: "Aug", val: "82%" },
                { label: "Sep", val: "91%" },
                { label: "Oct", val: "96%", active: true },
              ].map((m, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: m.val,
                      backgroundColor: m.active ? "#F59E0B" : "#FDE68A",
                      borderRadius: "4px 4px 0 0",
                      border: m.active ? "1px solid #D97706" : "none",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#64748B",
                      fontWeight: "600",
                    }}
                  >
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 🚌 4. BOTTOM ROUTE OPTIMIZATION BANNER */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "14px",
            padding: "24px",
            display: "flex",
            gap: "24px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: "200px",
              height: "110px",
              borderRadius: "10px",
              backgroundColor: "#334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "36px",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            🚌
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <h4
              style={{
                margin: "0 0 6px 0",
                fontSize: "16px",
                fontWeight: "800",
                color: "#1E293B",
              }}
            >
              Route Optimization Suggestion
            </h4>
            <p
              style={{
                margin: "0 0 16px 0",
                fontSize: "13px",
                color: "#475569",
                lineHeight: "1.5",
              }}
            >
              Based on our analytical model for October, Route 138 is
              experiencing consistent 15% delays during the 5:00 PM - 7:00 PM
              peak window. We recommend re-allocating 2 standby buses from the
              Kaduwela corridor to Maharagama to maintain ETA accuracy above
              90%.
            </p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                style={{
                  backgroundColor: "#F59E0B",
                  color: "#1E293B",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Apply Optimization
              </button>
              <button
                style={{
                  backgroundColor: "white",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Review Detailed Logistics
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
