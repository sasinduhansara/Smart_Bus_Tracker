import type {
  BusLocation,
  BusStop,
  RouteDetails,
  RouteSummary,
} from '../src/types';
import {
  buildNearbyBuses,
  findClosestStop,
  searchRoutesAndStops,
  selectEtaStop,
} from '../src/utils/passengerHome';

const routes: RouteSummary[] = [
  {
    routeNumber: '138',
    name: 'Kottawa - Pettah',
    direction: 'Inbound via Maharagama',
    stopCount: 3,
  },
  {
    routeNumber: '122',
    name: 'Avissawella - Pettah',
    direction: 'Inbound via Homagama',
    stopCount: 2,
  },
];

const route138Stops: BusStop[] = [
  {
    id: 'kottawa',
    name: 'Kottawa',
    sequence: 1,
    latitude: 0,
    longitude: 0,
  },
  {
    id: 'maharagama',
    name: 'Maharagama Stop',
    sequence: 2,
    latitude: 0,
    longitude: 0.01,
  },
  {
    id: 'pettah',
    name: 'Pettah',
    sequence: 3,
    latitude: 0,
    longitude: 0.02,
  },
];

const routeDetails: Record<string, RouteDetails> = {
  '138': {
    routeNumber: '138',
    name: 'Kottawa - Pettah',
    direction: 'Inbound via Maharagama',
    polyline: [],
    stops: route138Stops,
  },
  '122': {
    routeNumber: '122',
    name: 'Avissawella - Pettah',
    direction: 'Inbound via Homagama',
    polyline: [],
    stops: [
      {
        id: 'homagama',
        name: 'Homagama Town',
        sequence: 1,
        latitude: 0,
        longitude: 0.005,
      },
      {
        id: 'pettah',
        name: 'Pettah',
        sequence: 2,
        latitude: 0,
        longitude: 0.03,
      },
    ],
  },
};

describe('passenger home utilities', () => {
  describe('searchRoutesAndStops', () => {
    it('matches normalized route fields and stop names', () => {
      expect(searchRoutesAndStops('  138  ', routes, routeDetails)).toEqual([
        {
          id: 'route:138',
          type: 'route',
          title: 'Route 138',
          subtitle: 'Kottawa - Pettah',
          routeNumber: '138',
        },
      ]);

      expect(
        searchRoutesAndStops('  maHaRaGaMa  ', routes, routeDetails),
      ).toEqual([
        {
          id: 'route:138',
          type: 'route',
          title: 'Route 138',
          subtitle: 'Kottawa - Pettah',
          routeNumber: '138',
        },
        {
          id: 'stop:138:maharagama',
          type: 'stop',
          title: 'Maharagama Stop',
          subtitle: 'Route 138 · Kottawa - Pettah',
          routeNumber: '138',
          stopId: 'maharagama',
        },
      ]);
    });

    it('returns no results for a blank query and respects the result limit', () => {
      expect(searchRoutesAndStops('   ', routes, routeDetails)).toEqual([]);

      const results = searchRoutesAndStops('pettah', routes, routeDetails, 3);

      expect(results).toHaveLength(3);
      expect(results.map(result => result.id)).toEqual([
        'route:138',
        'route:122',
        'stop:122:pettah',
      ]);
    });
  });

  describe('selectEtaStop', () => {
    const route = routeDetails['138'];

    it('selects the following stop when the bus is within 250 metres', () => {
      const bus: BusLocation = {
        bus_id: 'near-kottawa',
        lat: 0,
        lng: 0.001,
      };

      expect(findClosestStop(bus, route)?.id).toBe('kottawa');
      expect(selectEtaStop(bus, route)?.id).toBe('maharagama');
    });

    it('keeps the closest stop when it is farther away and handles no route', () => {
      const bus: BusLocation = {
        bus_id: 'approaching-maharagama',
        lat: 0,
        lng: 0.013,
      };

      expect(findClosestStop(bus, route)?.id).toBe('maharagama');
      expect(selectEtaStop(bus, route)?.id).toBe('maharagama');
      expect(selectEtaStop(bus)).toBeUndefined();
    });

    it('does not advance beyond the final stop', () => {
      const bus: BusLocation = {
        bus_id: 'at-pettah',
        lat: 0,
        lng: 0.02,
      };

      expect(selectEtaStop(bus, route)?.id).toBe('pettah');
    });
  });

  describe('buildNearbyBuses', () => {
    const now = Date.parse('2026-07-16T12:00:00.000Z');
    const buses: BusLocation[] = [
      {
        bus_id: 'far-live',
        routeNumber: '138',
        lat: 0,
        lng: 0.02,
        updatedAt: '2026-07-16T11:59:55.000Z',
      },
      {
        bus_id: 'near-stale',
        routeNumber: '122',
        lat: 0,
        lng: 0.001,
        updatedAt: '2026-07-16T11:59:00.000Z',
      },
      {
        bus_id: 'closest-offline',
        routeNumber: '999',
        lat: 0,
        lng: 0.0002,
      },
    ];

    it('sorts by user distance while retaining status and route metadata', () => {
      const nearby = buildNearbyBuses(
        buses,
        routes,
        routeDetails,
        { latitude: 0, longitude: 0 },
        now,
      );

      expect(nearby.map(item => item.bus.bus_id)).toEqual([
        'closest-offline',
        'near-stale',
        'far-live',
      ]);
      expect(nearby.map(item => item.status)).toEqual([
        'offline',
        'stale',
        'live',
      ]);
      expect(nearby[1]).toMatchObject({
        routeName: 'Avissawella - Pettah',
        destinationName: 'Pettah',
        etaLoading: false,
      });
      expect(nearby[2].distanceKm).toBeGreaterThan(nearby[1].distanceKm ?? 0);
      expect(nearby[0].routeName).toBeUndefined();
      expect(nearby[0].destinationName).toBeUndefined();
      expect(nearby[0].nextStop).toBeUndefined();
    });

    it('falls back to live status then update recency without a location', () => {
      const olderLive: BusLocation = {
        ...buses[0],
        bus_id: 'older-live',
        updatedAt: '2026-07-16T11:59:40.000Z',
      };
      const nearby = buildNearbyBuses(
        [buses[1], olderLive, buses[2], buses[0]],
        routes,
        routeDetails,
        null,
        now,
      );

      expect(nearby.map(item => item.bus.bus_id)).toEqual([
        'far-live',
        'older-live',
        'near-stale',
        'closest-offline',
      ]);
      expect(nearby.every(item => item.distanceKm === undefined)).toBe(true);
    });
  });
});
