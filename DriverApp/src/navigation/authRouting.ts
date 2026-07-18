import type { AuthSession } from '../types';
import type { RootStackParamList } from '../types/navigation';

export function getInitialDriverRoute(
  session: AuthSession | null,
): keyof RootStackParamList {
  if (!session) {
    return 'Login';
  }

  const status = session.driver.verificationStatus;

  return status === 'approved' || status === 'verified'
    ? 'DriverHome'
    : 'PendingApproval';
}

export function getDriverNavigationKey(session: AuthSession | null): string {
  const route = getInitialDriverRoute(session);

  if (route === 'Login') {
    return 'signed-out';
  }

  return route === 'DriverHome' ? 'approved-driver' : 'driver-review';
}
