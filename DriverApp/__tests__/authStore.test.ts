jest.mock('../src/services/secureSession', () => ({
  clearSecureSession: jest.fn().mockResolvedValue(undefined),
  loadSecureSession: jest.fn().mockResolvedValue(null),
  saveSecureSession: jest.fn().mockResolvedValue(undefined),
}));

const mockResetTrip = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/store/useTripStore', () => ({
  useTripStore: {
    getState: () => ({ reset: mockResetTrip }),
  },
}));

import { clearSecureSession } from '../src/services/secureSession';
import { useAuthStore } from '../src/store/useAuthStore';

const mockedClearSecureSession = jest.mocked(clearSecureSession);

describe('driver authentication store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      session: {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 60000,
        driver: {
          driver_id: 'driver-1',
          fullName: 'Test Driver',
          mobile: '94712345678',
          verificationStatus: 'approved',
        },
      },
      isHydrated: true,
      isAuthenticating: false,
    });
  });

  test('clears secure credentials before ending the local session', async () => {
    await useAuthStore.getState().logout();

    expect(mockedClearSecureSession).toHaveBeenCalledTimes(1);
    expect(mockResetTrip).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().session).toBeNull();
  });
});
