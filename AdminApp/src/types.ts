export type Page = "overview" | "drivers" | "buses" | "trips" | "issues" | "routes";

export interface AdminSession {
  accessToken: string;
  admin: { email: string; role: string };
}

export interface Metrics {
  drivers: number;
  pendingDrivers: number;
  approvedDrivers: number;
  buses: number;
  activeBuses: number;
  pausedBuses: number;
  activeTrips: number;
  openIssues: number;
}

export interface Driver {
  _id: string;
  fullName: string;
  email: string;
  mobile: string;
  nic: string;
  busRouteNumber: string;
  vehicleRegistrationNumber: string;
  verificationStatus: string;
  kycStatus: string;
  documents: Record<string, { fileName?: string; url?: string }>;
  createdAt: string;
}

export interface Bus {
  id: string;
  busId: string;
  routeNumber: string;
  driverId: string;
  operationalStatus: string;
  isActive: boolean;
  lat?: number;
  lng?: number;
  speed?: number;
  statusUpdatedAt: string;
}

export interface Trip {
  id: string;
  driverId: string;
  busId: string;
  routeNumber: string;
  routeName: string;
  origin: string;
  destination: string;
  status: string;
  startedAt: string;
  durationSeconds: number;
  distanceKm: number;
}

export interface Issue {
  id: string;
  driverId: string;
  driverName: string;
  busId: string;
  routeNumber: string;
  category: string;
  severity: string;
  message: string;
  status: string;
  resolutionNote: string;
  createdAt: string;
}

export interface RouteSummary {
  routeNumber: string;
  name: string;
  direction: string;
  stopCount: number;
}
