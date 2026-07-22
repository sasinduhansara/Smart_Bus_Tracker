/**
 * PassengerMapView.tsx
 *
 * The primary MapLibre map wrapper for the PassengerApp.
 * Rebuilt for @maplibre/maplibre-react-native v11+ which exports
 * named components (Map, Camera, GeoJSONSource, Layer) rather than
 * a default namespace object.
 */

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Map,
  Camera,
  type CameraRef,
} from '@maplibre/maplibre-react-native';

import { BusLayer } from './BusLayer';
import { RouteLayer } from './RouteLayer';
import type { BusLocation, RouteDetails } from '../../types';

// Default to Sri Lanka
const DEFAULT_CENTER: [number, number] = [80.7718, 7.8731];
const DEFAULT_ZOOM = 8;

const MAP_STYLE =
  'https://tiles.openfreemap.org/styles/bright';

export interface PassengerMapViewRef {
  flyTo: (longitude: number, latitude: number, zoom?: number) => void;
  fitBounds: (
    ne: [number, number],
    sw: [number, number],
    padding?: number,
  ) => void;
}

interface PassengerMapViewProps {
  buses: BusLocation[];
  selectedBusId: string | null;
  selectedRoute: RouteDetails | null;
  onBusPress: (busId: string) => void;
  onMapPress?: () => void;
  children?: React.ReactNode;
}

export const PassengerMapView = forwardRef<
  PassengerMapViewRef,
  PassengerMapViewProps
>(
  (
    {
      buses,
      selectedBusId,
      selectedRoute,
      onBusPress,
      onMapPress,
      children,
    },
    ref,
  ) => {
    const cameraRef = useRef<CameraRef>(null);

    useImperativeHandle(ref, () => ({
      flyTo(longitude, latitude, zoom = 14) {
        cameraRef.current?.flyTo({
          center: [longitude, latitude],
          zoom,
          duration: 600,
        });
      },
      fitBounds(ne, sw, padding = 50) {
        // LngLatBounds format: [west, south, east, north]
        cameraRef.current?.fitBounds(
          [sw[0], sw[1], ne[0], ne[1]],
          { duration: 800, padding: { top: padding, right: padding, bottom: padding, left: padding } },
        );
      },
    }));

    return (
      <View style={styles.container}>
        <Map
          style={styles.map}
          mapStyle={MAP_STYLE}
          logo={false}
          attributionPosition={{ bottom: 8, right: 8 }}
          dragPan={true}
          touchZoom={true}
          doubleTapZoom={true}
          doubleTapHoldZoom={true}
          touchRotate={false}
          touchPitch={false}
          onPress={onMapPress ? () => onMapPress() : undefined}
        >
          <Camera
            ref={cameraRef}
            initialViewState={{
              center: DEFAULT_CENTER,
              zoom: DEFAULT_ZOOM,
            }}
            minZoom={5}
            maxZoom={18}
          />

          {/* Route line and stops for the selected route */}
          {selectedRoute && <RouteLayer route={selectedRoute} />}

          {/* All live buses */}
          <BusLayer
            buses={buses}
            selectedBusId={selectedBusId}
            onBusPress={onBusPress}
          />

          {children}
        </Map>
      </View>
    );
  },
);

PassengerMapView.displayName = 'PassengerMapView';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
