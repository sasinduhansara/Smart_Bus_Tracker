import {
  Activity,
  AlertTriangle,
  BusFront,
  CalendarClock,
  ClipboardCheck,
  LayoutDashboard,
  Map,
  Users,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

export type Page =
  | "overview"
  | "liveMonitor"
  | "drivers"
  | "busRequests"
  | "buses"
  | "routes"
  | "schedules"
  | "trips"
  | "issues";

export interface NavigationItem {
  id: Page;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavigationItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    id: "liveMonitor",
    label: "OSM Live Map",
    icon: Map,
  },
  {
    id: "drivers",
    label: "Driver approvals",
    icon: Users,
  },
  {
    id: "busRequests",
    label: "Bus requests",
    icon: ClipboardCheck,
  },
  {
    id: "buses",
    label: "Live fleet",
    icon: BusFront,
  },
  {
    id: "routes",
    label: "Routes & stops",
    icon: Map,
  },
  {
    id: "schedules",
    label: "Timetable & roster",
    icon: CalendarClock,
  },
  {
    id: "trips",
    label: "Trip activity",
    icon: Activity,
  },
  {
    id: "issues",
    label: "Issue reports",
    icon: AlertTriangle,
  },
];
