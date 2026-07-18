import type { BusLocation, BusLocationUpdate } from '../types';

function getTimestamp(value?: string): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getUpdateTimestamp(update: BusLocationUpdate): number | null {
  const timestamps = [
    getTimestamp(update.updatedAt),
    getTimestamp(update.statusUpdatedAt),
  ].filter((timestamp): timestamp is number => timestamp !== null);

  return timestamps.length ? Math.max(...timestamps) : null;
}

export function hasBusCoordinates(
  update: BusLocationUpdate,
): update is BusLocation {
  return typeof update.lat === 'number' && typeof update.lng === 'number';
}

export function mergeBusLocationUpdate(
  previous: BusLocation | undefined,
  update: BusLocationUpdate,
): BusLocation | undefined {
  if (previous) {
    const previousTimestamp = getUpdateTimestamp(previous);
    const updateTimestamp = getUpdateTimestamp(update);

    if (
      previousTimestamp !== null &&
      (updateTimestamp === null || updateTimestamp < previousTimestamp)
    ) {
      return previous;
    }

    return {
      ...previous,
      ...update,
      lat: update.lat ?? previous.lat,
      lng: update.lng ?? previous.lng,
    };
  }

  return hasBusCoordinates(update) ? update : undefined;
}

export function mergeBusUpdateIntoMap(
  previousBuses: Record<string, BusLocation>,
  update: BusLocationUpdate,
): Record<string, BusLocation> {
  const previous = previousBuses[update.bus_id];
  const merged = mergeBusLocationUpdate(previous, update);

  if (!merged || merged === previous) {
    return previousBuses;
  }

  return {
    ...previousBuses,
    [update.bus_id]: merged,
  };
}

export function mergeBusSnapshot(
  previousBuses: Record<string, BusLocation>,
  updates: BusLocationUpdate[],
): Record<string, BusLocation> {
  return updates.reduce(mergeBusUpdateIntoMap, previousBuses);
}

export function reconcileBusSnapshot(
  previousBuses: Record<string, BusLocation>,
  updates: BusLocationUpdate[],
  protectedBusIds: ReadonlySet<string> = new Set(),
  reconciledAt = new Date().toISOString(),
): Record<string, BusLocation> {
  const snapshotBusIds = new Set(updates.map(update => update.bus_id));
  let nextBuses = mergeBusSnapshot(previousBuses, updates);

  Object.keys(previousBuses).forEach(busId => {
    if (snapshotBusIds.has(busId) || protectedBusIds.has(busId)) {
      return;
    }

    const current = nextBuses[busId];

    if (
      !current ||
      (current.operationalStatus === 'offline' && current.isActive === false)
    ) {
      return;
    }

    if (nextBuses === previousBuses) {
      nextBuses = { ...previousBuses };
    }

    nextBuses[busId] = {
      ...current,
      operationalStatus: 'offline',
      isActive: false,
      activeTripId: '',
      tripId: '',
      statusUpdatedAt: reconciledAt,
    };
  });

  return nextBuses;
}
