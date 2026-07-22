/**
 * PassengerApp/__tests__/busState.test.ts
 *
 * Unit tests for live bus state updates, recency calculations, and status classification.
 */

import { getBusStatus, getDistanceKm } from '../src/utils/busStatus';
import { mergeBusUpdateIntoMap } from '../src/utils/busUpdates';
import type { BusLocation, BusLocationUpdate } from '../src/types';

describe('PassengerApp Bus State Management', () => {
  const now = 1700000000000;
  const recentIso = new Date(now - 10000).toISOString(); // 10s ago
  const staleIso = new Date(now - 70000).toISOString();  // 70s ago

  const baseBus: BusLocation = {
    bus_id: 'bus-1',
    routeNumber: '100',
    lat: 6.9271,
    lng: 79.8612,
    updatedAt: recentIso,
    operationalStatus: 'active',
    isActive: true,
  };

  describe('getBusStatus', () => {
    it('returns "live" for recently updated active bus', () => {
      expect(getBusStatus(baseBus, now)).toBe('live');
    });

    it('returns "stale" for bus with older update timestamp', () => {
      const staleBus = { ...baseBus, updatedAt: staleIso };
      expect(getBusStatus(staleBus, now)).toBe('stale');
    });

    it('returns "paused" when operationalStatus is paused', () => {
      const pausedBus = { ...baseBus, operationalStatus: 'paused' as const };
      expect(getBusStatus(pausedBus, now)).toBe('paused');
    });

    it('returns "offline" when isActive is false', () => {
      const offlineBus = { ...baseBus, isActive: false };
      expect(getBusStatus(offlineBus, now)).toBe('offline');
    });
  });

  describe('mergeBusUpdateIntoMap', () => {
    it('merges new update into bus map', () => {
      const initialMap = { 'bus-1': baseBus };
      const update: BusLocationUpdate = {
        bus_id: 'bus-1',
        lat: 6.9280,
        lng: 79.8620,
        speed: 35.0,
        updatedAt: new Date(now).toISOString(),
      };

      const result = mergeBusUpdateIntoMap(initialMap, update);
      expect(result['bus-1'].lat).toBe(6.9280);
      expect(result['bus-1'].speed).toBe(35.0);
    });
  });

  describe('getDistanceKm', () => {
    it('calculates accurate haversine distance between two points', () => {
      // Colombo to Panadura ~25 km
      const distance = getDistanceKm(6.9271, 79.8612, 6.7106, 79.9074);
      expect(distance).toBeGreaterThan(20);
      expect(distance).toBeLessThan(30);
    });
  });
});
