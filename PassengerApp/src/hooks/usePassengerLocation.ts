import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import type { LatLng } from 'react-native-maps';

export type PassengerLocationStatus =
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable'
  | 'error';

interface PassengerLocationState {
  location: LatLng | null;
  status: PassengerLocationStatus;
  message: string;
  retry: () => void;
}

function messageForStatus(status: PassengerLocationStatus): string {
  switch (status) {
    case 'granted':
      return 'Using your current location';
    case 'denied':
      return 'Location permission was denied';
    case 'blocked':
      return 'Enable location permission in device settings';
    case 'unavailable':
      return 'Turn on device location to see nearby buses';
    case 'error':
      return 'Location temporarily unavailable';
    default:
      return 'Finding buses near you';
  }
}

export function usePassengerLocation(): PassengerLocationState {
  const mountedRef = useRef(true);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<PassengerLocationStatus>('requesting');

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const locate = useCallback(async () => {
    setStatus('requesting');

    try {
      if (Platform.OS === 'android') {
        const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        const alreadyGranted = await PermissionsAndroid.check(permission);
        const result = alreadyGranted
          ? PermissionsAndroid.RESULTS.GRANTED
          : await PermissionsAndroid.request(permission);

        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          if (mountedRef.current) {
            setLocation(null);
            setStatus(
              result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
                ? 'blocked'
                : 'denied',
            );
          }
          return;
        }
      }

      Geolocation.getCurrentPosition(
        position => {
          if (!mountedRef.current) {
            return;
          }

          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setStatus('granted');
        },
        locationError => {
          if (!mountedRef.current) {
            return;
          }

          setLocation(null);
          setStatus(
            locationError.code === 1
              ? 'denied'
              : locationError.code === 2
              ? 'unavailable'
              : 'error',
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 15000,
        },
      );
    } catch {
      if (mountedRef.current) {
        setLocation(null);
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  const retry = useCallback(() => {
    if (status === 'blocked') {
      Linking.openSettings().catch(() => locate());
      return;
    }

    locate();
  }, [locate, status]);

  return {
    location,
    status,
    message: messageForStatus(status),
    retry,
  };
}
