import React, { useRef, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Map, Camera, type CameraRef } from "@maplibre/maplibre-react-native";
import { MAP_CONFIG } from "../../config/map";
import { RouteLayer } from "./RouteLayer";
import { DriverBusLayer } from "./DriverBusLayer";
import type { RouteDetails, TripLocation } from "../../types";

interface DriverMapViewProps {
  route: RouteDetails | null;
  currentLocation: TripLocation | null;
  snappedLocation?: TripLocation | null;
}

export const DriverMapView: React.FC<DriverMapViewProps> = ({
  route,
  currentLocation,
  snappedLocation,
}) => {
  const cameraRef = useRef<CameraRef>(null);
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Focus on route or current location when available
  useEffect(() => {
    if (!isMapLoaded || !cameraRef.current) return;

    if (route && route.stops && route.stops.length > 0) {
      // Create a bounding box for the route
      let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
      
      route.stops.forEach((s) => {
        const lng = s.location?.coordinates[0] ?? s.longitude;
        const lat = s.location?.coordinates[1] ?? s.latitude;
        if (lng && lat) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      });
      
      // If we have a valid bounds, fit camera
      if (minLng < maxLng && minLat < maxLat) {
        cameraRef.current.fitBounds(
          [minLng, minLat, maxLng, maxLat],
          { duration: 1000, padding: { top: 50, right: 50, bottom: 50, left: 50 } }
        );
        return;
      }
    }
    
    // Fallback to current location if route bounds fail
    if (currentLocation) {
      cameraRef.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 14,
        duration: 1000,
      });
    }
  }, [isMapLoaded, route]);
  
  // Follow driver location as it updates if map is loaded
  useEffect(() => {
    if (isMapLoaded && currentLocation && cameraRef.current) {
        // If they are driving, keep them in view
        cameraRef.current.easeTo({
            center: [currentLocation.lng, currentLocation.lat],
            duration: 500,
        });
    }
  }, [currentLocation?.lat, currentLocation?.lng, isMapLoaded]);

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={MAP_CONFIG.styleUrl}
        logo={false}
        attributionPosition={{ bottom: 8, right: 8 }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            centerCoordinate: MAP_CONFIG.defaultCenter,
            zoomLevel: MAP_CONFIG.defaultZoom,
          }}
          minZoom={MAP_CONFIG.minZoom}
          maxZoom={MAP_CONFIG.maxZoom}
        />

        {route && <RouteLayer route={route} />}
        
        {/* Draw snapped location if available, otherwise raw location */}
        <DriverBusLayer location={snappedLocation || currentLocation} />
        
      </Map>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
