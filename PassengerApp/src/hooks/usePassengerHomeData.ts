import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng } from 'react-native-maps';

import {
  getBuses,
  getRouteDetails,
  getRoutes,
  predictEta,
} from '../services/api';
import { passengerSocket } from '../services/socket';
import type {
  BusLocation,
  EtaPredictionResponse,
  NearbyBus,
  RouteDetails,
  RouteSummary,
  SocketConnectionStatus,
} from '../types';
import { getDistanceKm } from '../utils/busStatus';
import { buildNearbyBuses } from '../utils/passengerHome';

const ETA_REFRESH_MS = 30000;
const ETA_MIN_REFRESH_MS = 15000;
const ETA_MOVEMENT_THRESHOLD_KM = 0.05;
const MAX_HOME_ETA_REQUESTS = 3;

interface EtaRequestMeta {
  requestedAt: number;
  latitude: number;
  longitude: number;
}

interface PassengerHomeData {
  buses: BusLocation[];
  routes: RouteSummary[];
  routeDetails: Record<string, RouteDetails>;
  nearbyBuses: NearbyBus[];
  liveBusCount: number;
  socketStatus: SocketConnectionStatus;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  now: number;
  refresh: () => Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function usePassengerHomeData(
  userLocation: LatLng | null,
): PassengerHomeData {
  const mountedRef = useRef(true);
  const etaRequestMetaRef = useRef<Record<string, EtaRequestMeta>>({});
  const etaRequestsInFlightRef = useRef(new Set<string>());
  const [busesById, setBusesById] = useState<Record<string, BusLocation>>({});
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [routeDetails, setRouteDetails] = useState<
    Record<string, RouteDetails>
  >({});
  const [etaByBusId, setEtaByBusId] = useState<
    Record<string, EtaPredictionResponse>
  >({});
  const [etaLoadingIds, setEtaLoadingIds] = useState<Set<string>>(new Set());
  const [socketStatus, setSocketStatus] =
    useState<SocketConnectionStatus>('disconnected');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadData = useCallback(async (manualRefresh: boolean) => {
    if (manualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    const [busResult, routeResult] = await Promise.allSettled([
      getBuses(),
      getRoutes(),
    ]);

    if (!mountedRef.current) {
      return;
    }

    const nextErrors: string[] = [];
    const nextBuses = busResult.status === 'fulfilled' ? busResult.value : null;
    if (busResult.status === 'fulfilled') {
      setBusesById(
        busResult.value.reduce<Record<string, BusLocation>>((result, bus) => {
          result[bus.bus_id] = bus;
          return result;
        }, {}),
      );
    } else {
      nextErrors.push(
        getErrorMessage(busResult.reason, 'Live buses are unavailable.'),
      );
    }

    if (routeResult.status === 'fulfilled') {
      setRoutes(routeResult.value.routes);
    } else {
      nextErrors.push(
        getErrorMessage(routeResult.reason, 'Routes are unavailable.'),
      );
    }

    const routeNumbers = new Set<string>();
    nextBuses?.forEach(bus => {
      if (bus.routeNumber) {
        routeNumbers.add(bus.routeNumber);
      }
    });

    const detailResults = await Promise.allSettled(
      Array.from(routeNumbers).map(routeNumber =>
        getRouteDetails(routeNumber, manualRefresh),
      ),
    );

    if (!mountedRef.current) {
      return;
    }

    const nextRouteDetails: Record<string, RouteDetails> = {};
    detailResults.forEach(result => {
      if (result.status === 'fulfilled') {
        nextRouteDetails[result.value.route.routeNumber] = result.value.route;
      }
    });

    setRouteDetails(previousDetails => ({
      ...previousDetails,
      ...nextRouteDetails,
    }));
    setError(nextErrors.length ? nextErrors.join(' ') : null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    const removeStatusListener =
      passengerSocket.onStatusChange(setSocketStatus);
    const removeBusListener = passengerSocket.onBusLocationUpdate(bus => {
      setBusesById(previousBuses => ({
        ...previousBuses,
        [bus.bus_id]: {
          ...previousBuses[bus.bus_id],
          ...bus,
        },
      }));
    });

    passengerSocket.connect();

    return () => {
      removeBusListener();
      removeStatusListener();
      passengerSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const buses = useMemo(() => Object.values(busesById), [busesById]);
  const nearbyBase = useMemo(
    () => buildNearbyBuses(buses, routes, routeDetails, userLocation, now),
    [buses, now, routeDetails, routes, userLocation],
  );

  useEffect(() => {
    nearbyBase.slice(0, MAX_HOME_ETA_REQUESTS).forEach(nearbyBus => {
      const { bus, nextStop, status } = nearbyBus;

      if (
        status === 'offline' ||
        !bus.routeNumber ||
        !nextStop ||
        etaRequestsInFlightRef.current.has(bus.bus_id)
      ) {
        return;
      }

      const previousRequest = etaRequestMetaRef.current[bus.bus_id];
      const movedDistance = previousRequest
        ? getDistanceKm(
            previousRequest.latitude,
            previousRequest.longitude,
            bus.lat,
            bus.lng,
          )
        : Number.POSITIVE_INFINITY;

      if (
        previousRequest &&
        (now - previousRequest.requestedAt < ETA_MIN_REFRESH_MS ||
          (now - previousRequest.requestedAt < ETA_REFRESH_MS &&
            movedDistance < ETA_MOVEMENT_THRESHOLD_KM))
      ) {
        return;
      }

      etaRequestsInFlightRef.current.add(bus.bus_id);
      etaRequestMetaRef.current[bus.bus_id] = {
        requestedAt: now,
        latitude: bus.lat,
        longitude: bus.lng,
      };
      setEtaLoadingIds(previousIds => {
        const nextIds = new Set(previousIds);
        nextIds.add(bus.bus_id);
        return nextIds;
      });

      predictEta({
        busId: bus.bus_id,
        routeNumber: bus.routeNumber,
        destinationStopId: nextStop.id,
      })
        .then(prediction => {
          if (mountedRef.current) {
            setEtaByBusId(previousEtas => ({
              ...previousEtas,
              [bus.bus_id]: prediction,
            }));
          }
        })
        .catch(() => {
          if (mountedRef.current) {
            setEtaByBusId(previousEtas => {
              const nextEtas = { ...previousEtas };
              delete nextEtas[bus.bus_id];
              return nextEtas;
            });
          }
        })
        .finally(() => {
          etaRequestsInFlightRef.current.delete(bus.bus_id);

          if (mountedRef.current) {
            setEtaLoadingIds(previousIds => {
              const nextIds = new Set(previousIds);
              nextIds.delete(bus.bus_id);
              return nextIds;
            });
          }
        });
    });
  }, [nearbyBase, now]);

  const nearbyBuses = useMemo(
    () =>
      nearbyBase.map(nearbyBus => ({
        ...nearbyBus,
        eta: etaByBusId[nearbyBus.bus.bus_id],
        etaLoading: etaLoadingIds.has(nearbyBus.bus.bus_id),
      })),
    [etaByBusId, etaLoadingIds, nearbyBase],
  );

  const liveBusCount = useMemo(
    () => nearbyBuses.filter(bus => bus.status === 'live').length,
    [nearbyBuses],
  );

  const refresh = useCallback(() => loadData(true), [loadData]);

  return {
    buses,
    routes,
    routeDetails,
    nearbyBuses,
    liveBusCount,
    socketStatus,
    loading,
    refreshing,
    error,
    now,
    refresh,
  };
}
