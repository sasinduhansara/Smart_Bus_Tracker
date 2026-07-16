import { useCallback, useEffect, useRef, useState } from 'react';

import {
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import {
  sendDriverLocation,
  type DriverLocationResponse,
} from '../services/api';

const SEND_INTERVAL_MS = 7000;
const GPS_MODULE_NAME = 'RNFusedLocation';

export interface DriverLocationSnapshot {
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  accuracy?: number;
}

interface GeoPositionLike {
  coords: {
    latitude: number;
    longitude: number;
    speed?: number | null;
    heading?: number | null;
    accuracy?: number;
  };
}

interface LocationErrorLike {
  code?: number;
  message?: string;
}

interface UseDriverLocationTrackingOptions {
  onLocationSent?: (response: DriverLocationResponse) => void;
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

let cachedGeolocation: GeolocationService | null = null;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(
      (error as { message?: unknown }).message || '',
    ).trim();

    if (message) {
      return message;
    }
  }

  return fallback;
}

function getLocationErrorMessage(error: LocationErrorLike): string {
  switch (error.code) {
    case 1:
      return 'Location permission was denied.';

    case 2:
      return 'Current location is unavailable. ' + 'Please turn on GPS.';

    case 3:
      return (
        'GPS request timed out. ' + 'Please move to an open area and try again.'
      );

    default:
      return error.message || 'Unable to read the phone GPS location.';
  }
}

function isGeolocationModuleAvailable(): boolean {
  return Boolean(NativeModules[GPS_MODULE_NAME]);
}

async function loadGeolocationModule(): Promise<GeolocationService | null> {
  if (!isGeolocationModuleAvailable()) {
    return null;
  }

  if (cachedGeolocation) {
    return cachedGeolocation;
  }

  try {
    const module = await import('react-native-geolocation-service');
    cachedGeolocation = module.default as GeolocationService;

    return cachedGeolocation;
  } catch {
    return null;
  }
}

async function requestLocationPermission(
  geolocation: GeolocationService,
): Promise<boolean> {
  if (Platform.OS === 'android') {
    const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;

    const alreadyGranted = await PermissionsAndroid.check(permission);

    if (alreadyGranted) {
      return true;
    }

    const result = await PermissionsAndroid.request(permission, {
      title: 'Live Bus Location',
      message:
        'DriveAssist needs your location while a trip is active so passengers can view the bus live.',
      buttonPositive: 'Allow',
      buttonNegative: 'Cancel',
    });

    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  if (Platform.OS === 'ios') {
    const result = await geolocation.requestAuthorization('whenInUse');

    return result === 'granted';
  }

  return false;
}

function createLocationSnapshot(
  position: GeoPositionLike,
): DriverLocationSnapshot {
  const speedMetersPerSecond =
    typeof position.coords.speed === 'number' && position.coords.speed > 0
      ? position.coords.speed
      : 0;

  const speedKmh = Math.round(speedMetersPerSecond * 3.6 * 100) / 100;

  const heading =
    typeof position.coords.heading === 'number' && position.coords.heading >= 0
      ? position.coords.heading
      : 0;

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    speedKmh,
    heading,
    accuracy: position.coords.accuracy,
  };
}

export function useDriverLocationTracking(
  options: UseDriverLocationTrackingOptions = {},
) {
  const { onLocationSent } = options;

  const watchIdRef = useRef<number | null>(null);

  const requestInProgressRef = useRef(false);

  const lastSuccessfulSendRef = useRef(0);

  const [isTracking, setIsTracking] = useState(false);

  const [isStarting, setIsStarting] = useState(false);

  const [isSending, setIsSending] = useState(false);

  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);

  const [lastLocation, setLastLocation] =
    useState<DriverLocationSnapshot | null>(null);

  const [error, setError] = useState<string | null>(null);

  const sendPosition = useCallback(
    async (position: GeoPositionLike) => {
      const currentTime = Date.now();

      if (requestInProgressRef.current) {
        return;
      }

      if (
        lastSuccessfulSendRef.current > 0 &&
        currentTime - lastSuccessfulSendRef.current < SEND_INTERVAL_MS
      ) {
        return;
      }

      const snapshot = createLocationSnapshot(position);

      if (
        !Number.isFinite(snapshot.latitude) ||
        !Number.isFinite(snapshot.longitude)
      ) {
        setError('The GPS returned an invalid location.');
        return;
      }

      requestInProgressRef.current = true;
      setIsSending(true);

      try {
        const response = await sendDriverLocation({
          lat: snapshot.latitude,
          lng: snapshot.longitude,
          speed: snapshot.speedKmh,
          heading: snapshot.heading,
        });

        const sentTime = new Date();

        lastSuccessfulSendRef.current = sentTime.getTime();

        setLastSentAt(sentTime);
        setLastLocation(snapshot);
        setError(null);

        onLocationSent?.(response);
      } catch (sendError) {
        setError(
          getErrorMessage(
            sendError,
            'Could not send the bus location to the server.',
          ),
        );
      } finally {
        requestInProgressRef.current = false;
        setIsSending(false);
      }
    },
    [onLocationSent],
  );

  const handlePositionUpdate = useCallback(
    (position: GeoPositionLike) => {
      sendPosition(position).catch(sendError => {
        setError(
          getErrorMessage(
            sendError,
            'Could not send the bus location to the server.',
          ),
        );
      });
    },
    [sendPosition],
  );

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && cachedGeolocation) {
      cachedGeolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = null;
    requestInProgressRef.current = false;
    lastSuccessfulSendRef.current = 0;

    setIsTracking(false);
    setIsStarting(false);
    setIsSending(false);
  }, []);

  const startTracking = useCallback(async (): Promise<boolean> => {
    if (watchIdRef.current !== null) {
      return true;
    }

    setIsStarting(true);
    setError(null);

    try {
      const geolocation = await loadGeolocationModule();

      if (!geolocation) {
        setError(
          'GPS native module is not available. Rebuild the app with npm run android.',
        );

        return false;
      }

      const permissionGranted = await requestLocationPermission(geolocation);

      if (!permissionGranted) {
        setError('Location permission is required to start a live trip.');

        return false;
      }

      geolocation.getCurrentPosition(
        position => {
          handlePositionUpdate(position);
        },
        locationError => {
          setError(getLocationErrorMessage(locationError));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 3000,
          showLocationDialog: true,
          forceRequestLocation: true,
        },
      );

      const watchId = geolocation.watchPosition(
        position => {
          handlePositionUpdate(position);
        },
        locationError => {
          setError(getLocationErrorMessage(locationError));
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: SEND_INTERVAL_MS,
          fastestInterval: 5000,
          showLocationDialog: true,
          forceRequestLocation: true,
          useSignificantChanges: false,
        },
      );

      watchIdRef.current = watchId;
      setIsTracking(true);

      return true;
    } catch (startError) {
      setIsTracking(false);

      setError(getErrorMessage(startError, 'Could not start GPS tracking.'));

      return false;
    } finally {
      setIsStarting(false);
    }
  }, [handlePositionUpdate]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && cachedGeolocation) {
        cachedGeolocation.clearWatch(watchIdRef.current);
      }

      watchIdRef.current = null;
    };
  }, []);

  return {
    isTracking,
    isStarting,
    isSending,
    lastSentAt,
    lastLocation,
    error,
    startTracking,
    stopTracking,
  };
}
