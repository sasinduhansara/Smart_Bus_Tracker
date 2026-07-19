import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { BusLocation } from '../../types';
import { getBusDisplayCoordinate } from '../../utils/busDisplay';

interface AnimatedBusMarkerProps {
  bus: BusLocation;
  borderColor: string;
  selected: boolean;
  onPress: () => void;
}

export default function AnimatedBusMarker({
  bus,
  borderColor,
  selected,
  onPress,
}: AnimatedBusMarkerProps) {
  const displayCoordinate = useMemo(
    () => getBusDisplayCoordinate(bus),
    [bus],
  );
  const markerRef = useRef<React.ComponentRef<typeof Marker>>(null);

  useEffect(() => {
    markerRef.current?.animateMarkerToCoordinate(displayCoordinate, 1200);
  }, [displayCoordinate]);

  return (
    <Marker
      ref={markerRef}
      identifier={`bus:${bus.bus_id}`}
      coordinate={displayCoordinate}
      title={bus.vehicleRegistrationNumber || bus.bus_id}
      description={bus.routeNumber ? `Route ${bus.routeNumber}` : undefined}
      rotation={bus.heading || 0}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      zIndex={selected ? 10 : 5}
    >
      <View
        style={[
          styles.marker,
          { borderColor },
          selected && styles.selected,
        ]}
      >
        <Text style={styles.icon}>🚌</Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    transform: [{ scale: 1.12 }],
  },
  icon: {
    fontSize: 22,
  },
});
