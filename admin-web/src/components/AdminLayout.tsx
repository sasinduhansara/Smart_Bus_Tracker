import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  navbarRightContent?: React.ReactNode;
}

export default function AdminLayout({
  children,
  title,
  showSearch = true,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  navbarRightContent,
}: AdminLayoutProps) {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth <= 768;

  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        maxWidth: "100vw",
        margin: 0,
        padding: 0,
        backgroundColor: "#F3F4F6",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: "hidden",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      {/* Mobile Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 999,
          }}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isMobile={isMobile}
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Workspace */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          width: isMobile ? "100vw" : "calc(100vw - 240px)",
        }}
      >
        {/* Top Navbar */}
        <Navbar
          isMobile={isMobile}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          title={title}
          showSearch={showSearch}
          searchPlaceholder={searchPlaceholder}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          rightContent={navbarRightContent}
        />

        {/* Main Content Area */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            width: "100%",
          }}
        >
          {children}
        </main>

        {/* Footer */}
        <footer
          style={{
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderTop: "1px solid #E5E7EB",
            backgroundColor: "#FFFFFF",
            fontSize: "11px",
            color: "#9CA3AF",
            fontWeight: "500",
            flexShrink: 0,
            width: "100%",
          }}
        >
          © 2026 GamanaLK Transit Management System. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
}
