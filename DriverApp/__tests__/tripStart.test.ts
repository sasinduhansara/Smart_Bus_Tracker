import { ApiError } from '../src/services/api';
import {
  executeTripStart,
  presentGpsPreflightError,
  presentTripStartError,
} from '../src/utils/tripStart';

describe('trip-start UI error presentation', () => {
  test('shows the nearest terminal and safe distance details outside a geofence', () => {
    const presentation = presentTripStartError(
      new ApiError(
        'Move closer to a route terminal.',
        403,
        'OUTSIDE_START_GEOFENCE',
        {
          nearestTerminal: {
            id: 'kuliyapitiya',
            name: 'Kuliyapitiya Bus Stand',
            distanceMeters: 1240,
            allowedRadiusMeters: 500,
          },
        },
      ),
    );

    expect(presentation).toMatchObject({
      status: 'outside_geofence',
      title: 'Too far from route terminal',
      canOpenSettings: false,
    });
    expect(presentation.message).toContain('Kuliyapitiya Bus Stand');
    expect(presentation.message).toContain('1.2 km');
    expect(presentation.message).toContain('500 m');
    expect(presentation.message).not.toContain('7.4688');
  });

  test('offers device settings when location permission is blocked', () => {
    expect(
      presentGpsPreflightError(
        'blocked',
        'Location permission is blocked.',
      ),
    ).toMatchObject({
      status: 'permission_required',
      canOpenSettings: true,
    });
  });

  test('provides an actionable state for weak GPS accuracy', () => {
    expect(
      presentTripStartError(
        new ApiError(
          'GPS accuracy is too low.',
          422,
          'LOCATION_ACCURACY_TOO_LOW',
        ),
      ),
    ).toMatchObject({
      status: 'accuracy_low',
      canOpenSettings: true,
    });
  });

  test('fails safely when the route has no configured terminals', () => {
    expect(
      presentTripStartError(
        new ApiError(
          'No terminals configured.',
          409,
          'ROUTE_TERMINALS_NOT_CONFIGURED',
        ),
      ),
    ).toMatchObject({
      status: 'terminal_unavailable',
      canOpenSettings: false,
    });
  });
});

describe('trip-start execution order', () => {
  const snapshot = { latitude: 7.4688, longitude: 80.0401, accuracy: 8 };
  const location = {
    lat: 7.4688,
    lng: 80.0401,
    accuracy: 8,
    timestamp: '2026-07-19T10:00:00.000Z',
  };

  test('requests a fresh location and starts one watcher only after backend success', async () => {
    const calls: string[] = [];
    const prepareLocation = jest.fn(async () => {
      calls.push('location');
      return snapshot;
    });
    const startTrip = jest.fn(async () => {
      calls.push('backend');
      return { id: 'trip-1', status: 'active' };
    });
    const startTracking = jest.fn(async () => {
      calls.push('watcher');
      return true;
    });

    const result = await executeTripStart({
      prepareLocation,
      mapLocation: () => location,
      startTrip,
      startTracking,
    });

    expect(calls).toEqual(['location', 'backend', 'watcher']);
    expect(startTrip).toHaveBeenCalledWith(location);
    expect(startTracking).toHaveBeenCalledTimes(1);
    expect(startTracking).toHaveBeenCalledWith(snapshot, {
      initialLocationAlreadyAccepted: true,
    });
    expect(result).toMatchObject({
      status: 'accepted',
      watcherStarted: true,
      trip: { status: 'active' },
    });
  });

  test('does not start GPS tracking before a rejected backend start', async () => {
    const startTracking = jest.fn(async () => true);

    await expect(
      executeTripStart({
        prepareLocation: async () => snapshot,
        mapLocation: () => location,
        startTrip: async () => {
          throw new ApiError('Outside terminal', 403, 'OUTSIDE_START_GEOFENCE');
        },
        startTracking,
      }),
    ).rejects.toMatchObject({ code: 'OUTSIDE_START_GEOFENCE' });
    expect(startTracking).not.toHaveBeenCalled();
  });

  test('allows retrying location acquisition after an unavailable fix', async () => {
    const prepareLocation = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(snapshot);
    const startTrip = jest.fn(async () => ({ id: 'trip-1' }));
    const startTracking = jest.fn(async () => true);
    const execution = {
      prepareLocation,
      mapLocation: () => location,
      startTrip,
      startTracking,
    };

    await expect(executeTripStart(execution)).resolves.toEqual({
      status: 'location_unavailable',
    });
    await expect(executeTripStart(execution)).resolves.toMatchObject({
      status: 'accepted',
    });
    expect(prepareLocation).toHaveBeenCalledTimes(2);
    expect(startTrip).toHaveBeenCalledTimes(1);
  });
});
