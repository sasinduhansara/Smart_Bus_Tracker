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
  /*
   * Live socket updates always update lat/lng.
   *
   * displayLatitude/displayLongitude may come from an older REST snapshot
   * and can remain unchanged when a new socket location arrives.
   *
   * Therefore, current live lat/lng must be used first so the bus marker
   * moves immediately on the passenger map.
   */
  const liveCoordinate = {
    latitude: bus.lat,
    longitude: bus.lng,
  };

  if (isValidMapCoordinate(liveCoordinate)) {
    return liveCoordinate;
  }

  /*
   * Fallback for old records that contain only display coordinates.
   */
  const displayCoordinate = {
    latitude: bus.displayLatitude,
    longitude: bus.displayLongitude,
  };

  return isValidMapCoordinate(displayCoordinate) ? displayCoordinate : null;
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
