import {
  getDriverNavigationKey,
  getInitialDriverRoute,
  isDriverEntryRoute,
} from '../src/navigation/authRouting';
import type { AuthSession, VerificationStatus } from '../src/types';

function sessionWithStatus(status: VerificationStatus): AuthSession {
  return {
    accessToken: 'test-token',
    tokenType: 'Bearer',
    expiresAt: Date.now() + 60000,
    driver: {
      driver_id: 'driver-1',
      fullName: 'Test Driver',
      mobile: '94771234567',
      verificationStatus: status,
    },
  };
}

describe('driver authentication routing', () => {
  test('routes a signed-out driver to Login', () => {
    expect(getInitialDriverRoute(null)).toBe('Login');
    expect(getDriverNavigationKey(null)).toBe('signed-out');
  });

  test.each([
    'approved',
    'verified',
    'pending',
    'under_review',
    'rejected',
    'blocked',
    'unverified',
  ] as const)('routes a restored %s session through the access gate', status => {
    const session = sessionWithStatus(status);

    expect(getInitialDriverRoute(session)).toBe('DriverAccessGate');
    expect(getDriverNavigationKey(session)).toBe('signed-in-driver');
  });

  test('recognizes only Login and DriverAccessGate as entry routes', () => {
    expect(isDriverEntryRoute('Login')).toBe(true);
    expect(isDriverEntryRoute('DriverAccessGate')).toBe(true);
    expect(isDriverEntryRoute('DriverHome')).toBe(false);
    expect(isDriverEntryRoute('PendingApproval')).toBe(false);
  });
});
