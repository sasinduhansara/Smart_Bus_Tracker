import { ApiError } from '../services/api';
import type { TripLocation } from '../types';

export type TripStartPreflightStatus =
  | 'idle'
  | 'checking_location'
  | 'checking_terminal'
  | 'outside_geofence'
  | 'permission_required'
  | 'accuracy_low'
  | 'terminal_unavailable'
  | 'error';

export interface TripStartErrorPresentation {
  status: Exclude<
    TripStartPreflightStatus,
    'idle' | 'checking_location' | 'checking_terminal'
  >;
  title: string;
  message: string;
  canOpenSettings: boolean;
}

export interface TripStartExecution<TSnapshot, TTrip> {
  prepareLocation: () => Promise<TSnapshot | null>;
  mapLocation: (snapshot: TSnapshot) => TripLocation;
  startTrip: (location: TripLocation) => Promise<TTrip>;
  startTracking: (
    snapshot: TSnapshot,
    options: { initialLocationAlreadyAccepted: true },
  ) => Promise<boolean>;
  onStage?: (stage: 'checking_location' | 'checking_terminal') => void;
}

export type TripStartExecutionResult<TSnapshot, TTrip> =
  | { status: 'location_unavailable' }
  | {
      status: 'accepted';
      snapshot: TSnapshot;
      trip: TTrip;
      watcherStarted: boolean;
    };

/** Keeps the ordering security-sensitive: fresh fix, backend acceptance, watcher. */
export async function executeTripStart<TSnapshot, TTrip>(
  execution: TripStartExecution<TSnapshot, TTrip>,
): Promise<TripStartExecutionResult<TSnapshot, TTrip>> {
  execution.onStage?.('checking_location');
  const snapshot = await execution.prepareLocation();

  if (!snapshot) {
    return { status: 'location_unavailable' };
  }

  execution.onStage?.('checking_terminal');
  const trip = await execution.startTrip(execution.mapLocation(snapshot));
  const watcherStarted = await execution.startTracking(snapshot, {
    initialLocationAlreadyAccepted: true,
  });

  return { status: 'accepted', snapshot, trip, watcherStarted };
}

function formatMeters(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`;
  }

  return `${Math.round(value)} m`;
}

export function presentTripStartError(
  error: unknown,
): TripStartErrorPresentation {
  if (error instanceof ApiError) {
    if (error.code === 'OUTSIDE_START_GEOFENCE') {
      const nearest = error.details?.nearestTerminal;
      const detail = nearest
        ? `Nearest terminal: ${nearest.name} (${formatMeters(
            nearest.distanceMeters,
          )} away). Start within ${formatMeters(
            nearest.allowedRadiusMeters,
          )} of the terminal.`
        : error.message;

      return {
        status: 'outside_geofence',
        title: 'Too far from route terminal',
        message: detail,
        canOpenSettings: false,
      };
    }

    if (error.code === 'LOCATION_ACCURACY_TOO_LOW') {
      return {
        status: 'accuracy_low',
        title: 'Location accuracy is low',
        message:
          'Move to an open area, wait for a precise GPS fix, and retry location.',
        canOpenSettings: true,
      };
    }

    if (
      error.code === 'LOCATION_REQUIRED' ||
      error.code === 'LOCATION_INVALID' ||
      error.code === 'LOCATION_STALE' ||
      error.code === 'LOCATION_FUTURE'
    ) {
      return {
        status: 'error',
        title: 'Fresh location required',
        message: error.message,
        canOpenSettings: false,
      };
    }

    if (
      error.code === 'ROUTE_NOT_FOUND' ||
      error.code === 'ROUTE_TERMINALS_NOT_CONFIGURED'
    ) {
      return {
        status: 'terminal_unavailable',
        title: 'Route terminal unavailable',
        message:
          'This route is not configured for terminal-based trip starts. Contact operations.',
        canOpenSettings: false,
      };
    }
  }

  return {
    status: 'error',
    title: 'Could not start trip',
    message: error instanceof Error ? error.message : 'Please retry location.',
    canOpenSettings: false,
  };
}

export function presentGpsPreflightError(
  permissionStatus: 'unknown' | 'requesting' | 'granted' | 'denied' | 'blocked',
  message?: string | null,
): TripStartErrorPresentation {
  const normalizedMessage = message?.toLowerCase() || '';

  if (
    permissionStatus === 'denied' ||
    permissionStatus === 'blocked' ||
    normalizedMessage.includes('permission')
  ) {
    return {
      status: 'permission_required',
      title: 'Location permission required',
      message:
        message ||
        'Enable precise location permission in device settings, then retry.',
      canOpenSettings: true,
    };
  }

  if (normalizedMessage.includes('accuracy')) {
    return {
      status: 'accuracy_low',
      title: 'Location accuracy is low',
      message:
        message || 'GPS accuracy is too low. Wait for a stronger location fix.',
      canOpenSettings: true,
    };
  }

  return {
    status: 'error',
    title: 'GPS unavailable',
    message: message || 'A reliable current GPS fix is required.',
    canOpenSettings: true,
  };
}
