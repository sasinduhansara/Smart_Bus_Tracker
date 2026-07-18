import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';

import {
  ApiError,
  sendDriverLocation,
  type DriverLocationResponse,
} from '../services/api';
import type { TripLocation } from '../types';

export const LOCATION_SEND_INTERVAL_MS = 7000;
export const LOCATION_HEARTBEAT_MS = 30000;
export const LOCATION_DISTANCE_METERS = 10;
export const LOCATION_MAX_AGE_MS = 30000;
export const LOCATION_MAX_ACCURACY_METERS = 100;

const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;
const FATAL_LOCATION_CODES = new Set([
  'DRIVER_NOT_APPROVED',
  'VEHICLE_ASSIGNMENT_REQUIRED',
  'ROUTE_ASSIGNMENT_REQUIRED',
  'TRIP_PAUSED',
  'NO_ACTIVE_TRIP',
  'ASSIGNMENT_CHANGED',
  'BUS_TRACKING_MISSING',
  'TRIP_STATE_CHANGED',
]);

export type LocationPermissionStatus =
  | 'unknown'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'blocked';

export type LocationTransmissionStatus =
  | 'idle'
  | 'sending'
  | 'online'
  | 'retrying'
  | 'offline'
  | 'rejected';

export interface DriverLocationSnapshot {
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  accuracy: number;
  recordedAt: string;
}

interface GeoPositionLike {
  coords: {
    latitude: number;
    longitude: number;
    speed?: number | null;
    heading?: number | null;
    accuracy: number;
  };
  timestamp?: number;
}

interface LocationErrorLike {
  code?: number;
  message?: string;
}

interface UseDriverLocationTrackingOptions {
  onLocationSent?: (
    response: DriverLocationResponse,
    snapshot: DriverLocationSnapshot,
  ) => void;
  onTrackingRejected?: (error: ApiError) => void;
}

interface GeolocationService {
  requestAuthorization: (
    authorizationLevel: 'always' | 'whenInUse',
  ) => Promise<string>;
  getCurrentPosition: (
    success: (position: GeoPositionLike) => void,
    error: (error: LocationErrorLike) => void,
    options: Record<string, unknown>,
  ) => void;
  watchPosition: (
    success: (position: GeoPositionLike) => void,
    error: (error: LocationErrorLike) => void,
    options: Record<string, unknown>,
  ) => number;
  clearWatch: (watchId: number) => void;
}

const geolocationService = Geolocation as GeolocationService;

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();

    if (message) {
      return message;
    }
  }

  return fallback;
}

function locationErrorMessage(error: LocationErrorLike): string {
  switch (error.code) {
    case 1:
      return 'Location permission was denied. Enable it in system settings.';
    case 2:
      return 'GPS is unavailable. Turn on precise location and try again.';
    case 3:
      return 'The GPS request timed out. Move to an open area and retry.';
    default:
      return error.message || 'The phone could not provide a GPS location.';
  }
}

async function loadGeolocation(): Promise<GeolocationService | null> {
  return geolocationService || null;
}

async function requestPermission(
  geolocation: GeolocationService,
  previousStatus: LocationPermissionStatus,
): Promise<LocationPermissionStatus> {
  if (Platform.OS === 'android') {
    const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;

    if (await PermissionsAndroid.check(permission)) {
      return 'granted';
    }

    if (previousStatus === 'denied' || previousStatus === 'blocked') {
      return previousStatus;
    }

    const result = await PermissionsAndroid.request(permission, {
      title: 'Live bus location',
      message:
        'Gamana.lk Driver shares precise location only while you run an active trip.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      return 'granted';
    }

    return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      ? 'blocked'
      : 'denied';
  }

  if (Platform.OS === 'ios') {
    // iOS returns the current authorization state without re-presenting the
    // one-time system prompt, so this also detects changes made in Settings.
    const result = await geolocation.requestAuthorization('whenInUse');

    if (result === 'granted') {
      return 'granted';
    }

    return result === 'disabled' || result === 'restricted'
      ? 'blocked'
      : 'denied';
  }

  return 'denied';
}

function createSnapshot(position: GeoPositionLike): DriverLocationSnapshot {
  const speedMetersPerSecond =
    typeof position.coords.speed === 'number' && position.coords.speed > 0
      ? position.coords.speed
      : 0;
  const heading =
    typeof position.coords.heading === 'number' && position.coords.heading >= 0
      ? position.coords.heading
      : 0;
  const timestamp =
    typeof position.timestamp === 'number' && Number.isFinite(position.timestamp)
      ? position.timestamp
      : Date.now();

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    speedKmh: Math.round(speedMetersPerSecond * 360) / 100,
    heading,
    accuracy: position.coords.accuracy,
    recordedAt: new Date(timestamp).toISOString(),
  };
}

