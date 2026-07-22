import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { PassengerMapView, type PassengerMapViewRef } from '../components/map/PassengerMapView';
import { SafeAreaView } from 'react-native-safe-area-context';


import {
  formatBusDirection,
  getBusDisplayCoordinate,
  isValidMapCoordinate,
} from '../utils/busDisplay';
import {
  getBuses,
  getRouteDetails,
  getRoutes,
  predictEta,
} from '../services/api';
import { passengerSocket } from '../services/socket';
import type {
  BusLiveStatus,
  BusLocation,
  BusLocationUpdate,
  CoordinatePoint,
  EtaPredictionResponse,
  RouteDetails,
  RouteSummary,
  SocketConnectionStatus,
} from '../types';
import {
  formatLastUpdated,
  getBusStatus,
  getDistanceKm,
} from '../utils/busStatus';
import {
  mergeBusUpdateIntoMap,
  reconcileBusSnapshot,
} from '../utils/busUpdates';
import { passengerColors } from '../theme/tokens';

const DEFAULT_REGION = {
  latitude: 7.4863,
  longitude: 80.3647,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

const ETA_REFRESH_MS = 20000;
const ETA_MOVEMENT_THRESHOLD_KM = 0.05;

const COLORS = {
  primary: passengerColors.primary,
  primaryDark: passengerColors.primaryDark,
  accent: passengerColors.secondary,
  green: passengerColors.success,
  amber: passengerColors.warning,
  red: passengerColors.error,
  blue: passengerColors.secondary,
  background: passengerColors.background,
  card: passengerColors.surfaceRaised,
  border: passengerColors.border,
  text: passengerColors.text,
  muted: passengerColors.textMuted,
  subtle: passengerColors.surface,
  white: passengerColors.white,
};

interface LiveMapScreenProps {
  initialBusId?: string;
  initialRouteNumber?: string;
  initialStopId?: string;
}

function getMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function routePointToLatLng(point: CoordinatePoint): {latitude: number; longitude: number} | null {
  const coordinate = {
    latitude: point.latitude,
    longitude: point.longitude,
  };

  return isValidMapCoordinate(coordinate) ? coordinate : null;
}

function statusLabel(status: SocketConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'reconnecting':
      return 'Reconnecting';
    case 'error':
      return 'Connection error';
    default:
      return 'Disconnected';
  }
}

function busStatusLabel(status: BusLiveStatus): string {
  switch (status) {
    case 'live':
      return 'Live';
    case 'paused':
      return 'Paused';
    case 'stale':
      return 'Stale';
    default:
      return 'Offline';
  }
}

function statusColor(status: BusLiveStatus): string {
  switch (status) {
    case 'live':
      return COLORS.green;
    case 'paused':
      return COLORS.amber;
    case 'stale':
      return COLORS.amber;
    default:
      return COLORS.red;
  }
}

function socketStatusColor(status: SocketConnectionStatus): string {
  switch (status) {
    case 'connected':
      return COLORS.green;
    case 'connecting':
    case 'reconnecting':
      return COLORS.amber;
    case 'error':
      return COLORS.red;
    default:
      return COLORS.muted;
  }
}

