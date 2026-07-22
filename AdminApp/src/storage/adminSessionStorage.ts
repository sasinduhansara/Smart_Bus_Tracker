import type { AdminSession } from '../types';

const TOKEN_KEY = 'bus-track-admin-token';
const ADMIN_KEY = 'bus-track-admin-profile';

export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getAdminSession(): AdminSession | null {
  const accessToken = getAccessToken();
  const storedProfile = sessionStorage.getItem(ADMIN_KEY);

  if (!accessToken || !storedProfile) {
    return null;
  }

  try {
    return {
      accessToken,
      admin: JSON.parse(storedProfile) as AdminSession['admin'],
    };
  } catch {
    clearAdminSession();
    return null;
  }
}

export function saveAdminSession(session: AdminSession): void {
  sessionStorage.setItem(TOKEN_KEY, session.accessToken);
  sessionStorage.setItem(ADMIN_KEY, JSON.stringify(session.admin));
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_KEY);
}
