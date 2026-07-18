import * as Keychain from 'react-native-keychain';

import {
  clearSecureSession,
  getAccessToken,
  loadSecureSession,
  saveSecureSession,
} from '../src/services/secureSession';
import type { AuthSession } from '../src/types';

const mockedKeychain = jest.mocked(Keychain);

function createSession(expiresAt = Date.now() + 60000): AuthSession {
  return {
    accessToken: 'secure-token',
    tokenType: 'Bearer',
    expiresAt,
    driver: {
      driver_id: 'driver-1',
      fullName: 'Test Driver',
      mobile: '94771234567',
      verificationStatus: 'approved',
    },
  };
}

describe('secure driver session', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockedKeychain.resetGenericPassword.mockResolvedValue(false);
    await clearSecureSession();
    jest.clearAllMocks();
  });

  test('stores the token only through device keychain storage', async () => {
    const session = createSession();
    mockedKeychain.setGenericPassword.mockResolvedValue({} as never);

    await saveSecureSession(session);

    expect(mockedKeychain.setGenericPassword).toHaveBeenCalledWith(
      'driver-session',
      JSON.stringify(session),
      expect.objectContaining({ service: 'lk.gamana.driver.auth' }),
    );
    expect(getAccessToken()).toBe('secure-token');
  });

  test('does not silently accept a session when secure storage fails', async () => {
    mockedKeychain.setGenericPassword.mockRejectedValue(
      new Error('Keychain unavailable'),
    );

    await expect(saveSecureSession(createSession())).rejects.toThrow(
      'Secure storage is unavailable',
    );
    expect(getAccessToken()).toBeNull();
  });

  test('rejects and removes an expired restored session', async () => {
    const expired = createSession(Date.now() - 1);
    mockedKeychain.getGenericPassword.mockResolvedValue({
      service: 'lk.gamana.driver.auth',
      username: 'driver-session',
      password: JSON.stringify(expired),
    } as never);
    mockedKeychain.resetGenericPassword.mockResolvedValue(false);

    await expect(loadSecureSession()).resolves.toBeNull();
    expect(mockedKeychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'lk.gamana.driver.auth',
    });
  });
});