export function toTripLocation(
  snapshot: DriverLocationSnapshot,
): TripLocation {
  return {
    lat: snapshot.latitude,
    lng: snapshot.longitude,
    speed: snapshot.speedKmh,
    heading: snapshot.heading,
    accuracy: snapshot.accuracy,
    timestamp: snapshot.recordedAt,
  };
}

function haversineMeters(
  first: DriverLocationSnapshot,
  second: DriverLocationSnapshot,
): number {
  const radius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function validateDriverLocationSnapshot(
  snapshot: DriverLocationSnapshot,
): string | null {
  if (
    !Number.isFinite(snapshot.latitude) ||
    !Number.isFinite(snapshot.longitude) ||
    snapshot.latitude < -90 ||
    snapshot.latitude > 90 ||
    snapshot.longitude < -180 ||
    snapshot.longitude > 180
  ) {
    return 'The GPS returned an invalid coordinate.';
  }

  if (
    !Number.isFinite(snapshot.accuracy) ||
    snapshot.accuracy < 0 ||
    snapshot.accuracy > LOCATION_MAX_ACCURACY_METERS
  ) {
    return 'GPS accuracy is too low. Wait for a stronger location fix.';
  }

  if (
    !Number.isFinite(snapshot.speedKmh) ||
    snapshot.speedKmh < 0 ||
    snapshot.speedKmh > 200
  ) {
    return 'The GPS returned an invalid speed.';
  }

  if (
    !Number.isFinite(snapshot.heading) ||
    snapshot.heading < 0 ||
    snapshot.heading >= 360
  ) {
    return 'The GPS returned an invalid heading.';
  }

  const recordedAt = new Date(snapshot.recordedAt).getTime();

  if (
    !Number.isFinite(recordedAt) ||
    Date.now() - recordedAt > LOCATION_MAX_AGE_MS ||
    recordedAt - Date.now() > 10000
  ) {
    return 'The GPS location is stale. Waiting for a fresh fix.';
  }

  return null;
}

const POSITION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 3000,
  showLocationDialog: true,
  forceRequestLocation: true,
};

