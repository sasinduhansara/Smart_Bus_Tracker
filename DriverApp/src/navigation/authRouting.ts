import type {
  AuthSession,
} from '../types';

import type {
  RootStackParamList,
} from '../types/navigation';

type InitialDriverRoute =
  | 'Login'
  | 'DriverAccessGate';

export function getInitialDriverRoute(
  session: AuthSession | null,
): InitialDriverRoute {
  return session
    ? 'DriverAccessGate'
    : 'Login';
}

export function getDriverNavigationKey(
  session: AuthSession | null,
): string {
  if (!session) {
    return 'signed-out';
  }

  return 'signed-in-driver';
}

export function isDriverEntryRoute(
  route:
    keyof RootStackParamList,
): boolean {
  return (
    route === 'Login' ||
    route === 'DriverAccessGate'
  );
}
