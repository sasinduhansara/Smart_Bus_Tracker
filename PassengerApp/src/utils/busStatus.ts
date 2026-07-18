import type { BusLiveStatus, BusLocation } from '../types';

export function getBusStatus(
  bus: BusLocation,
  now: number,
): BusLiveStatus {
  if (bus.operationalStatus === 'paused') {
    return 'paused';
  }

  if (bus.operationalStatus === 'offline' || bus.isActive === false) {
    return 'offline';
  }

  if (!bus.updatedAt) {
    return 'offline';
  }

  const updatedAt = new Date(bus.updatedAt).getTime();

  if (!Number.isFinite(updatedAt)) {
    return 'offline';
  }

  const ageSeconds = (now - updatedAt) / 1000;

  if (ageSeconds < -30) {
    return 'offline';
  }

  if (ageSeconds <= 30) {
    return 'live';
  }

  if (ageSeconds <= 120) {
    return 'stale';
  }

  return 'offline';
}

export function formatLastUpdated(value?: string): string {
  if (!value) {
    return 'No timestamp';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadiusKm = 6371;
  const deltaLatitude = ((latitudeB - latitudeA) * Math.PI) / 180;
  const deltaLongitude = ((longitudeB - longitudeA) * Math.PI) / 180;
  const startLatitude = (latitudeA * Math.PI) / 180;
  const endLatitude = (latitudeB * Math.PI) / 180;
  const value =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);
  const centralAngle = 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));

  return earthRadiusKm * centralAngle;
}
