/**
 * DriverApp/__tests__/geospatial.test.ts
 *
 * Unit tests for DriverApp location snapping and route coordinate utilities.
 */

import { formatBusDirection, isValidMapCoordinate } from '../src/utils/busDisplay';

describe('DriverApp Geospatial Utilities', () => {
  describe('isValidMapCoordinate', () => {
    it('returns true for valid Sri Lanka coordinates', () => {
      expect(isValidMapCoordinate({ latitude: 6.9271, longitude: 79.8612 })).toBe(true);
      expect(isValidMapCoordinate({ latitude: 7.8731, longitude: 80.7718 })).toBe(true);
    });

    it('returns false for null or undefined values', () => {
      expect(isValidMapCoordinate(null as any)).toBe(false);
      expect(isValidMapCoordinate(undefined as any)).toBe(false);
    });

    it('returns false for out-of-range coordinates', () => {
      expect(isValidMapCoordinate({ latitude: 91.0, longitude: 80.0 })).toBe(false);
      expect(isValidMapCoordinate({ latitude: 7.0, longitude: 181.0 })).toBe(false);
      expect(isValidMapCoordinate({ latitude: 0, longitude: 0 })).toBe(false);
    });
  });

  describe('formatBusDirection', () => {
    it('formats outbound and return directions correctly', () => {
      expect(formatBusDirection('outbound')).toBe('Outbound');
      expect(formatBusDirection('return')).toBe('Return');
      expect(formatBusDirection('inbound')).toBe('Return');
    });

    it('handles unknown or empty direction gracefully', () => {
      expect(formatBusDirection('')).toBe('');
      expect(formatBusDirection(undefined)).toBe('');
    });
  });
});
