import {
  getDriverNavigationKey,
  getInitialDriverRoute,
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

  test.each(['approved', 'verified'] as const)(
    'routes a %s driver to the operational dashboard',
    status => {
      const session = sessionWithStatus(status);

      expect(getInitialDriverRoute(session)).toBe('DriverHome');
      expect(getDriverNavigationKey(session)).toBe('approved-driver');
    },
  );

  test.each([
    'pending',
    'under_review',
    'rejected',
    'blocked',
    'unverified',
  ] as const)('keeps a %s driver on the review screen', status => {
    const session = sessionWithStatus(status);

    expect(getInitialDriverRoute(session)).toBe('PendingApproval');
    expect(getDriverNavigationKey(session)).toBe('driver-review');
  });
});
