import { Menu } from "lucide-react";

import { NAV_ITEMS } from "../../navigation/navItems";
import type { AdminSession, Page } from "../../types";
import { getInitials } from "../../utils/text";

interface TopbarProps {
  page: Page;
  session: AdminSession;
  onToggleNavigation: () => void;
}

export function Topbar({ page, session, onToggleNavigation }: TopbarProps) {
  const activeItem = NAV_ITEMS.find((item) => item.id === page) ?? NAV_ITEMS[0];

  return (
    <header className="topbar">
      <button
        type="button"
        className="mobile-menu"
        onClick={onToggleNavigation}
        aria-label="Toggle navigation"
      >
        <Menu size={21} />
      </button>

      <div>
        <p className="topbar-kicker">{activeItem.label}</p>
        <span className="topbar-status">
          <i /> API connected
        </span>
      </div>

      <div className="topbar-right">
        <span className="date-label">
          {new Date().toLocaleDateString("en-LK", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </span>
        <span className="top-avatar">{getInitials(session.admin.email)}</span>
      </div>
    </header>
  );
}