export function useDriverLocationTracking(
  options: UseDriverLocationTrackingOptions = {},
) {
  const { onLocationSent, onTrackingRejected } = options;
  const onLocationSentRef = useRef(onLocationSent);
  onLocationSentRef.current = onLocationSent;
  const onTrackingRejectedRef = useRef(onTrackingRejected);
  onTrackingRejectedRef.current = onTrackingRejected;
  const mountedRef = useRef(true);
  const permissionStatusRef = useRef<LocationPermissionStatus>('unknown');
  const watchIdRef = useRef<number | null>(null);
  const desiredTrackingRef = useRef(false);
  const requestInProgressRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatPositionRequestRef = useRef(false);
  const appIsActiveRef = useRef(true);
  const requestSettledWaitersRef = useRef<Array<() => void>>([]);
  const pendingSnapshotRef = useRef<DriverLocationSnapshot | null>(null);
  const latestSnapshotRef = useRef<DriverLocationSnapshot | null>(null);
  const lastSentSnapshotRef = useRef<DriverLocationSnapshot | null>(null);
  const lastSuccessfulSendRef = useRef(0);

  const [isTracking, setIsTracking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus>('unknown');
  const [transmissionStatus, setTransmissionStatus] =
    useState<LocationTransmissionStatus>('idle');
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [lastLocation, setLastLocation] =
    useState<DriverLocationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const clearQueuedSend = useCallback(() => {
    if (queuedSendTimerRef.current) {
      clearTimeout(queuedSendTimerRef.current);
      queuedSendTimerRef.current = null;
    }
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    heartbeatPositionRequestRef.current = false;
  }, []);

  const sendSnapshot = useCallback(
    async (
      snapshot: DriverLocationSnapshot,
      force = false,
      retryAttempt = 0,
    ): Promise<DriverLocationResponse | null> => {
      let queuedAfterRequest: DriverLocationSnapshot | null = null;
      const validationError = validateDriverLocationSnapshot(snapshot);

      if (validationError) {
        if (mountedRef.current) {
          setError(validationError);
        }
        return null;
      }

      const now = Date.now();
      const elapsed = now - lastSuccessfulSendRef.current;
      const lastSentSnapshot = lastSentSnapshotRef.current;

      if (!force && lastSentSnapshot) {
        if (elapsed < LOCATION_SEND_INTERVAL_MS) {
          pendingSnapshotRef.current = snapshot;

          if (desiredTrackingRef.current && !queuedSendTimerRef.current) {
            queuedSendTimerRef.current = setTimeout(() => {
              queuedSendTimerRef.current = null;
              const latestPending = pendingSnapshotRef.current;
              pendingSnapshotRef.current = null;

              if (latestPending && desiredTrackingRef.current) {
                sendSnapshot(latestPending).catch(() => undefined);
              }
            }, LOCATION_SEND_INTERVAL_MS - elapsed);
          }

          return null;
        }

        if (
          elapsed < LOCATION_HEARTBEAT_MS &&
          haversineMeters(lastSentSnapshot, snapshot) < LOCATION_DISTANCE_METERS
        ) {
          return null;
        }
      }

      if (requestInProgressRef.current) {
        pendingSnapshotRef.current = snapshot;

        if (force) {
          await new Promise<void>(resolve => {
            requestSettledWaitersRef.current.push(resolve);
          });

          const latestPending = pendingSnapshotRef.current || snapshot;
          pendingSnapshotRef.current = null;
          return sendSnapshot(latestPending, true, retryAttempt);
        }

        return null;
      }

      requestInProgressRef.current = true;

      if (mountedRef.current) {
        setIsSending(true);
        setTransmissionStatus(retryAttempt > 0 ? 'retrying' : 'sending');
      }

      try {
        const response = await sendDriverLocation(toTripLocation(snapshot));
        const sentAt = new Date();
        lastSuccessfulSendRef.current = sentAt.getTime();
        lastSentSnapshotRef.current = snapshot;
        queuedAfterRequest = pendingSnapshotRef.current;
        pendingSnapshotRef.current =
          queuedAfterRequest === snapshot ? null : queuedAfterRequest;
        clearRetry();

        if (mountedRef.current) {
          setLastSentAt(sentAt);
          setError(null);
          setTransmissionStatus('online');
        }

        onLocationSentRef.current?.(response, snapshot);
        return response;
      } catch (sendError) {
        pendingSnapshotRef.current = latestSnapshotRef.current || snapshot;
        const apiError = sendError instanceof ApiError ? sendError : null;
        const retryable =
          !apiError || apiError.status === 0 || apiError.status >= 500;
        const trackingRejected = Boolean(
          apiError &&
            (apiError.status === 401 ||
              apiError.status === 403 ||
              (apiError.code && FATAL_LOCATION_CODES.has(apiError.code))),
        );
        const message = errorMessage(
          sendError,
          'The location could not reach the backend.',
        );

        if (mountedRef.current) {
          setError(message);
          setTransmissionStatus(
            trackingRejected || !retryable
              ? 'rejected'
              : desiredTrackingRef.current &&
                retryAttempt < RETRY_DELAYS_MS.length
              ? 'retrying'
              : 'offline',
          );
        }

        if (trackingRejected && apiError) {
          desiredTrackingRef.current = false;
          pendingSnapshotRef.current = null;
          clearRetry();
          clearQueuedSend();
          clearHeartbeat();

          if (watchIdRef.current !== null) {
            geolocationService.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }

          if (mountedRef.current) {
            setIsTracking(false);
          }

          onTrackingRejectedRef.current?.(apiError);
        }

        if (
          retryable &&
          !trackingRejected &&
          desiredTrackingRef.current &&
          retryAttempt < RETRY_DELAYS_MS.length &&
          !retryTimerRef.current
        ) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            const pending = pendingSnapshotRef.current || snapshot;
            sendSnapshot(pending, true, retryAttempt + 1).catch(() => undefined);
          }, RETRY_DELAYS_MS[retryAttempt]);
        }

        return null;
      } finally {
        requestInProgressRef.current = false;
        const waiters = requestSettledWaitersRef.current.splice(0);
        waiters.forEach(resolve => resolve());

        if (mountedRef.current) {
          setIsSending(false);
        }

        if (
          queuedAfterRequest &&
          queuedAfterRequest !== snapshot &&
          desiredTrackingRef.current &&
          !queuedSendTimerRef.current
        ) {
          const remainingInterval = Math.max(
            LOCATION_SEND_INTERVAL_MS -
              (Date.now() - lastSuccessfulSendRef.current),
            0,
          );

          queuedSendTimerRef.current = setTimeout(() => {
            queuedSendTimerRef.current = null;
            const latestPending = pendingSnapshotRef.current;
            pendingSnapshotRef.current = null;

            if (latestPending && desiredTrackingRef.current) {
              sendSnapshot(latestPending).catch(() => undefined);
            }
          }, remainingInterval);
        }
      }
    },
    [clearHeartbeat, clearQueuedSend, clearRetry],
  );

  const acceptPosition = useCallback(
    (position: GeoPositionLike, transmit: boolean) => {
      const snapshot = createSnapshot(position);
      const validationError = validateDriverLocationSnapshot(snapshot);

      if (validationError) {
        if (mountedRef.current) {
          setError(validationError);
        }
        return null;
      }

      latestSnapshotRef.current = snapshot;

      if (mountedRef.current) {
        setLastLocation(snapshot);
        setError(null);
      }

      if (transmit) {
        sendSnapshot(snapshot).catch(() => undefined);
      }

      return snapshot;
    },
    [sendSnapshot],
  );

  const startHeartbeat = useCallback(
    (geolocation: GeolocationService) => {
      clearHeartbeat();

      heartbeatTimerRef.current = setInterval(() => {
        if (
          !desiredTrackingRef.current ||
          !appIsActiveRef.current ||
          heartbeatPositionRequestRef.current
        ) {
          return;
        }

        heartbeatPositionRequestRef.current = true;
        geolocation.getCurrentPosition(
          position => {
            heartbeatPositionRequestRef.current = false;

            if (!desiredTrackingRef.current || !appIsActiveRef.current) {
              return;
            }

            const heartbeatSnapshot = acceptPosition(position, false);
            if (heartbeatSnapshot) {
              sendSnapshot(heartbeatSnapshot, true).catch(() => undefined);
            }
          },
          locationError => {
            heartbeatPositionRequestRef.current = false;

            if (mountedRef.current && appIsActiveRef.current) {
              setError(locationErrorMessage(locationError));
              setTransmissionStatus('offline');
            }
          },
          POSITION_OPTIONS,
        );
      }, LOCATION_HEARTBEAT_MS);
    },
    [acceptPosition, clearHeartbeat, sendSnapshot],
  );

  const prepareLocation = useCallback(async () => {
    if (mountedRef.current) {
      setIsStarting(true);
      setError(null);
    }

    try {
      const geolocation = await loadGeolocation();

      if (!geolocation) {
        throw new Error(
          'The GPS native module is unavailable. Rebuild the Driver App and retry.',
        );
      }

      if (mountedRef.current) {
        setPermissionStatus('requesting');
      }

      const permission = await requestPermission(
        geolocation,
        permissionStatusRef.current,
      );
      permissionStatusRef.current = permission;

      if (mountedRef.current) {
        setPermissionStatus(permission);
      }

      if (permission !== 'granted') {
        throw new Error(
          permission === 'blocked'
            ? 'Location permission is blocked. Enable precise location in system settings.'
            : 'Location permission is required before a live trip can start.',
        );
      }

      const position = await new Promise<GeoPositionLike>((resolve, reject) => {
        geolocation.getCurrentPosition(resolve, reject, POSITION_OPTIONS);
      });
      const snapshot = acceptPosition(position, false);

      if (!snapshot) {
        throw new Error('A reliable current GPS fix is not available yet.');
      }

      return snapshot;
    } catch (prepareError) {
      const message =
        prepareError && typeof prepareError === 'object' && 'code' in prepareError
          ? locationErrorMessage(prepareError as LocationErrorLike)
          : errorMessage(prepareError, 'GPS preflight failed.');

      if (mountedRef.current) {
        setError(message);
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsStarting(false);
      }
    }
  }, [acceptPosition]);

  const startTracking = useCallback(
    async (preparedSnapshot?: DriverLocationSnapshot): Promise<boolean> => {
      if (watchIdRef.current !== null) {
        desiredTrackingRef.current = true;
        if (lastSuccessfulSendRef.current > 0) {
          return true;
        }
        const retrySnapshot =
          preparedSnapshot || latestSnapshotRef.current || (await prepareLocation());
        if (!retrySnapshot) {
          return false;
        }

        if (mountedRef.current) {
          setIsStarting(true);
        }
        const retryResponse = await sendSnapshot(retrySnapshot, true);
        if (mountedRef.current) {
          setIsStarting(false);
        }
        return Boolean(retryResponse);
      }

      const snapshot = preparedSnapshot || (await prepareLocation());

      if (!snapshot) {
        return false;
      }

      const geolocation = await loadGeolocation();

      if (!geolocation) {
        if (mountedRef.current) {
          setError('The GPS native module is unavailable.');
        }
        return false;
      }

      desiredTrackingRef.current = true;

      try {
        watchIdRef.current = geolocation.watchPosition(
          position => acceptPosition(position, true),
          locationError => {
            if (mountedRef.current) {
              setError(locationErrorMessage(locationError));
              setTransmissionStatus('offline');
            }
          },
          {
            ...POSITION_OPTIONS,
            distanceFilter: LOCATION_DISTANCE_METERS,
            interval: LOCATION_SEND_INTERVAL_MS,
            fastestInterval: 5000,
            useSignificantChanges: false,
          },
        );

        if (mountedRef.current) {
          setIsTracking(true);
          setIsStarting(true);
        }

        const initialResponse = await sendSnapshot(snapshot, true);

        if (!initialResponse) {
          desiredTrackingRef.current = false;
          clearRetry();
          clearQueuedSend();
          clearHeartbeat();
          pendingSnapshotRef.current = null;
          lastSuccessfulSendRef.current = 0;
          lastSentSnapshotRef.current = null;

          if (watchIdRef.current !== null) {
            geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }

          if (mountedRef.current) {
            setIsTracking(false);
            setIsStarting(false);
            setTransmissionStatus(currentStatus =>
              currentStatus === 'rejected' ? 'rejected' : 'offline',
            );
          }
          return false;
        }

        startHeartbeat(geolocation);
        if (mountedRef.current) {
          setIsStarting(false);
        }
        return true;
      } catch (startError) {
        desiredTrackingRef.current = false;

        if (mountedRef.current) {
          setIsTracking(false);
          setIsStarting(false);
          setError(errorMessage(startError, 'GPS tracking could not start.'));
        }
        return false;
      }
    },
    [
      acceptPosition,
      clearHeartbeat,
      clearQueuedSend,
      clearRetry,
      prepareLocation,
      sendSnapshot,
      startHeartbeat,
    ],
  );

  const stopTracking = useCallback(() => {
    desiredTrackingRef.current = false;
    clearRetry();
    clearQueuedSend();
    clearHeartbeat();

    if (watchIdRef.current !== null) {
      geolocationService.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = null;
    pendingSnapshotRef.current = null;
    lastSuccessfulSendRef.current = 0;
    lastSentSnapshotRef.current = null;

    if (mountedRef.current) {
      setIsTracking(false);
      setIsStarting(false);
      setIsSending(false);
      setTransmissionStatus('idle');
    }
  }, [clearHeartbeat, clearQueuedSend, clearRetry]);

  const flushLatestLocation = useCallback(async () => {
    let snapshot = latestSnapshotRef.current;

    if (!snapshot || validateDriverLocationSnapshot(snapshot)) {
      snapshot = await prepareLocation();
    }

    return snapshot ? sendSnapshot(snapshot, true) : null;
  }, [prepareLocation, sendSnapshot]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      appIsActiveRef.current = nextState === 'active';

      if (nextState !== 'active' && watchIdRef.current !== null) {
        geolocationService.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        clearRetry();
        clearQueuedSend();
        clearHeartbeat();
        if (mountedRef.current) {
          setIsTracking(false);
        }
        return;
      }

      if (nextState === 'active' && desiredTrackingRef.current) {
        startTracking().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [clearHeartbeat, clearQueuedSend, clearRetry, startTracking]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      desiredTrackingRef.current = false;
      clearRetry();
      clearQueuedSend();
      clearHeartbeat();

      if (watchIdRef.current !== null) {
        geolocationService.clearWatch(watchIdRef.current);
      }

      watchIdRef.current = null;
    };
  }, [clearHeartbeat, clearQueuedSend, clearRetry]);

  return {
    isTracking,
    isStarting,
    isSending,
    permissionStatus,
    transmissionStatus,
    lastSentAt,
    lastLocation,
    error,
    prepareLocation,
    startTracking,
    stopTracking,
    flushLatestLocation,
  };
}
