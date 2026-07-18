import {
  LOCATION_MAX_ACCURACY_METERS,
  toTripLocation,
  validateDriverLocationSnapshot,
  type DriverLocationSnapshot,
} from '../src/hooks/useDriverLocationTracking';

function snapshot(
  overrides: Partial<DriverLocationSnapshot> = {},
): DriverLocationSnapshot {
  return {
    latitude: 6.9271,
    longitude: 79.8612,
    speedKmh: 25,
    heading: 90,
    accuracy: 8,
    recordedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('driver GPS validation', () => {
  test('creates the minimal backend location contract', () => {
    expect(toTripLocation(snapshot())).toEqual({
      lat: 6.9271,
      lng: 79.8612,
      speed: 25,
      heading: 90,
      accuracy: 8,
      timestamp: expect.any(String),
    });
  });

  test('accepts a fresh, accurate Sri Lankan coordinate', () => {
    expect(validateDriverLocationSnapshot(snapshot())).toBeNull();
  });

  test('rejects invalid coordinates, stale fixes, and poor accuracy', () => {
    expect(
      validateDriverLocationSnapshot(snapshot({ latitude: Number.NaN })),
    ).toMatch(/invalid coordinate/i);
    expect(
      validateDriverLocationSnapshot(
        snapshot({ recordedAt: new Date(Date.now() - 60000).toISOString() }),
      ),
    ).toMatch(/stale/i);
    expect(
      validateDriverLocationSnapshot(
        snapshot({ accuracy: LOCATION_MAX_ACCURACY_METERS + 1 }),
      ),
    ).toMatch(/accuracy is too low/i);
  });

  test('rejects missing accuracy, unreasonable speed, and invalid heading', () => {
    expect(
      validateDriverLocationSnapshot(
        snapshot({ accuracy: Number.NaN }),
      ),
    ).toMatch(/accuracy is too low/i);
    expect(
      validateDriverLocationSnapshot(snapshot({ speedKmh: 201 })),
    ).toMatch(/invalid speed/i);
    expect(
      validateDriverLocationSnapshot(snapshot({ heading: 360 })),
    ).toMatch(/invalid heading/i);
  });
});
