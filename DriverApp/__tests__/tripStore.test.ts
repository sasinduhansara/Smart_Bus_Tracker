jest.mock('../src/services/api', () => ({
  completeDriverTrip: jest.fn(),
  getActiveTrip: jest.fn(),
  pauseDriverTrip: jest.fn(),
  resumeDriverTrip: jest.fn(),
  startDriverTrip: jest.fn(),
}));

jest.mock('../src/services/secureTrip', () => ({
  clearActiveTrip: jest.fn().mockResolvedValue(undefined),
  loadActiveTrip: jest.fn().mockResolvedValue(null),
  saveActiveTrip: jest.fn().mockResolvedValue(undefined),
}));

import {
  completeDriverTrip,
  getActiveTrip,
  pauseDriverTrip,
  resumeDriverTrip,
  startDriverTrip,
} from '../src/services/api';
import {
  clearActiveTrip,
  loadActiveTrip,
  saveActiveTrip,
} from '../src/services/secureTrip';
import { useTripStore } from '../src/store/useTripStore';
import type {
  DriverTrip,
  TripLocation,
  TripMutationResponse,
} from '../src/types';

const mockedGetActiveTrip = jest.mocked(getActiveTrip);
const mockedStartTrip = jest.mocked(startDriverTrip);
const mockedPauseTrip = jest.mocked(pauseDriverTrip);
const mockedResumeTrip = jest.mocked(resumeDriverTrip);
const mockedCompleteTrip = jest.mocked(completeDriverTrip);
const mockedLoadCachedTrip = jest.mocked(loadActiveTrip);
const mockedSaveTrip = jest.mocked(saveActiveTrip);
const mockedClearTrip = jest.mocked(clearActiveTrip);
const DRIVER_ID = 'driver-1';
const START_LOCATION: TripLocation = {
  lat: 7.4688,
  lng: 80.0401,
  speed: 0,
  heading: 0,
  accuracy: 8,
  timestamp: '2026-07-18T10:00:00.000Z',
};

function trip(status: DriverTrip['status'] = 'active'): DriverTrip {
  return {
    id: 'trip-1',
    driverId: DRIVER_ID,
    busId: 'NC-1234',
    vehicleRegistrationNumber: 'NC-1234',
    routeNumber: '138',
    routeName: 'Homagama - Pettah',
    origin: 'Homagama',
    destination: 'Pettah',
    status,
    startedAt: '2026-07-18T09:00:00.000Z',
    durationSeconds: 0,
    activeDurationSeconds: 0,
    distanceKm: 0,
  };
}

function mutation(
  status: TripMutationResponse['status'],
  driverTrip: DriverTrip,
): TripMutationResponse {
  return {
    status,
    trip: driverTrip,
    bus: {
      bus_id: 'NC-1234',
      routeNumber: '138',
      operationalStatus:
        driverTrip.status === 'completed' ? 'offline' : driverTrip.status,
      isActive: driverTrip.status === 'active',
      statusUpdatedAt: '2026-07-18T10:00:00.000Z',
    },
  };
}

describe('active trip store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadCachedTrip.mockResolvedValue(null);
    mockedClearTrip.mockResolvedValue(undefined);
    mockedSaveTrip.mockResolvedValue(undefined);
    useTripStore.setState({
      trip: null,
      phase: 'idle',
      error: null,
      restoredFromCache: false,
    });
  });

  test('restores the authoritative active trip and caches it securely', async () => {
    const activeTrip = trip();
    mockedGetActiveTrip.mockResolvedValue({ status: 'success', trip: activeTrip });

    await expect(useTripStore.getState().restore(DRIVER_ID)).resolves.toEqual(
      activeTrip,
    );

    expect(mockedLoadCachedTrip).toHaveBeenCalledWith(DRIVER_ID);
    expect(mockedSaveTrip).toHaveBeenCalledWith(activeTrip);
    expect(useTripStore.getState()).toMatchObject({
      trip: activeTrip,
      phase: 'active',
      restoredFromCache: false,
    });
  });

  test('preserves a cached unfinished trip during a network outage', async () => {
    const cachedTrip = trip('paused');
    mockedLoadCachedTrip.mockResolvedValue(cachedTrip);
    mockedGetActiveTrip.mockRejectedValue(new Error('Backend unavailable'));

    await expect(useTripStore.getState().restore(DRIVER_ID)).resolves.toEqual(
      cachedTrip,
    );

    expect(useTripStore.getState()).toMatchObject({
      trip: cachedTrip,
      phase: 'paused',
      restoredFromCache: true,
      error: 'Backend unavailable',
    });
  });

  test('rejects a cached trip owned by another driver', async () => {
    mockedLoadCachedTrip.mockResolvedValue(null);
    mockedGetActiveTrip.mockResolvedValue({
      status: 'success',
      trip: { ...trip(), driverId: 'driver-2' },
    });

    await expect(useTripStore.getState().restore(DRIVER_ID)).resolves.toBeNull();

    expect(mockedClearTrip).toHaveBeenCalled();
    expect(useTripStore.getState()).toMatchObject({
      trip: null,
      phase: 'failed',
      restoredFromCache: false,
    });
  });

  test('prevents a duplicate start before making an API request', async () => {
    useTripStore.setState({ trip: trip(), phase: 'active' });

    await expect(useTripStore.getState().start(START_LOCATION)).rejects.toThrow(
      'unfinished trip already exists',
    );
    expect(mockedStartTrip).not.toHaveBeenCalled();
  });

  test('posts the prepared location and prevents a concurrent duplicate start', async () => {
    let resolveStart: ((value: TripMutationResponse) => void) | undefined;
    const startResponse = mutation('started', trip());
    mockedStartTrip.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveStart = resolve;
        }),
    );

    const firstStart = useTripStore.getState().start(START_LOCATION);
    await Promise.resolve();

    await expect(
      useTripStore.getState().start(START_LOCATION),
    ).rejects.toThrow('unfinished trip already exists');
    expect(mockedStartTrip).toHaveBeenCalledTimes(1);
    expect(mockedStartTrip).toHaveBeenCalledWith(START_LOCATION);

    resolveStart?.(startResponse);
    await expect(firstStart).resolves.toEqual(startResponse.trip);
  });

  test('persists pause and resume transitions', async () => {
    const activeTrip = trip('active');
    const pausedTrip = trip('paused');
    useTripStore.setState({ trip: activeTrip, phase: 'active' });
    mockedPauseTrip.mockResolvedValue(mutation('paused', pausedTrip));
    mockedResumeTrip.mockResolvedValue(mutation('resumed', activeTrip));

    await useTripStore.getState().pause();
    expect(useTripStore.getState().phase).toBe('paused');
    await useTripStore.getState().resume();

    expect(mockedPauseTrip).toHaveBeenCalledWith('trip-1');
    expect(mockedResumeTrip).toHaveBeenCalledWith('trip-1');
    expect(mockedSaveTrip).toHaveBeenLastCalledWith(activeTrip);
    expect(useTripStore.getState().phase).toBe('active');
  });

  test('clears secure active-trip state only after backend completion succeeds', async () => {
    const activeTrip = trip();
    const completedTrip = trip('completed');
    useTripStore.setState({ trip: activeTrip, phase: 'active' });
    mockedCompleteTrip.mockResolvedValue(
      mutation('completed', completedTrip),
    );

    await expect(useTripStore.getState().complete()).resolves.toEqual(
      completedTrip,
    );

    expect(mockedClearTrip).toHaveBeenCalledTimes(1);
    expect(useTripStore.getState()).toMatchObject({ trip: null, phase: 'idle' });
  });
});
