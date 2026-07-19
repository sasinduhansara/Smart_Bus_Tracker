import type { BusLocation } from '../types';

export interface BusDisplayCoordinate {
  latitude: number;
  longitude: number;
}

export function getBusDisplayCoordinate(
  bus: BusLocation,
): BusDisplayCoordinate {
  const latitude = bus.displayLatitude;
  const longitude = bus.displayLongitude;

  if (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude)
  ) {
    return { latitude, longitude };
  }

  return { latitude: bus.lat, longitude: bus.lng };
}

export function formatBusDirection(direction?: string): string {
  if (!direction) {
    return 'Direction unavailable';
  }

  return direction
    .split('_to_')
    .map(value => value.split('_').join(' '))
    .join(' → ');
}
