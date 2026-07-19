export interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

export type BusOperationalStatus = 'active' | 'paused' | 'offline';

export interface BusLocationUpdate {
  bus_id: string;
  vehicleRegistrationNumber?: string;
  routeNumber?: string;
  lat?: number;
  lng?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  rawLatitude?: number;
  rawLongitude?: number;
  displayLatitude?: number;
  displayLongitude?: number;
  distanceFromRouteMeters?: number;
  isRouteDeviation?: boolean;
  direction?: string;
  updatedAt?: string;
  statusUpdatedAt?: string;
  tripId?: string;
  activeTripId?: string;
  isActive?: boolean;
  operationalStatus?: BusOperationalStatus;
}

export interface BusLocation extends BusLocationUpdate {
  lat: number;
  lng: number;
}

export type BusLiveStatus = 'live' | 'paused' | 'stale' | 'offline';

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

export interface RouteStopsResponse {
  status: 'success';
  routeNumber: string;
  stops: BusStop[];
}

export type PassengerSearchResultType = 'route' | 'stop';

export interface PassengerSearchResult {
  id: string;
  type: PassengerSearchResultType;
  title: string;
  subtitle: string;
  routeNumber: string;
  stopId?: string;
}

export interface PassengerSearchResponse {
  status: 'success';
  query: string;
  results: PassengerSearchResult[];
}

export interface SavedStop {
  id: string;
  routeNumber: string;
  stopId: string;
  name: string;
  savedAt: string;
}

export interface RecentTrip {
  id: string;
  routeNumber: string;
  destinationName: string;
  destinationStopId?: string;
  originName?: string;
  viewedAt: string;
}

export interface RecentSearch {
  id: string;
  type: PassengerSearchResultType;
  title: string;
  subtitle: string;
  routeNumber: string;
  stopId?: string;
  searchedAt: string;
}

export interface NearbyBus {
  bus: BusLocation;
  routeName?: string;
  destinationName?: string;
  nextStop?: BusStop;
  nextStopIsCanonical?: boolean;
  distanceKm?: number;
  status: BusLiveStatus;
  eta?: EtaPredictionResponse;
  etaUpdatedAt?: number;
  etaIsStale?: boolean;
  etaLoading: boolean;
}
