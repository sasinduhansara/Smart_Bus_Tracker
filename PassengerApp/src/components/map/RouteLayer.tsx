/**
 * RouteLayer.tsx (PassengerApp)
 *
 * Renders the selected route's polyline and stop markers
 * using GeoJSONSource + Layer (type="line", type="circle", type="symbol").
 * Rebuilt for @maplibre/maplibre-react-native v11+ (named exports).
 */

import React, { useMemo } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { RouteDetails, CoordinatePoint } from '../../types';

interface RouteLayerProps {
  route: RouteDetails;
}

function buildLineGeojson(route: RouteDetails) {
  // Prefer GeoJSON geometry if available; fallback to legacy polyline
  if (
    (route as any).geometry?.type === 'LineString' &&
    Array.isArray((route as any).geometry.coordinates) &&
    (route as any).geometry.coordinates.length >= 2
  ) {
    return (route as any).geometry;
  }

  if (route.polyline && route.polyline.length >= 2) {
    return {
      type: 'LineString',
      coordinates: route.polyline.map((p: CoordinatePoint) => [
        p.longitude,
        p.latitude,
      ]),
    };
  }

  return null;
}

function buildStopsGeojson(route: RouteDetails) {
  const stops = route.stops || [];
  const features = stops
    .filter(
      (s: any) =>
        (s.location?.coordinates?.length === 2) ||
        (typeof s.latitude === 'number' && typeof s.longitude === 'number'),
    )
    .map((s: any) => {
      const lng = s.location?.coordinates?.[0] ?? s.longitude;
      const lat = s.location?.coordinates?.[1] ?? s.latitude;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          name: s.name || '',
          sequence: s.sequence ?? 0,
        },
      };
    });

  return { type: 'FeatureCollection', features };
}

export const RouteLayer: React.FC<RouteLayerProps> = ({ route }) => {
  const lineGeojson = useMemo(() => buildLineGeojson(route), [route]);
  const stopsGeojson = useMemo(() => buildStopsGeojson(route), [route]);

  return (
    <>
      {/* Route line */}
      {lineGeojson && (
        <GeoJSONSource id="passengerRouteSource" data={lineGeojson as any}>
          {/* Casing (shadow) */}
          <Layer
            id="passengerRouteCasing"
            type="line"
            layout={{
              'line-join': 'round',
              'line-cap': 'round',
            }}
            paint={{
              'line-color': '#1e3a5f',
              'line-width': 7,
              'line-opacity': 0.3,
            }}
          />
          {/* Main line */}
          <Layer
            id="passengerRouteLine"
            type="line"
            layout={{
              'line-join': 'round',
              'line-cap': 'round',
            }}
            paint={{
              'line-color': '#2563eb',
              'line-width': 5,
              'line-opacity': 0.85,
            }}
          />
        </GeoJSONSource>
      )}

      {/* Stops */}
      <GeoJSONSource id="passengerStopsSource" data={stopsGeojson as any}>
        <Layer
          id="passengerStopOuter"
          type="circle"
          paint={{
            'circle-radius': 7,
            'circle-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#475569',
          }}
        />
        <Layer
          id="passengerStopInner"
          type="circle"
          paint={{
            'circle-radius': 4,
            'circle-color': '#475569',
          }}
        />
        <Layer
          id="passengerStopLabel"
          type="symbol"
          layout={{
            'text-field': ['get', 'name'],
            'text-size': 10,
            'text-offset': [0, 1.6],
            'text-anchor': 'top',
          }}
          paint={{
            'text-color': '#0f172a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.2,
          }}
        />
      </GeoJSONSource>
    </>
  );
};