function LiveMapScreen({
  initialBusId,
  initialRouteNumber,
  initialStopId,
}: LiveMapScreenProps): React.JSX.Element {
  const mapRef = useRef<PassengerMapViewRef | null>(null);
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const busUpdateSequenceRef = useRef(0);
  const busUpdateRevisionsRef = useRef<Record<string, number>>({});
  const etaRequestInFlightRef = useRef<string | null>(null);
  const etaRequestInFlightContextRef = useRef<string | null>(null);
  const latestEtaRequestKeyRef = useRef<string | null>(null);
  const lastEtaRequestAtRef = useRef(0);
  const lastEtaLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  const [buses, setBuses] = useState<Record<string, BusLocation>>({});
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [routeDetails, setRouteDetails] = useState<RouteDetails | null>(null);
  const [selectedRouteNumber, setSelectedRouteNumber] = useState<string | null>(
    initialRouteNumber || null,
  );
  const [selectedBusId, setSelectedBusId] = useState<string | null>(
    initialBusId || null,
  );
  const [selectedStopId, setSelectedStopId] = useState<string | null>(
    initialStopId || null,
  );
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [socketStatus, setSocketStatus] =
    useState<SocketConnectionStatus>('disconnected');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [etaLoading, setEtaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [etaError, setEtaError] = useState<string | null>(null);
  const [eta, setEta] = useState<EtaPredictionResponse | null>(null);
  const [etaUpdatedAt, setEtaUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const selectedBus = selectedBusId ? buses[selectedBusId] : null;
  const selectedRoute = selectedRouteNumber || selectedBus?.routeNumber || null;
  const selectedBusStatus = selectedBus
    ? getBusStatus(selectedBus, now)
    : null;
  const etaContextKey =
    selectedBus &&
    selectedBusStatus === 'live' &&
    selectedRoute &&
    selectedStopId
      ? [selectedBus.bus_id, selectedRoute, selectedStopId].join(':')
      : null;
  const etaRequestKey =
    etaContextKey && selectedBus
      ? [
          etaContextKey,
          selectedBus.updatedAt || '',
          selectedBus.statusUpdatedAt || '',
        ].join(':')
      : null;
  latestEtaRequestKeyRef.current = etaRequestKey;

  const handleBusUpdate = useCallback((bus: BusLocationUpdate) => {
    if (!mountedRef.current) {
      return;
    }

    const revision = ++busUpdateSequenceRef.current;
    busUpdateRevisionsRef.current[bus.bus_id] = revision;
    setBuses(previousBuses => mergeBusUpdateIntoMap(previousBuses, bus));
  }, []);

  const loadInitialData = useCallback(async (manualRefresh = false) => {
    const sequence = ++requestSequenceRef.current;
    const snapshotBusUpdateSequence = busUpdateSequenceRef.current;

    if (mountedRef.current) {
      if (manualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);
    }

    try {
      const initialBuses = await getBuses();

      if (!mountedRef.current || sequence !== requestSequenceRef.current) {
        return;
      }

      const protectedBusIds = new Set(
        Object.entries(busUpdateRevisionsRef.current)
          .filter(([, revision]) => revision > snapshotBusUpdateSequence)
          .map(([busId]) => busId),
      );
      setBuses(previousBuses =>
        reconcileBusSnapshot(
          previousBuses,
          initialBuses,
          protectedBusIds,
        ),
      );

      const routeResponse = await getRoutes();

      if (mountedRef.current && sequence === requestSequenceRef.current) {
        setRoutes(routeResponse.routes);
      }
    } catch (loadError) {
      if (mountedRef.current && sequence === requestSequenceRef.current) {
        setError(
          getMessage(loadError, 'Unable to load live bus tracking data.'),
        );
      }
    } finally {
      if (mountedRef.current && sequence === requestSequenceRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 10000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let removeBusListener: (() => void) | undefined;
    let removeStatusListener: (() => void) | undefined;

    removeStatusListener = passengerSocket.onStatusChange(setSocketStatus);
    removeBusListener = passengerSocket.onBusLocationUpdate(handleBusUpdate);
    passengerSocket.connect();
    loadInitialData();

    return () => {
      removeBusListener?.();
      removeStatusListener?.();
      passengerSocket.disconnect();
    };
  }, [handleBusUpdate, loadInitialData]);

  useEffect(() => {
    const loadUserLocation = async () => {
      if (Platform.OS === 'android') {
        const permission =
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        const alreadyGranted = await PermissionsAndroid.check(permission);
        const result = alreadyGranted
          ? PermissionsAndroid.RESULTS.GRANTED
          : await PermissionsAndroid.request(permission);

        if (
          !mountedRef.current ||
          result !== PermissionsAndroid.RESULTS.GRANTED
        ) {
          return;
        }
      }

      if (!mountedRef.current) {
        return;
      }

      Geolocation.getCurrentPosition(
        position => {
          if (mountedRef.current) {
            const coordinate = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setUserLocation(
              isValidMapCoordinate(coordinate) ? coordinate : null,
            );
          }
        },
        locationError => {
          console.log('[LiveMap] user location unavailable:', locationError);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        },
      );
    };

    loadUserLocation();
  }, []);

  useEffect(() => {
    if (!selectedRouteNumber) {
      setRouteDetails(null);
      setRouteError(null);
      setSelectedStopId(null);
      return;
    }

    let isMounted = true;
    setRouteLoading(true);
    setRouteError(null);

    getRouteDetails(selectedRouteNumber)
      .then(response => {
        if (!isMounted) {
          return;
        }

        setRouteDetails(response.route);
        setSelectedStopId(currentStopId => {
          if (
            currentStopId &&
            response.route.stops.some(stop => stop.id === currentStopId)
          ) {
            return currentStopId;
          }

          return null;
        });
      })
      .catch(loadError => {
        if (!isMounted) {
          return;
        }

        setRouteDetails(null);
        setRouteError(getMessage(loadError, 'Unable to load route details.'));
      })
      .finally(() => {
        if (isMounted) {
          setRouteLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRouteNumber]);

  useEffect(() => {
    if (selectedRouteNumber) {
      passengerSocket.subscribeRoute(selectedRouteNumber);
      return () => {
        passengerSocket.unsubscribeRoute(selectedRouteNumber);
      };
    }
  }, [selectedRouteNumber]);

  useEffect(() => {
    const routeCoordinates = (routeDetails?.polyline || [])
      .map(routePointToLatLng)
      .filter((point): point is {latitude: number; longitude: number} => point !== null);

    if (routeCoordinates.length < 2) {
      return;
    }

    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;

    routeCoordinates.forEach(coord => {
      if (coord.latitude < minLat) minLat = coord.latitude;
      if (coord.latitude > maxLat) maxLat = coord.latitude;
      if (coord.longitude < minLng) minLng = coord.longitude;
      if (coord.longitude > maxLng) maxLng = coord.longitude;
    });

    const timer = setTimeout(() => {
      mapRef.current?.fitBounds(
        [maxLng, maxLat],
        [minLng, minLat],
        80
      );
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [routeDetails]);

  const routeOptions = useMemo(() => {
    const routeMap = new Map<string, RouteSummary>();

    routes.forEach(route => {
      routeMap.set(route.routeNumber, route);
    });

    Object.values(buses).forEach(bus => {
      if (bus.routeNumber && !routeMap.has(bus.routeNumber)) {
        routeMap.set(bus.routeNumber, {
          routeNumber: bus.routeNumber,
          name: `Route ${bus.routeNumber}`,
          direction: 'outbound',
          stopCount: 0,
        });
      }
    });

    return Array.from(routeMap.values()).sort((routeA, routeB) =>
      routeA.routeNumber.localeCompare(routeB.routeNumber),
    );
  }, [buses, routes]);

  const allBuses = useMemo(
    () =>
      Object.values(buses).sort((busA, busB) =>
        busA.bus_id.localeCompare(busB.bus_id),
      ),
    [buses],
  );

  const filteredBuses = useMemo(
    () =>
      allBuses.filter(bus =>
        selectedRouteNumber ? bus.routeNumber === selectedRouteNumber : true,
      ),
    [allBuses, selectedRouteNumber],
  );

  const mapBuses = useMemo(
    () =>
      filteredBuses.filter(
        bus =>
          getBusStatus(bus, now) !== 'offline' &&
          getBusDisplayCoordinate(bus) !== null,
      ),
    [filteredBuses, now],
  );

  const routePolyline = useMemo(
    () =>
      (routeDetails?.polyline || [])
        .map(routePointToLatLng)
        .filter((point): point is LatLng => point !== null),
    [routeDetails],
  );

  const routeStopsWithCoordinates = useMemo(
    () =>
      (routeDetails?.stops || []).filter(stop =>
        isValidMapCoordinate({
          latitude: stop.latitude,
          longitude: stop.longitude,
        }),
      ),
    [routeDetails],
  );

  const liveBusCount = useMemo(
    () =>
      allBuses.filter(bus => getBusStatus(bus, now) === 'live').length,
    [allBuses, now],
  );

  const selectedStop = useMemo(() => {
    if (!routeDetails || !selectedStopId) {
      return null;
    }

    return (
      routeDetails.stops.find(stop => stop.id === selectedStopId) || null
    );
  }, [routeDetails, selectedStopId]);
  const etaIsStale = Boolean(
    etaUpdatedAt && now - etaUpdatedAt > ETA_REFRESH_MS,
  );

  const handleSelectRoute = useCallback(
    (routeNumber: string | null) => {
      setSelectedRouteNumber(routeNumber);
      setEta(null);
      setEtaUpdatedAt(null);
      setEtaError(null);
      lastEtaRequestAtRef.current = 0;
      lastEtaLocationRef.current = null;

      if (
        routeNumber &&
        selectedBusId &&
        buses[selectedBusId]?.routeNumber !== routeNumber
      ) {
        setSelectedBusId(null);
      }
    },
    [buses, selectedBusId],
  );

  const handleSelectBus = useCallback(
    (bus: BusLocation) => {
      setSelectedBusId(bus.bus_id);
      setEta(null);
      setEtaUpdatedAt(null);
      setEtaError(null);
      lastEtaRequestAtRef.current = 0;
      lastEtaLocationRef.current = null;

      if (bus.routeNumber && bus.routeNumber !== selectedRouteNumber) {
        setSelectedRouteNumber(bus.routeNumber);
        setSelectedStopId(null);
      }

      const displayCoordinate = getBusDisplayCoordinate(bus);
      if (displayCoordinate) {
        mapRef.current?.flyTo(
          displayCoordinate.longitude,
          displayCoordinate.latitude,
          14,
        );
      }
    },
    [selectedRouteNumber],
  );

  useEffect(() => {
    if (
      selectedBus?.routeNumber &&
      selectedBus.routeNumber !== selectedRouteNumber
    ) {
      setSelectedRouteNumber(selectedBus.routeNumber);
      setSelectedStopId(null);
    }
  }, [selectedBus?.routeNumber, selectedRouteNumber]);

  useEffect(() => {
    setEta(null);
    setEtaUpdatedAt(null);
    setEtaError(null);
    setEtaLoading(false);
    lastEtaRequestAtRef.current = 0;
    lastEtaLocationRef.current = null;
  }, [etaContextKey]);

  const requestEta = useCallback(
    async (forceRefresh = false) => {
      if (
        !selectedBus ||
        !selectedStopId ||
        !selectedRoute ||
        !etaContextKey ||
        !etaRequestKey
      ) {
        return;
      }

      if (etaRequestInFlightContextRef.current === etaContextKey) {
        return;
      }

      const currentTime = Date.now();
      const previousLocation = lastEtaLocationRef.current;
      const movedDistanceKm = previousLocation
        ? getDistanceKm(
            previousLocation.lat,
            previousLocation.lng,
            selectedBus.lat,
            selectedBus.lng,
          )
        : Number.POSITIVE_INFINITY;

      if (
        !forceRefresh &&
        eta &&
        currentTime - lastEtaRequestAtRef.current < ETA_REFRESH_MS &&
        movedDistanceKm < ETA_MOVEMENT_THRESHOLD_KM
      ) {
        return;
      }

      etaRequestInFlightRef.current = etaRequestKey;
      etaRequestInFlightContextRef.current = etaContextKey;
      lastEtaRequestAtRef.current = currentTime;
      lastEtaLocationRef.current = {
        lat: selectedBus.lat,
        lng: selectedBus.lng,
      };
      setEtaLoading(true);
      setEtaError(null);

      try {
        const prediction = await predictEta({
          busId: selectedBus.bus_id,
          routeNumber: selectedRoute,
          destinationStopId: selectedStopId,
        });

        if (
          mountedRef.current &&
          latestEtaRequestKeyRef.current === etaRequestKey &&
          prediction.busId === selectedBus.bus_id &&
          prediction.routeNumber === selectedRoute &&
          prediction.destinationStop.id === selectedStopId
        ) {
          setEta(prediction);
          setEtaUpdatedAt(Date.now());
        }
      } catch (predictionError) {
        if (
          mountedRef.current &&
          latestEtaRequestKeyRef.current === etaRequestKey
        ) {
          setEtaError(
            getMessage(predictionError, 'Unable to update ETA prediction.'),
          );
        }
      } finally {
        if (etaRequestInFlightRef.current === etaRequestKey) {
          etaRequestInFlightRef.current = null;
          etaRequestInFlightContextRef.current = null;

          if (mountedRef.current) {
            setEtaLoading(false);
          }
        }
      }
    },
    [
      eta,
      etaContextKey,
      etaRequestKey,
      selectedBus,
      selectedRoute,
      selectedStopId,
    ],
  );

  useEffect(() => {
    requestEta(false);
  }, [requestEta]);

  const renderRouteSelector = () => (
    <View style={styles.routeSelector}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.routeScrollContent}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Show buses from all routes"
          accessibilityState={{ selected: !selectedRouteNumber }}
          style={[
            styles.routeChip,
            !selectedRouteNumber && styles.routeChipActive,
          ]}
          onPress={() => handleSelectRoute(null)}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.routeChipText,
              !selectedRouteNumber && styles.routeChipTextActive,
            ]}
          >
            All routes
          </Text>
        </TouchableOpacity>

        {routeOptions.map(route => {
          const isActive = selectedRouteNumber === route.routeNumber;

          return (
            <TouchableOpacity
              key={route.routeNumber}
              accessibilityRole="button"
              accessibilityLabel={`Show buses on route ${route.routeNumber}`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.routeChip,
                isActive && styles.routeChipActive,
              ]}
              onPress={() => handleSelectRoute(route.routeNumber)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.routeChipText,
                  isActive && styles.routeChipTextActive,
                ]}
              >
                {route.routeNumber}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );



  const renderBottomCard = () => {
    if (loading) {
      return null;
    }

    if (!selectedBus) {
      return (
        <View style={styles.bottomCard}>
          <Text style={styles.cardTitle}>Live buses</Text>
          <Text style={styles.cardMuted}>
            {mapBuses.length > 0
              ? 'Select a bus marker to view route, stops, and ETA.'
              : selectedRouteNumber
              ? 'No buses are active on this route right now.'
              : 'No active buses are available right now.'}
          </Text>

          {!!error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Refresh live buses"
            accessibilityState={{ busy: refreshing, disabled: refreshing }}
            style={styles.secondaryButton}
            onPress={() => loadInitialData(true)}
            disabled={refreshing}
            activeOpacity={0.85}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    const currentBusStatus = getBusStatus(selectedBus, now);
    const etaAvailable = currentBusStatus === 'live' && Boolean(etaContextKey);

    return (
      <ScrollView
        style={styles.bottomCard}
        contentContainerStyle={styles.bottomCardScrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardEyebrow}>Selected bus</Text>
            <Text style={styles.cardTitle}>
              {selectedBus.vehicleRegistrationNumber || selectedBus.bus_id}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor(currentBusStatus) },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {busStatusLabel(currentBusStatus)}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Route</Text>
            <Text style={styles.statValue}>
              {selectedBus.routeNumber || 'Unknown'}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Speed</Text>
            <Text style={styles.statValue}>
              {typeof selectedBus.speed === 'number'
                ? `${selectedBus.speed.toFixed(1)} km/h`
                : 'Unknown'}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Updated</Text>
            <Text style={styles.statValue}>
              {formatLastUpdated(selectedBus.updatedAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.coordinateText}>
          {formatBusDirection(selectedBus.direction)}
        </Text>

        {selectedBus.isRouteDeviation ? (
          <Text style={styles.errorText}>
            Bus location is currently outside the assigned route.
          </Text>
        ) : null}

        {routeLoading && (
          <View style={styles.inlineState}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.inlineStateText}>Loading route</Text>
          </View>
        )}

        {!!routeError && <Text style={styles.errorText}>{routeError}</Text>}

        {!!routeDetails && (
          <>
            <Text style={styles.sectionLabel}>Destination stop</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stopScrollContent}
            >
              {routeDetails.stops.map(stop => {
                const isSelected = selectedStopId === stop.id;

                return (
                  <TouchableOpacity
                    key={stop.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${stop.name} as ETA destination`}
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.stopChip,
                      isSelected && styles.stopChipActive,
                    ]}
                    onPress={() => {
                      setSelectedStopId(stop.id);
                      setEtaError(null);
                      setEta(null);
                      setEtaUpdatedAt(null);
                      lastEtaRequestAtRef.current = 0;
                      lastEtaLocationRef.current = null;
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.stopChipText,
                        isSelected && styles.stopChipTextActive,
                      ]}
                    >
                      {stop.sequence}. {stop.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {!!selectedStop && (
          <View style={styles.etaCard}>
            <View>
              <Text style={styles.cardEyebrow}>
                {etaIsStale || (etaError && eta) ? 'Last ETA to' : 'ETA to'}
              </Text>
              <Text style={styles.etaTitle}>{selectedStop.name}</Text>
            </View>
            {etaLoading && (
              <Text style={styles.updatingText}>Updating ETA...</Text>
            )}
            {eta ? (
              <View
                style={styles.etaResultRow}
                accessible
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${eta.etaMinutes.toFixed(
                  1,
                )} minutes, ${eta.remainingDistanceKm.toFixed(
                  1,
                )} kilometres remaining to ${selectedStop.name}`}
              >
                <Text style={styles.etaMinutes}>
                  {eta.etaMinutes.toFixed(1)} min
                </Text>
                <Text style={styles.etaMeta}>
                  {eta.remainingDistanceKm.toFixed(1)} km remaining
                </Text>
              </View>
            ) : (
              <Text style={styles.cardMuted}>ETA will appear here.</Text>
            )}
            {!!eta?.estimatedArrivalAt && (
              <Text style={styles.etaMeta}>
                Arrival {formatLastUpdated(eta.estimatedArrivalAt)}
              </Text>
            )}
            {!!etaUpdatedAt && (
              <Text style={styles.etaMeta}>
                {etaIsStale || etaError ? 'Last estimate from ' : 'Updated at '}
                {formatLastUpdated(new Date(etaUpdatedAt).toISOString())}
              </Text>
            )}
            {!!etaError && <Text style={styles.errorText}>{etaError}</Text>}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Refresh ETA to ${selectedStop.name}`}
              accessibilityState={{
                busy: etaLoading,
                disabled: etaLoading || !etaAvailable,
              }}
              style={styles.primaryButton}
              onPress={() => requestEta(true)}
              disabled={etaLoading || !etaAvailable}
              activeOpacity={0.85}
            >
              {etaLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Refresh ETA</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
    >
      <PassengerMapView
        ref={mapRef}
        buses={mapBuses}
        selectedBusId={selectedBusId}
        selectedRoute={routeDetails}
        onBusPress={busId => {
          const bus = buses[busId];
          if (bus) handleSelectBus(bus);
        }}
        onMapPress={() => {
          setSelectedBusId(null);
        }}
      />

      <View style={styles.topPanel}>
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.title}>Live Bus Tracker</Text>
            <Text style={styles.subtitle}>
              {liveBusCount} live of {allBuses.length} tracked buses
            </Text>
          </View>
          <View style={styles.socketPill}>
            <View
              style={[
                styles.socketDot,
                { backgroundColor: socketStatusColor(socketStatus) },
              ]}
            />
            <Text style={styles.socketText}>
              {statusLabel(socketStatus)}
            </Text>
          </View>
        </View>
        {renderRouteSelector()}
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading live buses</Text>
        </View>
      )}

      {!loading && !error && mapBuses.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyTitle}>No buses on the map</Text>
          <Text style={styles.emptyText}>
            {selectedRouteNumber
              ? 'This route has no recent bus locations.'
              : 'No public bus locations are available yet.'}
          </Text>
        </View>
      )}

      {renderBottomCard()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    flex: 1,
  },
  topPanel: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  socketPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.subtle,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  socketDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  socketText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  routeSelector: {
    marginTop: 12,
  },
  routeScrollContent: {
    gap: 8,
    paddingRight: 6,
  },
  routeChip: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  routeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  routeChipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  routeChipTextActive: {
    color: COLORS.white,
  },
  busMarker: {
    width: 44,
    height: 34,
    borderRadius: 8,
    borderWidth: 3,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  busMarkerSelected: {
    backgroundColor: COLORS.accent,
  },
  busMarkerText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '900',
  },
  loadingOverlay: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.text,
    fontWeight: '700',
  },
  emptyOverlay: {
    position: 'absolute',
    top: '42%',
    left: 28,
    right: 28,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
  },
  emptyText: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  bottomCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    maxHeight: '62%',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  bottomCardScrollContent: {
    paddingBottom: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardEyebrow: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  cardMuted: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.subtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  coordinateText: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 10,
  },
  sectionLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
  },
  stopScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  stopChip: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: 220,
  },
  stopChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  stopChipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  stopChipTextActive: {
    color: COLORS.white,
  },
  etaCard: {
    marginTop: 14,
    backgroundColor: passengerColors.primarySoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: passengerColors.border,
    padding: 12,
  },
  etaTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  etaResultRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  etaMinutes: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: '900',
  },
  etaMeta: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  updatingText: {
    color: COLORS.amber,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  inlineState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  inlineStateText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: COLORS.red,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '800',
  },
});

export default LiveMapScreen;
