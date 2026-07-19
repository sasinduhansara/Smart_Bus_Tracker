export type VerificationStatus =
  | 'pending'
  | 'approved'
  | 'verified'
  | 'blocked'
  | 'rejected'
  | 'unverified'
  | 'under_review';

export type KycStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

export interface DocumentRef {
  fileName: string;
  url: string;
  mimeType: string;
  originalFileName?: string;
}

export interface DriverDocuments {
  nicFront?: DocumentRef;
  nicBack?: DocumentRef;
  drivingLicenseFront?: DocumentRef;
  drivingLicenseBack?: DocumentRef;
}

export interface Driver {
  _id?: string;
  driver_id?: string;
  fullName: string;
  nic: string;
  mobile: string;
  email: string;
  conductorName: string;
  driverNtcRegistrationNumber: string;
  busNtcPermitNumber: string;
  drivingLicenseNumber: string;
  drivingLicenseExpiry: string;
  busRouteNumber: string;
  vehicleRegistrationNumber: string;
  depotOperator: string;
  verificationStatus: VerificationStatus;
  kycStatus: KycStatus;
  documents?: DriverDocuments;
  createdAt: string;
}

export type DriverSession = Partial<Driver> & {
  driver_id: string;
  fullName: string;
  mobile: string;
  verificationStatus: VerificationStatus;
};

export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: number;
  driver: DriverSession;
}

export interface DriverHomeVehicle {
  number: string;
  route: string;
  depotOperator: string;
  serviceStatus: string;
}

export interface DriverHomeShift {
  status: 'on_duty' | 'off_duty';
  label: string;
  summary: string;
  startedAt: string;
  activeSeconds: number;
}

export interface DriverHomeTracking {
  status: 'live' | 'paused' | 'waiting' | 'unavailable' | 'offline';
  label: string;
  message: string;
  lastUpdatedAt: string;
  lat: number | null;
  lng: number | null;
}

export interface DriverHomeStats {
  totalTrips: number;
  totalDistanceKm: number;
  activeSeconds: number;
  activeHoursLabel: string;
  notifications: number;
}

export interface DriverHomeTrip {
  id: string;
  from: string;
  to: string;
  time: string;
  distance: string;
  passengers: number;
  status: string;
}

export interface DriverHomeResponse {
  driver: Driver;
  vehicle: DriverHomeVehicle;
  shift: DriverHomeShift;
  tracking: DriverHomeTracking;
  stats: DriverHomeStats;
  recentTrips: DriverHomeTrip[];
}

export interface DriverNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface DriverNotificationsResponse {
  status: string;
  notifications: DriverNotification[];
}

export type ServerTripStatus = 'active' | 'paused' | 'completed';

export interface TripLocation {
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
  heading?: number;
  accuracy: number;
}

export interface DriverTrip {
  id: string;
  driverId: string;
  busId: string;
  vehicleRegistrationNumber: string;
  routeNumber: string;
  routeName?: string;
  origin: string;
  destination: string;
  status: ServerTripStatus;
  startedAt: string;
  pausedAt?: string;
  resumedAt?: string;
  completedAt?: string;
  durationSeconds: number;
  activeDurationSeconds: number;
  pausedDurationSeconds?: number;
  distanceKm: number;
  lastLocation?: TripLocation;
  startTerminalId?: string;
  startTerminalName?: string;
  destinationTerminalId?: string;
  destinationTerminalName?: string;
  direction?: string;
  startLatitude?: number;
  startLongitude?: number;
  startAccuracy?: number;
}

export interface ActiveTripResponse {
  status: 'success';
  trip: DriverTrip | null;
}

export interface TripHistoryResponse {
  status: 'success';
  trips: DriverTrip[];
}

export interface TripMutationResponse {
  status: 'started' | 'paused' | 'resumed' | 'completed';
  trip: DriverTrip;
  bus: LiveBusLocation;
}

export interface TripReadinessTerminal {
  id: string;
  name: string;
  distanceMeters: number;
  remainingDistanceMeters: number;
  allowedRadiusMeters: number;
}

export interface TripReadinessResponse {
  success: true;
  routeNumber: string;
  locationFresh: boolean;
  accuracyAcceptable: boolean;
  canStart: boolean;
  nearestTerminal: TripReadinessTerminal;
  direction: {
    value: string;
    origin: string;
    destination: string;
  } | null;
  code: 'READY_TO_START' | 'OUTSIDE_START_GEOFENCE';
  message: string;
}

export interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

export interface DriverRouteStop extends CoordinatePoint {
  id: string;
  name: string;
  sequence: number;
}

export interface DriverRouteTerminal extends CoordinatePoint {
  id: string;
  name: string;
  startRadiusMeters: number;
}

export interface DriverRouteDetails {
  routeNumber: string;
  name: string;
  direction: string;
  polyline: CoordinatePoint[];
  stops: DriverRouteStop[];
  terminals?: DriverRouteTerminal[];
}

export interface RouteDetailsResponse {
  status: 'success';
  route: DriverRouteDetails;
}

export interface EtaStopSummary {
  id: string;
  name: string;
}

export interface DriverEtaResponse {
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

export type IssueCategory =
  | 'vehicle_breakdown'
  | 'route_obstruction'
  | 'traffic_delay'
  | 'accident'
  | 'passenger_emergency'
  | 'technical_issue'
  | 'gps_problem';

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DriverIssueResponse {
  status: 'reported';
  issue: {
    id: string;
    category: IssueCategory;
    severity: IssueSeverity;
    status: string;
    createdAt: string;
  };
}

export interface LiveBusLocation {
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
  operationalStatus: 'active' | 'paused' | 'offline';
  isActive: boolean;
}

export interface OTPResponse {
  status: string;
  mobile: string;
  sms_result?: unknown;
}

export interface RegistrationAvailabilityResponse {
  available: boolean;
  conflicts: Partial<
    Record<'mobile' | 'email' | 'nic' | 'vehicleRegistrationNumber', string>
  >;
}

export interface DocumentUploadResponse {
  status: 'uploaded';
  docType: string;
  url: string;
  fileName: string;
  mimeType: string;
  document: DocumentRef;
}

export interface VerifyOTPResponse {
  status: string;
  driver_id: string;
  mobile: string;
  fullName: string;
  verificationStatus: VerificationStatus;
  accessToken?: string;
  tokenType?: 'Bearer';
  expiresInSeconds?: number;
}
