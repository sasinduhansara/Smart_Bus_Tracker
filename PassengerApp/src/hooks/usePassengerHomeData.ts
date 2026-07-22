import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CoordinatePoint } from '../types';

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
import {
  mergeBusUpdateIntoMap,
  reconcileBusSnapshot,
} from '../utils/busUpdates';
import { buildNearbyBuses } from '../utils/passengerHome';

const ETA_REFRESH_MS = 30000;
const ETA_MIN_REFRESH_MS = 15000;
const ETA_MOVEMENT_THRESHOLD_KM = 0.05;
const MAX_HOME_ETA_REQUESTS = 3;

interface EtaRequestMeta {
  requestedAt: number;
  latitude: number;
  longitude: number;
  routeNumber: string;
  destinationStopId: string;
}

interface EtaCacheEntry {
  prediction: EtaPredictionResponse;
  updatedAt: number;
  routeNumber: string;
  destinationStopId: string;
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

function getEtaRequestKey(
  busId: string,
  routeNumber: string,
  destinationStopId: string,
  updatedAt?: string,
  statusUpdatedAt?: string,
): string {
  return [
    busId,
    routeNumber,
    destinationStopId,
    updatedAt || '',
    statusUpdatedAt || '',
  ].join(':');
}

export function usePassengerHomeData(
  userLocation: CoordinatePoint | null,
): PassengerHomeData {
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const busUpdateSequenceRef = useRef(0);
  const busUpdateRevisionsRef = useRef<Record<string, number>>({});
  const etaRequestMetaRef = useRef<Record<string, EtaRequestMeta>>({});
  const etaRequestsInFlightRef = useRef(new Map<string, string>());
  const nearbyBaseRef = useRef<NearbyBus[]>([]);
  const routeDetailRequestsRef = useRef(new Set<string>());
  const [busesById, setBusesById] = useState<Record<string, BusLocation>>({});
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [routeDetails, setRouteDetails] = useState<
    Record<string, RouteDetails>
  >({});
  const [etaByBusId, setEtaByBusId] = useState<Record<string, EtaCacheEntry>>(
    {},
  );
  const [etaLoadingIds, setEtaLoadingIds] = useState<Set<string>>(new Set());
  const [socketStatus, setSocketStatus] =
    useState<SocketConnectionStatus>('disconnected');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadData = useCallback(async (manualRefresh: boolean) => {
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

    const [busResult, routeResult] = await Promise.allSettled([
      getBuses(),
      getRoutes(),
    ]);

    if (!mountedRef.current || sequence !== requestSequenceRef.current) {
      return;
    }

    const nextErrors: string[] = [];
    const nextBuses = busResult.status === 'fulfilled' ? busResult.value : null;
    if (busResult.status === 'fulfilled') {
      const protectedBusIds = new Set(
        Object.entries(busUpdateRevisionsRef.current)
          .filter(([, revision]) => revision > snapshotBusUpdateSequence)
          .map(([busId]) => busId),
      );
      setBusesById(previousBuses =>
        reconcileBusSnapshot(
          previousBuses,
          busResult.value,
          protectedBusIds,
        ),
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

    if (!mountedRef.current || sequence !== requestSequenceRef.current) {
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
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const removeStatusListener =
      passengerSocket.onStatusChange(setSocketStatus);
    const removeBusListener = passengerSocket.onBusLocationUpdate(bus => {
      const revision = ++busUpdateSequenceRef.current;
      busUpdateRevisionsRef.current[bus.bus_id] = revision;
      setBusesById(previousBuses =>
        mergeBusUpdateIntoMap(previousBuses, bus),
      );
    });

    passengerSocket.connect();

    return () => {
      removeBusListener();
      removeStatusListener();
      passengerSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const buses = useMemo(() => Object.values(busesById), [busesById]);

  useEffect(() => {
    buses.forEach(bus => {
      const routeNumber = bus.routeNumber;

      if (
        !routeNumber ||
        routeDetails[routeNumber] ||
        routeDetailRequestsRef.current.has(routeNumber)
      ) {
        return;
      }

      routeDetailRequestsRef.current.add(routeNumber);
      getRouteDetails(routeNumber)
        .then(response => {
          if (
            !mountedRef.current ||
            response.route.routeNumber !== routeNumber
          ) {
            return;
          }

          setRouteDetails(previousDetails => ({
            ...previousDetails,
            [response.route.routeNumber]: response.route,
          }));
        })
        .catch(() => undefined)
        .finally(() => {
          routeDetailRequestsRef.current.delete(routeNumber);
        });
    });
  }, [buses, routeDetails]);

  const nearbyBase = useMemo(
    () => buildNearbyBuses(buses, routes, routeDetails, userLocation, now),
    [buses, now, routeDetails, routes, userLocation],
  );
  nearbyBaseRef.current = nearbyBase;

  useEffect(() => {
    const currentContexts = new Map<string, NearbyBus>(
      nearbyBase.map(nearbyBus => [nearbyBus.bus.bus_id, nearbyBus] as const),
    );

    Object.entries(etaRequestMetaRef.current).forEach(([busId, request]) => {
      const current = currentContexts.get(busId);

      if (
        !current ||
        current.status !== 'live' ||
        current.bus.routeNumber !== request.routeNumber ||
        current.nextStop?.id !== request.destinationStopId
      ) {
        delete etaRequestMetaRef.current[busId];
      }
    });

    setEtaByBusId(previousEtas => {
      const nextEtas = { ...previousEtas };
      let changed = false;

      Object.entries(previousEtas).forEach(([busId, entry]) => {
        const current = currentContexts.get(busId);

        if (
          !current ||
          current.status !== 'live' ||
          current.bus.routeNumber !== entry.routeNumber ||
          current.nextStop?.id !== entry.destinationStopId
        ) {
          delete nextEtas[busId];
          changed = true;
        }
      });

      return changed ? nextEtas : previousEtas;
    });
  }, [nearbyBase]);

  useEffect(() => {
    nearbyBase
      .filter(nearbyBus => nearbyBus.status === 'live')
      .slice(0, MAX_HOME_ETA_REQUESTS)
      .forEach(nearbyBus => {
        const { bus, nextStop, status } = nearbyBus;

        if (status !== 'live' || !bus.routeNumber || !nextStop) {
          return;
        }

        const routeNumber = bus.routeNumber;
        const requestKey = getEtaRequestKey(
          bus.bus_id,
          routeNumber,
          nextStop.id,
          bus.updatedAt,
          bus.statusUpdatedAt,
        );

        if (etaRequestsInFlightRef.current.get(bus.bus_id) === requestKey) {
          return;
        }

        const previousRequest = etaRequestMetaRef.current[bus.bus_id];
        const sameContext = Boolean(
          previousRequest &&
            previousRequest.routeNumber === routeNumber &&
            previousRequest.destinationStopId === nextStop.id,
        );
        const movedDistance =
          previousRequest && sameContext
            ? getDistanceKm(
                previousRequest.latitude,
                previousRequest.longitude,
                bus.lat,
                bus.lng,
              )
            : Number.POSITIVE_INFINITY;

        if (
          previousRequest &&
          sameContext &&
          (now - previousRequest.requestedAt < ETA_MIN_REFRESH_MS ||
            (now - previousRequest.requestedAt < ETA_REFRESH_MS &&
              movedDistance < ETA_MOVEMENT_THRESHOLD_KM))
        ) {
          return;
        }

        etaRequestsInFlightRef.current.set(bus.bus_id, requestKey);
        etaRequestMetaRef.current[bus.bus_id] = {
          requestedAt: Date.now(),
          latitude: bus.lat,
          longitude: bus.lng,
          routeNumber,
          destinationStopId: nextStop.id,
        };
        setEtaLoadingIds(previousIds => {
          const nextIds = new Set(previousIds);
          nextIds.add(bus.bus_id);
          return nextIds;
        });

        predictEta({
          busId: bus.bus_id,
          routeNumber,
          destinationStopId: nextStop.id,
        })
          .then(async initialPrediction => {
            const canonicalNextStop = initialPrediction.nextStop;

            if (
              !canonicalNextStop ||
              canonicalNextStop.id === initialPrediction.destinationStop.id
            ) {
              return initialPrediction;
            }

            try {
              const canonicalPrediction = await predictEta({
                busId: bus.bus_id,
                routeNumber,
                destinationStopId: canonicalNextStop.id,
              });

              if (
                canonicalPrediction.busId === bus.bus_id &&
                canonicalPrediction.routeNumber === routeNumber &&
                canonicalPrediction.destinationStop.id === canonicalNextStop.id
              ) {
                return canonicalPrediction;
              }
            } catch {
              // The first prediction is still a truthful ETA to its displayed
              // destination; the next refresh can resolve canonical progress.
            }

            return initialPrediction;
          })
          .then(prediction => {
            const current = nearbyBaseRef.current.find(
              candidate => candidate.bus.bus_id === bus.bus_id,
            );
            const currentRequestKey =
              current?.bus.routeNumber && current.nextStop
                ? getEtaRequestKey(
                  current.bus.bus_id,
                  current.bus.routeNumber,
                  current.nextStop.id,
                  current.bus.updatedAt,
                  current.bus.statusUpdatedAt,
                  )
                : null;

            if (
              mountedRef.current &&
              current?.status === 'live' &&
              currentRequestKey === requestKey &&
              prediction.busId === bus.bus_id &&
              prediction.routeNumber === routeNumber
            ) {
              setEtaByBusId(previousEtas => ({
                ...previousEtas,
                [bus.bus_id]: {
                  prediction,
                  updatedAt: Date.now(),
                  routeNumber,
                  destinationStopId: nextStop.id,
                },
              }));
            }
          })
          .catch(() => undefined)
          .finally(() => {
            if (etaRequestsInFlightRef.current.get(bus.bus_id) !== requestKey) {
              return;
            }

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
      nearbyBase.map(nearbyBus => {
        const entry = etaByBusId[nearbyBus.bus.bus_id];
        const entryMatchesContext = Boolean(
          entry &&
            nearbyBus.status === 'live' &&
            nearbyBus.bus.routeNumber === entry.routeNumber &&
            nearbyBus.nextStop?.id === entry.destinationStopId,
        );
        const canonicalNextStop = entryMatchesContext
          ? routeDetails[entry.routeNumber]?.stops.find(
              stop =>
                stop.id ===
                (entry.prediction.nextStop?.id ||
                  entry.prediction.destinationStop.id),
            )
          : undefined;
        const nextStopIsCanonical = Boolean(
          entryMatchesContext &&
            entry.prediction.nextStop?.id ===
              entry.prediction.destinationStop.id,
        );

        return {
          ...nearbyBus,
          nextStop: canonicalNextStop || nearbyBus.nextStop,
          nextStopIsCanonical,
          eta: entryMatchesContext ? entry.prediction : undefined,
          etaUpdatedAt: entryMatchesContext ? entry.updatedAt : undefined,
          etaIsStale: entryMatchesContext
            ? now - entry.updatedAt > ETA_REFRESH_MS
            : undefined,
          etaLoading:
            nearbyBus.status === 'live' &&
            etaLoadingIds.has(nearbyBus.bus.bus_id),
        };
      }),
    [etaByBusId, etaLoadingIds, nearbyBase, now, routeDetails],
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
