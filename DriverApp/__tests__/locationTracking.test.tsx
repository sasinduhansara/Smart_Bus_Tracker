jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: {
    requestAuthorization: jest.fn().mockResolvedValue('granted'),
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  },
}));

jest.mock('../src/services/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;

    constructor(message: string, status = 0, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  sendDriverLocation: jest.fn(),
}));

import React from 'react';
import { PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import ReactTestRenderer from 'react-test-renderer';

import {
  LOCATION_HEARTBEAT_MS,
  LOCATION_SEND_INTERVAL_MS,
  useDriverLocationTracking,
} from '../src/hooks/useDriverLocationTracking';
import { ApiError, sendDriverLocation } from '../src/services/api';
import type { DriverLocationResponse } from '../src/services/api';

type TrackingHook = ReturnType<typeof useDriverLocationTracking>;

const mockedPermissions = jest.mocked(PermissionsAndroid);
const mockedSendLocation = jest.mocked(sendDriverLocation);
const mockGeolocation = jest.mocked(Geolocation);

let currentHook: TrackingHook | null = null;
let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
const trackingRejected = jest.fn();

function HookHarness() {
  currentHook = useDriverLocationTracking({
    onTrackingRejected: trackingRejected,
  });
  return null;
}

function position() {
  return {
    coords: {
      latitude: 6.9271,
      longitude: 79.8612,
      speed: 5,
      heading: 90,
      accuracy: 8,
      altitude: null,
      altitudeAccuracy: null,
    },
    timestamp: Date.now(),
  };
}

describe('foreground location watcher lifecycle', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    currentHook = null;
    mockedPermissions.check.mockResolvedValue(true);
    mockGeolocation.getCurrentPosition.mockImplementation(success =>
      success(position()),
    );
    mockGeolocation.watchPosition.mockReturnValue(7);
    mockedSendLocation.mockResolvedValue({
      status: 'success',
      bus: {
        bus_id: 'NC-1234',
        operationalStatus: 'active',
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
    });

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<HookHarness />);
    });
  });

  afterEach(async () => {
    const activeRenderer = renderer;
    renderer = null;

    if (activeRenderer) {
      await ReactTestRenderer.act(async () => activeRenderer.unmount());
    }

    jest.useRealTimers();
  });

  test('creates only one watcher and clears it on stop', async () => {
    expect(currentHook).not.toBeNull();
    let firstStart = false;
    let secondStart = false;

    await ReactTestRenderer.act(async () => {
      firstStart = (await currentHook?.startTracking()) || false;
      secondStart = (await currentHook?.startTracking()) || false;
      await Promise.resolve();
    });

    expect(currentHook?.error).toBeNull();
    expect(firstStart).toBe(true);
    expect(secondStart).toBe(true);
    expect(mockGeolocation.watchPosition).toHaveBeenCalledTimes(1);
    expect(mockedSendLocation).toHaveBeenCalledTimes(1);

    ReactTestRenderer.act(() => currentHook?.stopTracking());

    expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(7);
  });

  test('starts one watcher without re-uploading a start location already accepted by backend', async () => {
    let prepared: Awaited<ReturnType<TrackingHook['prepareLocation']>> = null;
    let started = false;

    await ReactTestRenderer.act(async () => {
      prepared = (await currentHook?.prepareLocation()) || null;
      started =
        (await currentHook?.startTracking(prepared || undefined, {
          initialLocationAlreadyAccepted: true,
        })) || false;
    });

    expect(prepared).not.toBeNull();
    expect(started).toBe(true);
    expect(mockGeolocation.watchPosition).toHaveBeenCalledTimes(1);
    expect(mockedSendLocation).not.toHaveBeenCalled();
    expect(currentHook?.isTracking).toBe(true);
    expect(currentHook?.transmissionStatus).toBe('online');
  });

  test('does not create a watcher when foreground permission is denied', async () => {
    mockedPermissions.check.mockResolvedValue(false);
    mockedPermissions.request.mockResolvedValue(
      PermissionsAndroid.RESULTS.DENIED,
    );
    let prepared: Awaited<ReturnType<TrackingHook['prepareLocation']>> = null;

    await ReactTestRenderer.act(async () => {
      prepared = (await currentHook?.prepareLocation()) || null;
    });

    expect(prepared).toBeNull();
    expect(mockedPermissions.request).toHaveBeenCalledTimes(1);
    expect(mockGeolocation.watchPosition).not.toHaveBeenCalled();
    expect(currentHook?.permissionStatus).toBe('denied');

    await ReactTestRenderer.act(async () => {
      prepared = (await currentHook?.prepareLocation()) || null;
    });

    expect(prepared).toBeNull();
    expect(mockedPermissions.request).toHaveBeenCalledTimes(1);
  });

  test('queues only the latest fix while an upload is in flight', async () => {
    jest.useFakeTimers();
    let resolveInitialUpload:
      | ((value: DriverLocationResponse) => void)
      | undefined;
    const initialUpload = new Promise<DriverLocationResponse>(resolve => {
      resolveInitialUpload = resolve;
    });
    mockedSendLocation
      .mockImplementationOnce(() => initialUpload)
      .mockResolvedValue({
        status: 'success',
        bus: {
          bus_id: 'NC-1234',
          operationalStatus: 'active',
          isActive: true,
          updatedAt: new Date().toISOString(),
        },
      });

    let startPromise: Promise<boolean> | undefined;
    await ReactTestRenderer.act(async () => {
      startPromise = currentHook?.startTracking();
      await Promise.resolve();
      await Promise.resolve();
    });

    const onWatchPosition = mockGeolocation.watchPosition.mock.calls[0][0];
    ReactTestRenderer.act(() => {
      onWatchPosition({
        ...position(),
        coords: { ...position().coords, latitude: 6.928 },
      });
      onWatchPosition({
        ...position(),
        coords: { ...position().coords, latitude: 6.929 },
      });
    });

    await ReactTestRenderer.act(async () => {
      resolveInitialUpload?.({
        status: 'success',
        bus: {
          bus_id: 'NC-1234',
          operationalStatus: 'active',
          isActive: true,
        },
      });
      await startPromise;
    });

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(LOCATION_SEND_INTERVAL_MS);
      await Promise.resolve();
    });

    expect(mockedSendLocation).toHaveBeenCalledTimes(2);
    expect(mockedSendLocation.mock.calls[1][0].lat).toBe(6.929);

    ReactTestRenderer.act(() => currentHook?.stopTracking());
    jest.useRealTimers();
  });

  test('sends a fresh foreground heartbeat while the bus is stationary', async () => {
    jest.useFakeTimers();

    await ReactTestRenderer.act(async () => {
      await currentHook?.startTracking();
      await Promise.resolve();
    });

    expect(mockedSendLocation).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(LOCATION_HEARTBEAT_MS);
      await Promise.resolve();
    });

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(mockedSendLocation).toHaveBeenCalledTimes(2);

    ReactTestRenderer.act(() => currentHook?.stopTracking());
    jest.useRealTimers();
  });

  test('stops retrying after the bounded backoff sequence', async () => {
    jest.useFakeTimers();

    await ReactTestRenderer.act(async () => {
      await currentHook?.startTracking();
      await Promise.resolve();
    });

    mockedSendLocation.mockRejectedValue(new Error('Network unavailable'));
    const onWatchPosition = mockGeolocation.watchPosition.mock.calls[0][0];

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(LOCATION_SEND_INTERVAL_MS);
      onWatchPosition({
        ...position(),
        coords: { ...position().coords, latitude: 6.93 },
      });
      await Promise.resolve();
    });

    for (const delay of [1000, 2000, 4000]) {
      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(delay);
        await Promise.resolve();
      });
    }

    expect(mockedSendLocation).toHaveBeenCalledTimes(5);
    expect(currentHook?.transmissionStatus).toBe('offline');

    ReactTestRenderer.act(() => currentHook?.stopTracking());
    jest.useRealTimers();
  });

  test('stops the watcher when backend trip authority rejects tracking', async () => {
    jest.useFakeTimers();
    const rejection = new ApiError(
      'An active trip is required before sharing GPS location',
      409,
      'NO_ACTIVE_TRIP',
    );

    await ReactTestRenderer.act(async () => {
      await currentHook?.startTracking();
      await Promise.resolve();
    });

    mockedSendLocation.mockRejectedValue(rejection);
    const onWatchPosition = mockGeolocation.watchPosition.mock.calls[0][0];

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(LOCATION_SEND_INTERVAL_MS);
      onWatchPosition({
        ...position(),
        coords: { ...position().coords, latitude: 6.93 },
      });
      await Promise.resolve();
    });

    expect(mockedSendLocation).toHaveBeenCalledTimes(2);
    expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(7);
    expect(currentHook?.isTracking).toBe(false);
    expect(currentHook?.transmissionStatus).toBe('rejected');
    expect(trackingRejected).toHaveBeenCalledWith(rejection);

    jest.useRealTimers();
  });

  test('does not claim tracking when the first backend upload fails', async () => {
    mockedSendLocation.mockRejectedValue(new Error('Network unavailable'));
    let started = true;

    await ReactTestRenderer.act(async () => {
      started = (await currentHook?.startTracking()) || false;
    });

    expect(started).toBe(false);
    expect(mockedSendLocation).toHaveBeenCalledTimes(1);
    expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(7);
    expect(currentHook?.isTracking).toBe(false);
    expect(currentHook?.transmissionStatus).toBe('offline');
  });
});
