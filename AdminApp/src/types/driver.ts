export const DRIVER_DOCUMENT_TYPES = [
  "nicFront",
  "nicBack",
  "drivingLicenseFront",
  "drivingLicenseBack",
] as const;

export type DriverDocumentType = (typeof DRIVER_DOCUMENT_TYPES)[number];

export type DriverCorrectionField = DriverDocumentType;

export type DriverVerificationStatus =
  | "pending"
  | "under_review"
  | "correction_required"
  | "approved"
  | "verified"
  | "rejected"
  | "blocked"
  | "unverified";

export type DriverKycStatus =
  | "NOT_SUBMITTED"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CORRECTION_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | string;

export interface DriverDocument {
  fileName?: string;
  url?: string;
  mimeType?: string;
  originalFileName?: string;
}

export interface Driver {
  _id: string;
  driver_id?: string;
  fullName: string;
  email: string;
  mobile: string;
  nic: string;
  driverNtcRegistrationNumber: string;
  drivingLicenseNumber: string;
  drivingLicenseExpiry: string;
  depotOperator?: string;
  verificationStatus: DriverVerificationStatus | string;
  kycStatus: DriverKycStatus;
  kycRevision?: number;
  documents: Partial<Record<DriverDocumentType, DriverDocument>>;
  correctionFields?: DriverCorrectionField[];
  correctionMessage?: string;
  rejectionReason?: string;
  blockReason?: string;
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  blockedAt?: string;
  blockedBy?: string;
  correctionRequestedAt?: string;
  correctionRequestedBy?: string;
}

export interface DriverDetailResponse {
  status: string;
  driver: Driver;
}

export interface DriverActionResponse {
  status: string;
  driver_id: string;
  reason?: string;
  fields?: DriverCorrectionField[];
  message?: string;
}
