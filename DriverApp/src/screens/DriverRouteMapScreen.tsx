import React from "react";
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { DriverMapView } from "../components/map/DriverMapView";
import { useDriverLocationTracking } from "../hooks/useDriverLocationTracking";
import { useDriverRoute } from "../hooks/useDriverRoute";

export const DriverRouteMapScreen = () => {
  const { lastLocation, snappedLocation, isTracking } = useDriverLocationTracking();
  const { route, duty, loading, error, refresh } = useDriverRoute();

  const currentLocation = lastLocation
    ? {
        lat: lastLocation.latitude,
        lng: lastLocation.longitude,
        timestamp: lastLocation.recordedAt,
        speed: lastLocation.speedKmh,
        heading: lastLocation.heading,
        accuracy: lastLocation.accuracy,
      }
    : null;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading Route Map…</Text>
      </View>
    );
  }

  if (error || !route) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error ?? "Route not assigned"}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DriverMapView
        route={route}
        currentLocation={currentLocation}
        snappedLocation={snappedLocation}
      />

      {duty?.routeNumber && (
        <View style={styles.routeBadge}>
          <Text style={styles.routeBadgeText}>{duty.routeNumber}</Text>
        </View>
      )}

      {!isTracking && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>⚠ Location Tracking Paused</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#94a3b8",
    fontWeight: "500",
  },
  errorText: {
    fontSize: 15,
    color: "#f87171",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  routeBadge: {
    position: "absolute",
    top: 52,
    left: 16,
    backgroundColor: "rgba(37, 99, 235, 0.92)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  routeBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  offlineBanner: {
    position: "absolute",
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: "rgba(239, 68, 68, 0.92)",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  offlineText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});


