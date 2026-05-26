interface NavbarProps {
  isMobile: boolean;
  onToggleMobileMenu: () => void;
  title?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  rightContent?: React.ReactNode;
}

export default function Navbar({
  isMobile,
  onToggleMobileMenu,
  title,
  showSearch = true,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  rightContent,
}: NavbarProps) {
  return (
    <header
      style={{
        height: "56px",
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #E5E7EB",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
      }}
    >
      {/* Left Side */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {isMobile && (
          <button
            onClick={onToggleMobileMenu}
            style={{
              background: "none",
              border: "none",
              fontSize: "22px",
              cursor: "pointer",
              color: "#00468C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
            }}
          >
            ☰
          </button>
        )}

        {title && (
          <h2
            style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "#111827",
              margin: 0,
            }}
          >
            {title}
          </h2>
        )}

        {showSearch && (
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span
              style={{
                position: "absolute",
                left: "12px",
                fontSize: "12px",
                color: "#9CA3AF",
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              style={{
                width: isMobile ? "160px" : "280px",
                padding: "6px 12px 6px 34px",
                backgroundColor: "#F9FAFB",
                border: "1px solid #E5E7EB",
                borderRadius: "20px",
                fontSize: "12px",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#00468C";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E5E7EB";
              }}
            />
          </div>
        )}
      </div>

      {/* Right Side */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Custom right content if provided */}
        {rightContent}

        {/* Notification Bell */}
        <button
          style={{
            background: "none",
            border: "none",
            fontSize: "15px",
            cursor: "pointer",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px",
            borderRadius: "50%",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#F3F4F6";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          🔔
          <span
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              width: "5px",
              height: "5px",
              backgroundColor: "#EF4444",
              borderRadius: "50%",
            }}
          ></span>
        </button>

        {/* Help Icon */}
        <button
          style={{
            background: "none",
            border: "none",
            fontSize: "15px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px",
            borderRadius: "50%",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#F3F4F6";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          ❓
        </button>

        {/* User Profile */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderLeft: "1px solid #E5E7EB",
            paddingLeft: "14px",
          }}
        >
          {!isMobile && (
            <div style={{ textAlign: "right" }}>
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#111827",
                  margin: 0,
                  lineHeight: "1.2",
                }}
              >
                Admin User
              </p>
              <p
                style={{
                  fontSize: "10px",
                  color: "#6B7280",
                  margin: 0,
                  lineHeight: "1.2",
                }}
              >
                Fleet Manager
              </p>
            </div>
          )}
          <div
            style={{
              width: "32px",
              height: "32px",
              backgroundColor: "#00468C",
              color: "#FFFFFF",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
              userSelect: "none",
            }}
            title="Admin User"
          >
            AM
          </div>
        </div>
      </div>
    </header>
  );
}
