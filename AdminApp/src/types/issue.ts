export interface Issue {
  id: string;
  driverId: string;
  driverName: string;
  busId: string;
  routeNumber: string;
  tripId?: string;
  category: string;
  severity: string;
  message: string;
  status: string;
  resolutionNote: string;
  createdAt: string;
  updatedAt?: string;
}
