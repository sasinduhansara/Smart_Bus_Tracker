export type ServiceType = "sltb" | "private" | "intercity";
export type ScheduleRecordStatus = "active" | "inactive";
export type DailyServiceStatus =
  | "scheduled"
  | "cancelled"
  | "in_progress"
  | "completed";

export type OperatingDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface ScheduleTemplate {
  id: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  origin: string;
  destination: string;
  depotName: string;
  serviceType: ServiceType;
  departureTime: string;
  operatingDays: OperatingDay[];
  recordStatus: ScheduleRecordStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleTemplateInput {
  routeId: string;
  serviceType: ServiceType;
  departureTime: string;
  operatingDays: OperatingDay[];
  recordStatus: ScheduleRecordStatus;
  notes?: string;
}

export interface DailyService {
  id: string;
  scheduleTemplateId: string;
  serviceDate: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  origin: string;
  destination: string;
  depotName: string;
  serviceType: ServiceType;
  departureTime: string;
  busId: string;
  busRegistration: string;
  operatorName: string;
  busDepotName: string;
  driverId: string;
  driverName: string;
  driverNtcRegistrationNumber: string;
  status: DailyServiceStatus;
  notes: string;
  tripId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyServiceInput {
  scheduleTemplateId: string;
  serviceDate: string;
  busId: string;
  driverId: string;
  status: "scheduled" | "cancelled";
  notes?: string;
}

export interface SchedulingRouteReference {
  id: string;
  routeNumber: string;
  name: string;
  origin: string;
  destination: string;
  depotName: string;
  serviceCategories: ServiceType[];
}

export interface SchedulingBusReference {
  id: string;
  registration: string;
  operatorName: string;
  depotName: string;
}

export interface SchedulingDriverReference {
  id: string;
  fullName: string;
  driverNtcRegistrationNumber: string;
  drivingLicenseExpiry: string;
}

export interface SchedulingReferences {
  routes: SchedulingRouteReference[];
  templates: ScheduleTemplate[];
  buses: SchedulingBusReference[];
  drivers: SchedulingDriverReference[];
  operatingDays: OperatingDay[];
  serviceTypes: ServiceType[];
}
