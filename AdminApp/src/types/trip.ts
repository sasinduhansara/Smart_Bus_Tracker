export interface Trip {
  id: string;
  driverId: string;
  busId: string;
  routeNumber: string;
  routeName: string;
  origin: string;
  destination: string;
  status: string;
  startedAt: string;
  durationSeconds: number;
  distanceKm: number;
}
