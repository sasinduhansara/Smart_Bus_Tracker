export type RouteDirection = "outbound" | "return";
export type RouteRecordStatus = "active" | "inactive";
export type RouteServiceCategory = "sltb" | "private" | "ac" | "intercity";

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteStop {
  id?: string;
  name: string;
  sequence: number;
  latitude?: number;
  longitude?: number;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
}

export interface RouteTerminal extends RoutePoint {
  id: string;
  name: string;
  startRadiusMeters: number;
}

export interface RouteSummary {
  id: string;
  routeNumber: string;
  name: string;
  origin: string;
  destination: string;
  depotName: string;
  direction: RouteDirection;
  serviceCategories: RouteServiceCategory[];
  recordStatus: RouteRecordStatus;
  isActive: boolean;
  stopCount: number;
  updatedAt: string;
}

export interface RouteDetails extends RouteSummary {
  terminalRadiusMeters: number;
  polyline: RoutePoint[];
  geometry?: {
    type: "LineString";
    coordinates: [number, number][];
  };
  geometryVersion?: number;
  stops: RouteStop[];
  terminals: RouteTerminal[];
  createdAt: string;
}

export interface RouteStopInput {
  id?: string;
  name: string;
  latitude?: number;
  longitude?: number;
}

export interface RouteInput {
  routeNumber: string;
  name: string;
  depotName: string;
  serviceCategories: RouteServiceCategory[];
  recordStatus: RouteRecordStatus;
  stops: RouteStopInput[];
  direction?: RouteDirection;
  terminalRadiusMeters?: number;
  polyline?: RoutePoint[];
}
