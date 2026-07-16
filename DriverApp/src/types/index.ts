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
  password?: string;
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
  status: 'live' | 'waiting' | 'unavailable';
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

export interface OTPResponse {
  status: string;
  mobile: string;
  sms_result?: unknown;
}

export interface RegistrationAvailabilityResponse {
  available: boolean;
  conflicts: Partial<Record<'mobile' | 'email' | 'nic', string>>;
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
