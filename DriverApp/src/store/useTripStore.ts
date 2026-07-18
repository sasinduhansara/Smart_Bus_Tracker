import { create } from 'zustand';

import {
  completeDriverTrip,
  getActiveTrip,
  pauseDriverTrip,
  resumeDriverTrip,
  startDriverTrip,
} from '../services/api';
import {
  clearActiveTrip,
  loadActiveTrip,
  saveActiveTrip,
} from '../services/secureTrip';
import type { DriverTrip } from '../types';

export type TripPhase =
  | 'idle'
  | 'restoring'
  | 'starting'
  | 'active'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'ending'
  | 'failed';

interface TripState {
  trip: DriverTrip | null;
  phase: TripPhase;
  error: string | null;
  restoredFromCache: boolean;
  restore: (driverId: string) => Promise<DriverTrip | null>;
  start: () => Promise<DriverTrip>;
  pause: () => Promise<DriverTrip>;
  resume: () => Promise<DriverTrip>;
  complete: () => Promise<DriverTrip>;
  clearError: () => void;
  reset: () => Promise<void>;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function stablePhase(trip: DriverTrip | null): TripPhase {
  if (trip?.status === 'active') {
    return 'active';
  }

  if (trip?.status === 'paused') {
    return 'paused';
  }

  return 'idle';
}

export const useTripStore = create<TripState>((set, get) => ({
  trip: null,
  phase: 'idle',
  error: null,
  restoredFromCache: false,

  restore: async driverId => {
    set({ phase: 'restoring', error: null, restoredFromCache: false });
    const cachedTrip = await loadActiveTrip(driverId);

    if (cachedTrip) {
      set({
        trip: cachedTrip,
        phase: stablePhase(cachedTrip),
        restoredFromCache: true,
      });
    }

    try {
      const response = await getActiveTrip();
      const activeTrip = response.trip;

      if (activeTrip && activeTrip.driverId !== driverId) {
        await clearActiveTrip();
        throw new Error('The backend returned a trip owned by another driver.');
      }

      if (activeTrip) {
        await saveActiveTrip(activeTrip);
      } else {
        await clearActiveTrip();
      }

      set({
        trip: activeTrip,
        phase: stablePhase(activeTrip),
        error: null,
        restoredFromCache: false,
      });

      return activeTrip;
    } catch (error) {
      const message = messageFrom(
        error,
        'The active trip could not be restored from the backend.',
      );

      set({
        trip: cachedTrip,
        phase: cachedTrip ? stablePhase(cachedTrip) : 'failed',
        error: message,
        restoredFromCache: Boolean(cachedTrip),
      });

      return cachedTrip;
    }
  },

  start: async () => {
    if (get().trip) {
      throw new Error('An unfinished trip already exists.');
    }

    set({ phase: 'starting', error: null });

    try {
      const response = await startDriverTrip();
      await saveActiveTrip(response.trip);
      set({ trip: response.trip, phase: 'active', restoredFromCache: false });
      return response.trip;
    } catch (error) {
      const message = messageFrom(error, 'The trip could not be started.');
      set({ phase: 'failed', error: message });
      throw error;
    }
  },

  pause: async () => {
    const currentTrip = get().trip;

    if (!currentTrip || currentTrip.status !== 'active') {
      throw new Error('Only an active trip can be paused.');
    }

    set({ phase: 'pausing', error: null });

    try {
      const response = await pauseDriverTrip(currentTrip.id);
      await saveActiveTrip(response.trip);
      set({ trip: response.trip, phase: 'paused' });
      return response.trip;
    } catch (error) {
      const message = messageFrom(error, 'The trip could not be paused.');
      set({ phase: 'active', error: message });
      throw error;
    }
  },

  resume: async () => {
    const currentTrip = get().trip;

    if (!currentTrip || currentTrip.status !== 'paused') {
      throw new Error('Only a paused trip can be resumed.');
    }

    set({ phase: 'resuming', error: null });

    try {
      const response = await resumeDriverTrip(currentTrip.id);
      await saveActiveTrip(response.trip);
      set({ trip: response.trip, phase: 'active', restoredFromCache: false });
      return response.trip;
    } catch (error) {
      const message = messageFrom(error, 'The trip could not be resumed.');
      set({ phase: 'paused', error: message });
      throw error;
    }
  },

  complete: async () => {
    const currentTrip = get().trip;

    if (!currentTrip) {
      throw new Error('There is no unfinished trip to end.');
    }

    const rollbackPhase = stablePhase(currentTrip);
    set({ phase: 'ending', error: null });

    try {
      const response = await completeDriverTrip(currentTrip.id);
      await clearActiveTrip();
      set({
        trip: null,
        phase: 'idle',
        error: null,
        restoredFromCache: false,
      });
      return response.trip;
    } catch (error) {
      const message = messageFrom(error, 'The trip could not be ended.');
      set({ phase: rollbackPhase, error: message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),

  reset: async () => {
    await clearActiveTrip();
    set({
      trip: null,
      phase: 'idle',
      error: null,
      restoredFromCache: false,
    });
  },
}));
