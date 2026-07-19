import * as Keychain from 'react-native-keychain';

import type { TripLocation } from '../types';

const QUEUE_SERVICE = 'lk.gamana.driver.location-queue';
const QUEUE_USERNAME = 'active-trip-location-queue';
const MAX_QUEUE_SIZE = 20;
const MAX_REPLAY_AGE_MS = 30000;

export interface QueuedTripLocation {
  tripId: string;
  location: TripLocation;
  queuedAt: string;
}

let cachedQueue: QueuedTripLocation[] = [];

function isQueuedLocation(value: unknown): value is QueuedTripLocation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<QueuedTripLocation>;
  return Boolean(
    item.tripId &&
      item.location &&
      Number.isFinite(item.location.lat) &&
      item.location.lat >= -90 &&
      item.location.lat <= 90 &&
      Number.isFinite(item.location.lng) &&
      item.location.lng >= -180 &&
      item.location.lng <= 180 &&
      Number.isFinite(item.location.accuracy) &&
      item.location.accuracy >= 0 &&
      item.location.accuracy <= 100 &&
      Number.isFinite(new Date(item.location.timestamp).getTime()),
  );
}

async function readQueue(): Promise<QueuedTripLocation[]> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: QUEUE_SERVICE,
    });
    if (!credentials) {
      return cachedQueue;
    }

    const value: unknown = JSON.parse(credentials.password);
    cachedQueue = Array.isArray(value) ? value.filter(isQueuedLocation) : [];
  } catch {
    // In-memory fallback keeps foreground retry behavior available.
  }

  return cachedQueue;
}

async function writeQueue(queue: QueuedTripLocation[]): Promise<void> {
  cachedQueue = queue.slice(-MAX_QUEUE_SIZE);

  try {
    if (!cachedQueue.length) {
      await Keychain.resetGenericPassword({ service: QUEUE_SERVICE });
      return;
    }

    await Keychain.setGenericPassword(
      QUEUE_USERNAME,
      JSON.stringify(cachedQueue),
      {
        service: QUEUE_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      },
    );
  } catch {
    // The bounded in-memory queue remains available for this app process.
  }
}

export async function enqueueTripLocation(
  tripId: string,
  location: TripLocation,
): Promise<void> {
  if (!tripId.trim()) {
    return;
  }

  const queue = await readQueue();
  const withoutDuplicate = queue.filter(
    item =>
      item.tripId !== tripId || item.location.timestamp !== location.timestamp,
  );
  withoutDuplicate.push({
    tripId,
    location,
    queuedAt: new Date().toISOString(),
  });
  await writeQueue(withoutDuplicate);
}

export async function getNewestFreshTripLocation(
  tripId: string,
  now = Date.now(),
): Promise<TripLocation | null> {
  const queue = await readQueue();
  const fresh = queue
    .filter(item => item.tripId === tripId)
    .filter(item => {
      const timestamp = new Date(item.location.timestamp).getTime();
      const age = now - timestamp;
      return (
        Number.isFinite(timestamp) &&
        age >= -10000 &&
        age <= MAX_REPLAY_AGE_MS
      );
    })
    .sort(
      (first, second) =>
        new Date(second.location.timestamp).getTime() -
        new Date(first.location.timestamp).getTime(),
    );

  return fresh[0]?.location || null;
}

export async function removeQueuedLocationsThrough(
  tripId: string,
  timestamp: string,
): Promise<void> {
  const acceptedAt = new Date(timestamp).getTime();
  const queue = await readQueue();
  await writeQueue(
    queue.filter(item => {
      if (item.tripId !== tripId) {
        return true;
      }

      return new Date(item.location.timestamp).getTime() > acceptedAt;
    }),
  );
}

export async function clearTripLocationQueue(tripId?: string): Promise<void> {
  if (!tripId) {
    await writeQueue([]);
    return;
  }

  const queue = await readQueue();
  await writeQueue(queue.filter(item => item.tripId !== tripId));
}
