import { useState } from "react";
import type { ReactNode } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { AdminSession, Metrics, Page } from "../../types";

interface AdminLayoutProps {
  children: ReactNode;
  session: AdminSession;
  page: Page;
  metrics: Metrics | null;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export function AdminLayout({
  children,
  session,
  page,
  metrics,
  onNavigate,
  onLogout,
}: AdminLayoutProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  const navigate = (nextPage: Page) => {
    onNavigate(nextPage);
    setMobileNavigationOpen(false);
  };

  return (
    <div className="app-shell">
      <Sidebar
        session={session}
        page={page}
        metrics={metrics}
        open={mobileNavigationOpen}
        onNavigate={navigate}
        onLogout={onLogout}
      />

      <div className="main-area">
        <Topbar
          page={page}
          session={session}
          onToggleNavigation={() =>
            setMobileNavigationOpen((currentValue) => !currentValue)
          }
        />

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
