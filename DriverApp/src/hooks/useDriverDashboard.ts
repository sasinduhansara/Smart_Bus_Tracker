import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  getAssignedRoute,
  getDriverHome,
  predictDriverEta,
} from '../services/api';
import type {
  DriverEtaResponse,
  DriverHomeResponse,
  DriverRouteDetails,
} from '../types';
import type { DriverLocationSnapshot } from './useDriverLocationTracking';

const ETA_REFRESH_INTERVAL_MS = 30000;
const ETA_REFRESH_DISTANCE_METERS = 250;

export type BackendConnectionStatus =
  | 'connecting'
  | 'online'
  | 'offline'
  | 'error';

interface EtaAnchor {
  requestedAt: number;
  latitude: number;
  longitude: number;
  busId: string;
  routeNumber: string;
  destinationStopId: string;
}

function haversineMeters(
  first: Pick<EtaAnchor, 'latitude' | 'longitude'>,
  second: Pick<DriverLocationSnapshot, 'latitude' | 'longitude'>,
): number {
  const radius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useDriverDashboard(driverId?: string) {
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const routeRequestSequenceRef = useRef(0);
  const etaRequestSequenceRef = useRef(0);
  const etaContextRef = useRef<string | undefined>(undefined);
  const etaAnchorRef = useRef<EtaAnchor | null>(null);
  const etaRequestInProgressRef = useRef(false);

  const [home, setHome] = useState<DriverHomeResponse | null>(null);
  const [route, setRoute] = useState<DriverRouteDetails | null>(null);
  const [eta, setEta] = useState<DriverEtaResponse | null>(null);
  const [etaUpdatedAt, setEtaUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [etaError, setEtaError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<BackendConnectionStatus>('connecting');

  const loadRoute = useCallback(
    async (routeNumber: string, forceRefresh = false) => {
      const sequence = ++routeRequestSequenceRef.current;

      if (!routeNumber.trim()) {
        if (
          mountedRef.current &&
          sequence === routeRequestSequenceRef.current
        ) {
          setRoute(null);
          setRouteError('No route is assigned to this driver.');
        }
        return null;
      }

      try {
        const response = await getAssignedRoute(routeNumber, forceRefresh);

        if (
          mountedRef.current &&
          sequence === routeRequestSequenceRef.current
        ) {
          setRoute(response.route);
          setRouteError(null);
        }

        return response.route;
      } catch (loadError) {
        if (
          mountedRef.current &&
          sequence === routeRequestSequenceRef.current
        ) {
          setRoute(null);
          setRouteError(
            messageFrom(loadError, 'Assigned route details are unavailable.'),
          );
        }
        return null;
      }
    },
    [],
  );

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!driverId) {
        if (mountedRef.current) {
          setLoading(false);
          setError('The authenticated driver ID is unavailable.');
          setConnectionStatus('error');
        }
        return null;
      }

      const sequence = ++requestSequenceRef.current;
      if (mountedRef.current) {
        setError(null);
        setConnectionStatus('connecting');
      }

      try {
        const response = await getDriverHome(driverId);

        if (!mountedRef.current || sequence !== requestSequenceRef.current) {
          return response;
        }

        setHome(response);
        setAccessDenied(false);
        setConnectionStatus('online');
        await loadRoute(response.vehicle.route, forceRefresh);
        return response;
      } catch (loadError) {
        if (mountedRef.current && sequence === requestSequenceRef.current) {
          const message = messageFrom(
            loadError,
            'The Driver Dashboard could not be loaded.',
          );
          setError(message);
          setAccessDenied(
            loadError instanceof ApiError && loadError.status === 403,
          );
          setConnectionStatus(
            message.toLowerCase().includes('backend unavailable')
              ? 'offline'
              : 'error',
          );
        }
        return null;
      } finally {
        if (mountedRef.current && sequence === requestSequenceRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [driverId, loadRoute],
  );

  const refresh = useCallback(async () => {
    if (mountedRef.current) {
      setRefreshing(true);
    }
    return load(true);
  }, [load]);

  const clearEta = useCallback((message?: string) => {
    etaRequestSequenceRef.current += 1;
    etaAnchorRef.current = null;

    if (mountedRef.current) {
      setEta(null);
      setEtaUpdatedAt(null);
      setEtaError(message || null);
    }
  }, []);

  const refreshEta = useCallback(
    async (
      busId: string,
      snapshot: DriverLocationSnapshot,
      forceRefresh = false,
    ) => {
      const currentRoute = route;
      const destination = currentRoute?.stops[currentRoute.stops.length - 1];

      if (!currentRoute || !destination || !busId) {
        clearEta('ETA is waiting for a valid route and destination.');
        return null;
      }

      const anchor = etaAnchorRef.current;
      const now = Date.now();
      const knownNextStopId =
        eta?.nextStop?.id &&
        currentRoute.stops.some(stop => stop.id === eta.nextStop?.id)
          ? eta.nextStop.id
          : destination.id;
      const requestMatches =
        anchor?.busId === busId &&
        anchor.routeNumber === currentRoute.routeNumber &&
        anchor.destinationStopId === knownNextStopId;

      if (
        !forceRefresh &&
        requestMatches &&
        anchor &&
        now - anchor.requestedAt < ETA_REFRESH_INTERVAL_MS &&
        haversineMeters(anchor, snapshot) < ETA_REFRESH_DISTANCE_METERS
      ) {
        return eta;
      }

      if (etaRequestInProgressRef.current) {
        return null;
      }

      const sequence = ++etaRequestSequenceRef.current;
      etaRequestInProgressRef.current = true;

      try {
        let response = await predictDriverEta({
          busId,
          routeNumber: currentRoute.routeNumber,
          destinationStopId: knownNextStopId,
        });

        // The canonical ETA endpoint always predicts to destinationStopId and
        // separately reports the actual next stop. On first load, or just
        // after passing a stop, resolve once more so the minutes and distance
        // shown beside "Next stop" really belong to that stop.
        if (
          response.nextStop &&
          response.nextStop.id !== response.destinationStop.id
        ) {
          response = await predictDriverEta({
            busId,
            routeNumber: currentRoute.routeNumber,
            destinationStopId: response.nextStop.id,
          });
        }

        if (
          mountedRef.current &&
          sequence === etaRequestSequenceRef.current
        ) {
          etaAnchorRef.current = {
            requestedAt: now,
            latitude: snapshot.latitude,
            longitude: snapshot.longitude,
            busId,
            routeNumber: currentRoute.routeNumber,
            destinationStopId: response.destinationStop.id,
          };
          setEta(response);
          setEtaUpdatedAt(new Date());
          setEtaError(null);
        }

        return response;
      } catch (predictionError) {
        if (
          mountedRef.current &&
          sequence === etaRequestSequenceRef.current
        ) {
          setEta(null);
          setEtaUpdatedAt(null);
          setEtaError(
            messageFrom(predictionError, 'The ETA model is unavailable.'),
          );
        }
        return null;
      } finally {
        etaRequestInProgressRef.current = false;
      }
    },
    [clearEta, eta, route],
  );

  useEffect(() => {
    const destination = route?.stops[route.stops.length - 1];
    const context = route
      ? `${home?.vehicle.number || ''}:${route.routeNumber}:${
          destination?.id || ''
        }`
      : '';

    if (
      etaContextRef.current !== undefined &&
      etaContextRef.current !== context
    ) {
      clearEta();
    }

    etaContextRef.current = context;
  }, [clearEta, home?.vehicle.number, route]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
      routeRequestSequenceRef.current += 1;
      etaRequestSequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return {
    home,
    route,
    eta,
    etaUpdatedAt,
    loading,
    refreshing,
    error,
    routeError,
    etaError,
    accessDenied,
    connectionStatus,
    load,
    refresh,
    refreshEta,
    clearEta,
  };
}
