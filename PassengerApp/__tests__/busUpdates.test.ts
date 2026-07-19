import {
  normalizeBusLocation,
  normalizeBusLocationUpdate,
} from '../src/services/api';
import type { BusLocation } from '../src/types';
import { getBusStatus } from '../src/utils/busStatus';
import { getBusDisplayCoordinate } from '../src/utils/busDisplay';
import {
  mergeBusLocationUpdate,
  mergeBusSnapshot,
  mergeBusUpdateIntoMap,
  reconcileBusSnapshot,
} from '../src/utils/busUpdates';

const liveBus: BusLocation = {
  bus_id: 'WP-NB-1234',
  vehicleRegistrationNumber: 'WP-NB-1234',
  routeNumber: '138',
  lat: 6.9271,
  lng: 79.8612,
  updatedAt: '2026-07-16T12:00:10.000Z',
  isActive: true,
  operationalStatus: 'active',
};

describe('passenger bus update contract', () => {
  it('uses road-aware display coordinates while preserving raw GPS truth', () => {
    const update = normalizeBusLocation({
      bus_id: 'WP-NB-1234',
      routeNumber: '123',
      lat: 7.469,
      lng: 80.1,
      rawLatitude: 7.469,
      rawLongitude: 80.1,
      displayLatitude: 7.472,
      displayLongitude: 80.1,
      distanceFromRouteMeters: 24,
      isRouteDeviation: false,
      direction: 'kuliyapitiya_to_kurunegala',
      operationalStatus: 'active',
      isActive: true,
      updatedAt: '2026-07-19T12:00:00.000Z',
      driverMobile: 'must-not-be-consumed',
    });

    expect(update).not.toBeNull();
    expect(getBusDisplayCoordinate(update!)).toEqual({
      latitude: 7.472,
      longitude: 80.1,
    });
    expect(update).toMatchObject({
      lat: 7.469,
      lng: 80.1,
      isRouteDeviation: false,
    });
    expect(update).not.toHaveProperty('driverMobile');
  });

  it('keeps one canonical marker identity across subsequent display updates', () => {
    const current = { [liveBus.bus_id]: liveBus };
    const next = mergeBusUpdateIntoMap(current, {
      bus_id: liveBus.bus_id,
      lat: 6.9272,
      lng: 79.8613,
      displayLatitude: 6.92725,
      displayLongitude: 79.86135,
      updatedAt: '2026-07-16T12:00:20.000Z',
    });

    expect(Object.keys(next)).toEqual([liveBus.bus_id]);
    expect(next[liveBus.bus_id].displayLatitude).toBe(6.92725);
  });

  it('normalizes lifecycle-only updates without requiring coordinates', () => {
    expect(
      normalizeBusLocationUpdate({
        bus_id: 'WP-NB-1234',
        operationalStatus: 'paused',
        isActive: true,
        tripId: 'trip-1',
        activeTripId: 'trip-1',
        updatedAt: '2026-07-16T12:00:20.000Z',
      }),
    ).toEqual({
      bus_id: 'WP-NB-1234',
      operationalStatus: 'paused',
      isActive: true,
      tripId: 'trip-1',
      activeTripId: 'trip-1',
      updatedAt: '2026-07-16T12:00:20.000Z',
    });

    expect(
      normalizeBusLocation({
        bus_id: 'WP-NB-1234',
        operationalStatus: 'offline',
        updatedAt: '2026-07-16T12:00:30.000Z',
      }),
    ).toBeNull();
  });

  it('rejects malformed lifecycle updates and partial coordinates', () => {
    expect(
      normalizeBusLocationUpdate({
        bus_id: 'WP-NB-1234',
        operationalStatus: 'completed',
        updatedAt: '2026-07-16T12:00:20.000Z',
      }),
    ).toBeNull();
    expect(
      normalizeBusLocationUpdate({
        bus_id: 'WP-NB-1234',
        lat: 6.9271,
        updatedAt: '2026-07-16T12:00:20.000Z',
      }),
    ).toBeNull();
    expect(
      normalizeBusLocationUpdate({
        bus_id: 'WP-NB-1234',
        lat: 6.9271,
        lng: 79.8612,
        speed: 250,
        updatedAt: '2026-07-16T12:00:20.000Z',
      }),
    ).toBeNull();
  });

  it('preserves the last coordinates when pause and end events arrive', () => {
    const paused = mergeBusLocationUpdate(liveBus, {
      bus_id: liveBus.bus_id,
      operationalStatus: 'paused',
      statusUpdatedAt: '2026-07-16T12:00:20.000Z',
    });
    const ended = mergeBusLocationUpdate(paused, {
      bus_id: liveBus.bus_id,
      operationalStatus: 'offline',
      isActive: false,
      activeTripId: '',
      updatedAt: '2026-07-16T12:00:30.000Z',
    });

    expect(paused).toMatchObject({
      lat: liveBus.lat,
      lng: liveBus.lng,
      operationalStatus: 'paused',
    });
    expect(ended).toMatchObject({
      lat: liveBus.lat,
      lng: liveBus.lng,
      operationalStatus: 'offline',
      isActive: false,
      activeTripId: '',
    });
    expect(getBusStatus(paused!, Date.parse('2026-07-16T12:00:21.000Z'))).toBe(
      'paused',
    );
    expect(getBusStatus(ended!, Date.parse('2026-07-16T12:00:31.000Z'))).toBe(
      'offline',
    );
  });

  it('does not let an older fetch or event overwrite a newer update', () => {
    const newerSocketBus: BusLocation = {
      ...liveBus,
      lat: 6.95,
      updatedAt: '2026-07-16T12:00:30.000Z',
    };
    const olderFetchBus: BusLocation = {
      ...liveBus,
      lat: 6.9,
      updatedAt: '2026-07-16T12:00:20.000Z',
    };
    const current = { [liveBus.bus_id]: newerSocketBus };

    expect(mergeBusUpdateIntoMap(current, olderFetchBus)).toBe(current);
    expect(mergeBusSnapshot(current, [olderFetchBus])).toBe(current);
    expect(mergeBusSnapshot(current, [olderFetchBus])[liveBus.bus_id]).toBe(
      newerSocketBus,
    );
  });

  it('ignores an unknown status-only bus until a full location is available', () => {
    expect(
      mergeBusUpdateIntoMap({}, {
        bus_id: 'unknown-bus',
        operationalStatus: 'offline',
        updatedAt: '2026-07-16T12:00:30.000Z',
      }),
    ).toEqual({});
  });

  it('marks buses absent from an authoritative snapshot offline', () => {
    const reconciled = reconcileBusSnapshot(
      { [liveBus.bus_id]: liveBus },
      [],
      new Set(),
      '2026-07-16T12:01:00.000Z',
    );

    expect(reconciled[liveBus.bus_id]).toMatchObject({
      operationalStatus: 'offline',
      isActive: false,
      activeTripId: '',
      tripId: '',
      statusUpdatedAt: '2026-07-16T12:01:00.000Z',
    });
  });

  it('preserves a socket update that arrived after snapshot loading began', () => {
    const socketBus: BusLocation = {
      ...liveBus,
      lat: 6.95,
      updatedAt: '2026-07-16T12:01:00.000Z',
    };
    const reconciled = reconcileBusSnapshot(
      { [liveBus.bus_id]: socketBus },
      [],
      new Set([liveBus.bus_id]),
    );

    expect(reconciled[liveBus.bus_id]).toBe(socketBus);
  });
});
