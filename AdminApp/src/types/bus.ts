export type BusRecordStatus = "active" | "inactive" | "maintenance";

export interface Depot {
  id: string;
  name: string;
  code: string;
  district?: string;
  address?: string;
  contactPhone?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Bus {
  id: string;
  busId: string;
  vehicleRegistrationNumber?: string;
  ntcPermitNumber?: string;
  depotId?: string;
  depotName?: string;
  make?: string;
  model?: string;
  manufactureYear?: number | null;
  seatingCapacity?: number | null;
  recordStatus: BusRecordStatus | string;
  notes?: string;
  routeNumber: string;
  driverId: string;
  operationalStatus: string;
  isActive: boolean;
  activeTripId?: string;
  lat?: number | null;
  lng?: number | null;
  speed?: number | null;
  heading?: number | null;
  statusUpdatedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BusInput {
  vehicleRegistrationNumber: string;
  ntcPermitNumber?: string;
  depotId: string;
  make?: string;
  model?: string;
  manufactureYear?: number | null;
  seatingCapacity?: number | null;
  recordStatus: BusRecordStatus;
  notes?: string;
}

export interface DepotInput {
  name: string;
  code: string;
  district?: string;
  address?: string;
  contactPhone?: string;
  isActive: boolean;
}
