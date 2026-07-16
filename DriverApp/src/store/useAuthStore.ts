import { create } from 'zustand';

import type {
  AuthSession,
  VerificationStatus,
  VerifyOTPResponse,
} from '../types';

import {
  clearSecureSession,
  loadSecureSession,
  saveSecureSession,
} from '../services/secureSession';

const DEFAULT_SESSION_SECONDS = 30 * 24 * 60 * 60;

interface AuthState {
  session: AuthSession | null;
  isHydrated: boolean;
  isAuthenticating: boolean;

  establishSession: (response: VerifyOTPResponse) => Promise<AuthSession>;

  hydrateSession: () => Promise<void>;

  updateVerificationStatus: (status: VerificationStatus) => Promise<void>;

  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isHydrated: false,
  isAuthenticating: false,

  establishSession: async response => {
    if (!response.accessToken) {
      throw new Error('Authentication token was not returned by the server.');
    }

    const session: AuthSession = {
      accessToken: response.accessToken,
      tokenType: response.tokenType || 'Bearer',
      expiresAt:
        Date.now() +
        (response.expiresInSeconds || DEFAULT_SESSION_SECONDS) * 1000,
      driver: {
        driver_id: response.driver_id,
        _id: response.driver_id,
        fullName: response.fullName,
        mobile: response.mobile,
        verificationStatus: response.verificationStatus,
      },
    };

    set({
      isAuthenticating: true,
    });

    try {
      await saveSecureSession(session);

      set({
        session,
        isAuthenticating: false,
      });

      return session;
    } catch (error) {
      set({
        isAuthenticating: false,
      });

      throw error;
    }
  },

  hydrateSession: async () => {
    try {
      const session = await loadSecureSession();

      set({
        session,
        isHydrated: true,
      });
    } catch {
      set({
        session: null,
        isHydrated: true,
      });
    }
  },

  updateVerificationStatus: async status => {
    const currentSession = get().session;

    if (!currentSession) {
      return;
    }

    const updatedSession: AuthSession = {
      ...currentSession,
      driver: {
        ...currentSession.driver,
        verificationStatus: status,
      },
    };

    await saveSecureSession(updatedSession);

    set({
      session: updatedSession,
    });
  },

  logout: async () => {
    await clearSecureSession();

    set({
      session: null,
    });
  },
}));
