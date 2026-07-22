/**
 * BusLayer.tsx
 *
 * Renders all live buses as GeoJSONSource + Layer components.
 * Rebuilt for @maplibre/maplibre-react-native v11+ (named exports).
 *
 * Old API:  MapLibreGL.ShapeSource / MapLibreGL.CircleLayer / MapLibreGL.SymbolLayer
 * New API:  GeoJSONSource + Layer with type="circle" / type="symbol"
 */

import React, { useMemo } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { BusLocation } from '../../types';
import { getBusDisplayCoordinate } from '../../utils/busDisplay';

interface BusLayerProps {
  buses: BusLocation[];
  selectedBusId: string | null;
  onBusPress: (busId: string) => void;
}

export const BusLayer: React.FC<BusLayerProps> = ({
  buses,
  selectedBusId,
  onBusPress,
}) => {
  const geojsonSource = useMemo(() => {
    const features = buses
      .map(bus => {
        const coord = getBusDisplayCoordinate(bus);
        if (!coord) return null;
        return {
          type: 'Feature' as const,
          id: bus.bus_id,
          geometry: {
            type: 'Point' as const,
            coordinates: [coord.longitude, coord.latitude],
          },
          properties: {
            busId: bus.bus_id,
            routeNumber: bus.routeNumber || '',
            heading: bus.heading ?? 0,
            selected: bus.bus_id === selectedBusId ? 1 : 0,
            speed: bus.speed ?? 0,
            operationalStatus: bus.operationalStatus || 'unknown',
          },
        };
      })
      .filter(Boolean);

    return {
      type: 'FeatureCollection' as const,
      features: features as GeoJSON.Feature[],
    };
  }, [buses, selectedBusId]);

  const handlePress = (event: any) => {
    const feature = event?.features?.[0] ?? event?.nativeEvent?.payload?.features?.[0];
    const busId = feature?.properties?.busId;
    if (busId) {
      onBusPress(busId);
    }
  };

  return (
    <GeoJSONSource
      id="busesSource"
      data={geojsonSource}
      onPress={handlePress}
    >
      {/* Outer ring (selected highlight) */}
      <Layer
        id="busRing"
        type="circle"
        paint={{
          'circle-radius': ['case', ['==', ['get', 'selected'], 1], 24, 18],
          'circle-color': ['case', ['==', ['get', 'selected'], 1], '#1d4ed8', '#2563eb'],
          'circle-opacity': 0.18,
        }}
      />
      {/* Bus dot */}
      <Layer
        id="busDot"
        type="circle"
        paint={{
          'circle-radius': ['case', ['==', ['get', 'selected'], 1], 15, 11],
          'circle-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-stroke-color': ['case', ['==', ['get', 'selected'], 1], '#1d4ed8', '#2563eb'],
        }}
      />
      {/* Route number label */}
      <Layer
        id="busLabel"
        type="symbol"
        layout={{
          'text-field': ['get', 'routeNumber'],
          'text-size': ['case', ['==', ['get', 'selected'], 1], 11, 9],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        }}
        paint={{
          'text-color': '#1e3a5f',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        }}
      />
    </GeoJSONSource>
  );
};
