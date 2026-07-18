import * as Keychain from 'react-native-keychain';

import type { DriverTrip } from '../types';

const TRIP_SERVICE = 'lk.gamana.driver.active-trip';

let cachedTrip: DriverTrip | null = null;

function isDriverTrip(value: unknown): value is DriverTrip {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const trip = value as Partial<DriverTrip>;

  return Boolean(
    trip.id &&
      trip.driverId &&
      trip.busId &&
      trip.routeNumber &&
      (trip.status === 'active' || trip.status === 'paused'),
  );
}

export async function saveActiveTrip(trip: DriverTrip): Promise<void> {
  cachedTrip = trip;

  try {
    await Keychain.setGenericPassword(trip.driverId, JSON.stringify(trip), {
      service: TRIP_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    // The backend remains authoritative; an in-memory fallback is safe here.
  }
}

export async function loadActiveTrip(
  expectedDriverId: string,
): Promise<DriverTrip | null> {
  const normalizedDriverId = expectedDriverId.trim();

  if (!normalizedDriverId) {
    await clearActiveTrip();
    return null;
  }

  if (cachedTrip?.driverId === normalizedDriverId) {
    return cachedTrip;
  }

  cachedTrip = null;

  try {
    const credentials = await Keychain.getGenericPassword({
      service: TRIP_SERVICE,
    });

    if (!credentials) {
      return null;
    }

    const value: unknown = JSON.parse(credentials.password);

    if (
      credentials.username !== normalizedDriverId ||
      !isDriverTrip(value) ||
      value.driverId !== normalizedDriverId
    ) {
      await clearActiveTrip();
      return null;
    }

    cachedTrip = value;
    return value;
  } catch {
    return null;
  }
}

export async function clearActiveTrip(): Promise<void> {
  cachedTrip = null;

  try {
    await Keychain.resetGenericPassword({ service: TRIP_SERVICE });
  } catch {
    // A missing native keychain must not prevent clearing in-memory trip state.
  }
}
