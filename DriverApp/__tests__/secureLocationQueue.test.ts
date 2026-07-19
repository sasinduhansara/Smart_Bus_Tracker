import * as Keychain from 'react-native-keychain';

import {
  clearTripLocationQueue,
  enqueueTripLocation,
  getNewestFreshTripLocation,
  removeQueuedLocationsThrough,
} from '../src/services/secureLocationQueue';
import type { TripLocation } from '../src/types';

const mockedKeychain = jest.mocked(Keychain);

function location(timestamp: string, lat: number): TripLocation {
  return {
    lat,
    lng: 80.0401,
    accuracy: 8,
    speed: 20,
    heading: 90,
    timestamp,
  };
}

describe('secure active-trip location queue', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockedKeychain.getGenericPassword.mockResolvedValue(false);
    mockedKeychain.setGenericPassword.mockResolvedValue({} as never);
    mockedKeychain.resetGenericPassword.mockResolvedValue(false);
    await clearTripLocationQueue();
    jest.clearAllMocks();
  });

  test('keeps only the newest fresh active-trip fix for replay', async () => {
    const now = Date.parse('2026-07-19T10:02:00.000Z');
    await enqueueTripLocation(
      'trip-1',
      location('2026-07-19T10:01:00.000Z', 7.4688),
    );
    await enqueueTripLocation(
      'trip-1',
      location('2026-07-19T10:01:30.000Z', 7.4699),
    );

    await expect(getNewestFreshTripLocation('trip-1', now)).resolves.toMatchObject({
      lat: 7.4699,
      timestamp: '2026-07-19T10:01:30.000Z',
    });
  });

  test('does not replay expired telemetry', async () => {
    await enqueueTripLocation(
      'trip-1',
      location('2026-07-19T09:55:00.000Z', 7.4688),
    );

    await expect(
      getNewestFreshTripLocation(
        'trip-1',
        Date.parse('2026-07-19T10:00:00.000Z'),
      ),
    ).resolves.toBeNull();
  });

  test('removes accepted fixes without deleting another trip queue', async () => {
    await enqueueTripLocation(
      'trip-1',
      location('2026-07-19T10:00:00.000Z', 7.4688),
    );
    await enqueueTripLocation(
      'trip-1',
      location('2026-07-19T10:00:10.000Z', 7.4699),
    );
    await enqueueTripLocation(
      'trip-2',
      location('2026-07-19T10:00:00.000Z', 7.5),
    );

    await removeQueuedLocationsThrough(
      'trip-1',
      '2026-07-19T10:00:00.000Z',
    );

    await expect(
      getNewestFreshTripLocation(
        'trip-1',
        Date.parse('2026-07-19T10:00:20.000Z'),
      ),
    ).resolves.toMatchObject({ lat: 7.4699 });
    await expect(
      getNewestFreshTripLocation(
        'trip-2',
        Date.parse('2026-07-19T10:00:20.000Z'),
      ),
    ).resolves.toMatchObject({ lat: 7.5 });
  });

  test('bounds persisted telemetry to twenty fixes', async () => {
    for (let index = 0; index < 25; index += 1) {
      await enqueueTripLocation(
        'trip-1',
        location(new Date(Date.UTC(2026, 6, 19, 10, 0, index)).toISOString(), 7 + index / 1000),
      );
    }

    const lastWrite = mockedKeychain.setGenericPassword.mock.calls.at(-1);
    expect(lastWrite).toBeDefined();
    expect(JSON.parse(lastWrite?.[1] || '[]')).toHaveLength(20);
  });
});
