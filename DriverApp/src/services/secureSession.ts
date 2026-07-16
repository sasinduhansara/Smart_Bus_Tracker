import * as Keychain from 'react-native-keychain';

import type { AuthSession } from '../types';

const SESSION_SERVICE = 'lk.gamana.driver.auth';
const SESSION_USERNAME = 'driver-session';

let cachedSession: AuthSession | null = null;

function isValidSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<AuthSession>;

  return Boolean(
    session.accessToken &&
      session.tokenType === 'Bearer' &&
      typeof session.expiresAt === 'number' &&
      session.driver?.driver_id,
  );
}

function isExpired(session: AuthSession): boolean {
  return session.expiresAt <= Date.now();
}

async function resetStoredSession(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({
      service: SESSION_SERVICE,
    });
  } catch {
    // Native keychain may be unavailable until the app is rebuilt.
  }
}

export async function saveSecureSession(session: AuthSession): Promise<void> {
  cachedSession = session;

  try {
    await Keychain.setGenericPassword(
      SESSION_USERNAME,
      JSON.stringify(session),
      {
        service: SESSION_SERVICE,
      },
    );
  } catch {
    // Keep in-memory session so current app run can continue.
  }
}

export async function loadSecureSession(): Promise<AuthSession | null> {
  if (cachedSession && !isExpired(cachedSession)) {
    return cachedSession;
  }

  try {
    const credentials = await Keychain.getGenericPassword({
      service: SESSION_SERVICE,
    });

    if (!credentials) {
      cachedSession = null;
      return null;
    }

    const parsedValue: unknown = JSON.parse(credentials.password);

    if (!isValidSession(parsedValue) || isExpired(parsedValue)) {
      cachedSession = null;
      await resetStoredSession();
      return null;
    }

    cachedSession = parsedValue;

    return parsedValue;
  } catch {
    cachedSession = null;
    return null;
  }
}

export async function clearSecureSession(): Promise<void> {
  cachedSession = null;

  await resetStoredSession();
}

export function getAccessToken(): string | null {
  if (!cachedSession || isExpired(cachedSession)) {
    return null;
  }

  return cachedSession.accessToken;
}

export async function getAccessTokenAsync(): Promise<string | null> {
  const cachedAccessToken = getAccessToken();

  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const session = await loadSecureSession();

  return session?.accessToken ?? null;
}
