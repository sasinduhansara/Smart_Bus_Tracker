export interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

export interface BusLocation {
  bus_id: string;
  vehicleRegistrationNumber?: string;
  routeNumber?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  updatedAt?: string;
}

export type BusLiveStatus = 'live' | 'stale' | 'offline';

export interface RouteSummary {
  routeNumber: string;
  name: string;
  direction: string;
  stopCount: number;
}

export interface BusStop extends CoordinatePoint {
  id: string;
  name: string;
  sequence: number;
}

export interface RouteDetails {
  routeNumber: string;
  name: string;
  direction: string;
  polyline: CoordinatePoint[];
  stops: BusStop[];
}

export interface EtaPredictionRequest {
  busId: string;
  routeNumber?: string;
  destinationStopId: string;
}

export interface EtaStopSummary {
  id: string;
  name: string;
}

export interface EtaPredictionResponse {
  status: 'success';
  busId: string;
  routeNumber: string;
  destinationStop: EtaStopSummary;
  nextStop: EtaStopSummary | null;
  etaMinutes: number;
  estimatedArrivalAt: string;
  remainingDistanceKm: number;
  modelVersion: string;
}

export type SocketConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';
