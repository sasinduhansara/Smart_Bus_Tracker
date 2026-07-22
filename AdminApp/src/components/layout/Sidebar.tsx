import { BusFront, LogOut } from "lucide-react";

import { NAV_ITEMS } from "../../navigation/navItems";
import type { AdminSession, Metrics, Page } from "../../types";
import { getInitials } from "../../utils/text";

interface SidebarProps {
  session: AdminSession;
  page: Page;
  metrics: Metrics | null;
  open: boolean;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export function Sidebar({
  session,
  page,
  metrics,
  open,
  onNavigate,
  onLogout,
}: SidebarProps) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="side-brand">
        <span className="brand-mark small">
          <BusFront size={19} />
        </span>

        <span>
          <strong>
            BusTrack <em>LK</em>
          </strong>
          <small>Admin console</small>
        </span>
      </div>

      <nav aria-label="Admin navigation">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={page === id ? "selected" : ""}
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} />
            {label}
            {id === "drivers" && metrics?.pendingDrivers ? (
              <b>{metrics.pendingDrivers}</b>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="admin-profile">
          <span className="avatar">{getInitials(session.admin.email)}</span>
          <span>
            <strong>Administrator</strong>
            <small>{session.admin.email}</small>
          </span>
        </div>

        <button type="button" className="logout-button" onClick={onLogout}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
