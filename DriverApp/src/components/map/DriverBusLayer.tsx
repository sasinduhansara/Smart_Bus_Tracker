import React from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { TripLocation } from "../../types";

interface DriverBusLayerProps {
  location: TripLocation | null;
}

export const DriverBusLayer: React.FC<DriverBusLayerProps> = ({ location }) => {
  if (!location) return null;

  const shape = {
    type: "Point",
    coordinates: [location.lng, location.lat],
  };

  return (
    <GeoJSONSource id="driverBusSource" data={shape as any}>
      <Layer
        id="driverBusOuter"
        type="circle"
        paint={{
          'circle-radius': 14,
          'circle-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#16a34a',
          'circle-opacity': 0.8,
        }}
      />
      <Layer
        id="driverBusInner"
        type="circle"
        paint={{
          'circle-radius': 8,
          'circle-color': '#16a34a', // Green for own bus
        }}
      />
    </GeoJSONSource>
  );
};
