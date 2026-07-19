export type RegistrationPurpose = 'register' | 'login';

export interface DocumentFile {
  uri: string;
  fileName: string;
  type?: string;
  url?: string;
  storagePath?: string;
  mimeType?: string;
  uploaded?: boolean;
}

export interface UploadedDocumentRef {
  fileName: string;
  url: string;
  mimeType: string;
  originalFileName?: string;
}

export type RegistrationDocumentKey =
  | 'nicFront'
  | 'nicBack'
  | 'drivingLicenseFront'
  | 'drivingLicenseBack';

export interface DriverRegistrationForm {
  fullName: string;
  nic: string;
  mobile: string;
  email: string;
  password: string;
  driverNtcRegistrationNumber: string;
  drivingLicenseNumber: string;
  drivingLicenseExpiry: string;
  depotOperator: string;
  nicFront?: DocumentFile;
  nicBack?: DocumentFile;
  drivingLicenseFront?: DocumentFile;
  drivingLicenseBack?: DocumentFile;
  currentStep: number;
}

export type DriverRegistrationTextField = Exclude<
  keyof DriverRegistrationForm,
  RegistrationDocumentKey | 'currentStep'
>;

export type RegistrationErrors = Partial<
  Record<DriverRegistrationTextField | 'confirmation', string>
>;

export type RegistrationAvailabilityField = 'nic' | 'mobile' | 'email';

export type RegistrationAvailabilityState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'conflict'
  | 'error';

export type RegistrationAvailabilityStates = Record<
  RegistrationAvailabilityField,
  RegistrationAvailabilityState
>;

export interface DriverRegistrationPayload {
  fullName: string;
  nic: string;
  mobile: string;
  email: string;
  password: string;
  driverNtcRegistrationNumber: string;
  drivingLicenseNumber: string;
  drivingLicenseExpiry: string;
  depotOperator?: string;
  documents: Partial<
    Record<RegistrationDocumentKey, UploadedDocumentRef | null>
  >;
  kycStatus: 'NOT_SUBMITTED';
}
