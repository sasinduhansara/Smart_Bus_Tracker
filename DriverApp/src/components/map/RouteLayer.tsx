import React from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { RouteDetails } from "../../types";

interface RouteLayerProps {
  route: RouteDetails;
}

export const RouteLayer: React.FC<RouteLayerProps> = ({ route }) => {
  // If we have a GeoJSON geometry from OSRM, use it.
  // Otherwise, fallback to the legacy polyline.
  const hasGeoJson = route.geometry?.type === "LineString" && Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length > 0;
  
  const lineSource = React.useMemo(() => {
    if (hasGeoJson) {
      return route.geometry;
    }
    
    // Fallback: convert legacy polyline to GeoJSON LineString
    const coords = route.polyline?.map(p => [p.longitude, p.latitude]) || [];
    return {
      type: "LineString",
      coordinates: coords
    };
  }, [route, hasGeoJson]);

  const stopsSource = React.useMemo(() => {
    const features = (route.stops || [])
      .filter(s => (s.longitude && s.latitude) || (s.location?.coordinates))
      .map(s => {
        const lng = s.location?.coordinates[0] ?? s.longitude;
        const lat = s.location?.coordinates[1] ?? s.latitude;
        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          properties: {
            id: s.id || s.sequence.toString(),
            name: s.name,
            sequence: s.sequence,
          },
        };
      });

    return {
      type: "FeatureCollection",
      features,
    };
  }, [route.stops]);

  // Don't render if no coordinates
  if (lineSource.coordinates.length < 2) return null;

  return (
    <>
      <GeoJSONSource id="routeSource" data={lineSource as any}>
        <Layer
          id="routeLine"
          type="line"
          layout={{
            'line-join': 'round',
            'line-cap': 'round',
          }}
          paint={{
            'line-color': '#2563eb', // Blue
            'line-width': 5,
            'line-opacity': 0.8,
          }}
        />
      </GeoJSONSource>

      <GeoJSONSource id="stopsSource" data={stopsSource as any}>
        <Layer
          id="stopsPointsOuter"
          type="circle"
          paint={{
            'circle-radius': 8,
            'circle-color': '#ffffff',
          }}
        />
        <Layer
          id="stopsPointsInner"
          type="circle"
          paint={{
            'circle-radius': 5,
            'circle-color': '#475569', // Slate
          }}
        />
        <Layer
          id="stopsLabels"
          type="symbol"
          layout={{
            'text-field': ['get', 'sequence'],
            'text-size': 10,
            'text-offset': [0, 1.5],
          }}
          paint={{
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1,
          }}
        />
      </GeoJSONSource>
    </>
  );
};
