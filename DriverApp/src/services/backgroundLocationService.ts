import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

import { BASE_URL } from './api';
import { getAccessTokenAsync } from './secureSession';

interface DriverLocationNativeModule {
  startTracking(
    baseUrl: string,
    accessToken: string,
    tripId: string | null,
  ): Promise<boolean>;

  stopTracking(): Promise<boolean>;
}

const nativeDriverLocationModule = NativeModules.DriverLocationModule as
  | DriverLocationNativeModule
  | undefined;

function getAndroidNativeModule(): DriverLocationNativeModule {
  if (Platform.OS !== 'android') {
    throw new Error(
      'Background location tracking is currently available only on Android.',
    );
  }

  if (!nativeDriverLocationModule) {
    throw new Error(
      'The native background location module is unavailable. Rebuild the Driver App.',
    );
  }

  return nativeDriverLocationModule;
}

async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return;
  }

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;

  if (!permission) {
    return;
  }

  const alreadyGranted = await PermissionsAndroid.check(permission);

  if (alreadyGranted) {
    return;
  }

  await PermissionsAndroid.request(permission, {
    title: 'Live trip notification',
    message:
      'Gamana.lk Driver displays a notification while sharing the bus location with passengers.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
}

export function isBackgroundLocationTrackingSupported(): boolean {
  return Platform.OS === 'android' && Boolean(nativeDriverLocationModule);
}

export async function startBackgroundLocationTracking(
  tripId?: string,
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  const module = getAndroidNativeModule();
  const accessToken = await getAccessTokenAsync();

  if (!accessToken) {
    throw new Error(
      'The driver session is unavailable. Sign in again before starting live tracking.',
    );
  }

  /*
   * Fine location permission is already requested during GPS preflight.
   * Android 13+ notification permission is requested separately here.
   */
  await requestNotificationPermission();

  const started = await module.startTracking(
    BASE_URL,
    accessToken,
    tripId?.trim() || null,
  );

  if (!started) {
    throw new Error('The foreground location service could not be started.');
  }

  return true;
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  if (Platform.OS !== 'android' || !nativeDriverLocationModule) {
    return;
  }

  await nativeDriverLocationModule.stopTracking();
}
