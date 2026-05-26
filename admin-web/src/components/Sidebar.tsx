import { useLocation, useNavigate } from "react-router-dom";

interface SidebarProps {
  isMobile: boolean;
  isMobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
}

const menuItems = [
  { name: "Dashboard", path: "/dashboard", icon: "📊" },
  { name: "Bus Management", path: "/bus-management", icon: "🚌" },
  { name: "Bus Registration", path: "/bus-registration", icon: "📝" },
  { name: "Driver Management", path: "/driver-management", icon: "👨‍✈️" },
  { name: "Route Management", path: "/route-management", icon: "🗺️" },
  { name: "Live Tracking", path: "/live-tracking", icon: "📍" },
  { name: "Alerts", path: "/alerts", icon: "⚠️" },
  { name: "Reports", path: "/reports", icon: "📈" },
  { name: "Settings", path: "/settings", icon: "⚙️" },
];

export default function Sidebar({
  isMobile,
  isMobileMenuOpen,
  onMobileMenuClose,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) onMobileMenuClose();
  };

  const sidebarStyle: React.CSSProperties = {
    width: "240px",
    backgroundColor: "#FFFFFF",
    borderRight: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100vh",
    flexShrink: 0,
    position: isMobile ? "fixed" : "relative",
    left: isMobile ? (isMobileMenuOpen ? "0" : "-240px") : "0",
    zIndex: isMobile ? 1000 : 1,
    transition: "left 0.3s ease",
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside style={sidebarStyle}>
      {/* Brand Header */}
      <div>
        <div style={{ padding: "16px", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#00468C" />
              <path
                d="M17 14.5V7C17 5.5 15.5 4 14 4H10C8.5 4 7 5.5 7 7V14.5C7 15.5 7.5 16.5 8.5 17L7.5 18.5H9L10 17H14l1 1.5h1.5l-1-1.5c1-.5 1.5-1.5 1.5-2.5ZM10 6h4v2h-4V6Zm-1.5 7.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1Zm7 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1ZM15.5 10h-7V9h7v1Z"
                fill="white"
              />
            </svg>
            <h1
              style={{
                fontSize: "18px",
                fontWeight: "800",
                color: "#00468C",
                margin: 0,
              }}
            >
              GamanaLK
            </h1>
          </div>
          <p
            style={{
              fontSize: "9px",
              fontWeight: "700",
              color: "#9CA3AF",
              letterSpacing: "1px",
              margin: "2px 0 0 0",
            }}
          >
            RELIABILITY IN MOTION
          </p>
        </div>

        {/* Navigation Items */}
        <nav
          style={{
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {menuItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  backgroundColor: active ? "#00468C" : "transparent",
                  color: active ? "#FFFFFF" : "#4B5563",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  textAlign: "left",
                  width: "100%",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = "#F3F4F6";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div style={{ padding: "12px", borderTop: "1px solid #F3F4F6" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            fontWeight: "600",
            color: "#059669",
            backgroundColor: "#ECFDF5",
            padding: "6px 10px",
            borderRadius: "6px",
            width: "fit-content",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              backgroundColor: "#10B981",
              borderRadius: "50%",
              display: "inline-block",
            }}
          ></span>
          <span>System: Active</span>
        </div>
      </div>
    </aside>
  );
}
