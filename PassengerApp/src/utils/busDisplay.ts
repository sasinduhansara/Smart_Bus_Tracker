import type { BusLocation } from '../types';

export interface BusDisplayCoordinate {
  latitude: number;
  longitude: number;
}

export function isValidMapCoordinate(
  coordinate: Partial<BusDisplayCoordinate> | null | undefined,
): coordinate is BusDisplayCoordinate {
  return (
    typeof coordinate?.latitude === 'number' &&
    Number.isFinite(coordinate.latitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    typeof coordinate.longitude === 'number' &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

export function getBusDisplayCoordinate(
  bus: BusLocation,
): BusDisplayCoordinate | null {
  const latitude = bus.displayLatitude;
  const longitude = bus.displayLongitude;

  const displayCoordinate = { latitude, longitude };

  if (isValidMapCoordinate(displayCoordinate)) {
    return displayCoordinate;
  }

  const rawCoordinate = { latitude: bus.lat, longitude: bus.lng };
  return isValidMapCoordinate(rawCoordinate) ? rawCoordinate : null;
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
