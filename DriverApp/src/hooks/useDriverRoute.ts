/**
 * useDriverRoute
 *
 * Fetches the driver's duty (bus + route) and the full route geometry
 * from the backend. Re-fetches when the driver's route assignment changes.
 *
 * Returns:
 *  - route: the full DriverRouteDetails including geometry + stops
 *  - duty:  the driver's current busId and routeNumber
 *  - loading, error: standard async state
 *  - refresh: manual re-fetch trigger
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getDriverDuty, getDriverRouteMap } from '../services/api';
import type { DriverRouteDetails } from '../types';

interface DriverDuty {
  busId: string | null;
  routeNumber: string | null;
}

interface UseDriverRouteReturn {
  route: DriverRouteDetails | null;
  duty: DriverDuty | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDriverRoute(): UseDriverRouteReturn {
  const [route, setRoute] = useState<DriverRouteDetails | null>(null);
  const [duty, setDuty] = useState<DriverDuty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      if (!mountedRef.current) return;
      setLoading(true);
      setError(null);

      try {
        // Fetch duty + route in parallel
        const [dutyResp, routeResp] = await Promise.all([
          getDriverDuty(),
          getDriverRouteMap(),
        ]);

        if (!cancelled && mountedRef.current) {
          setDuty({
            busId: dutyResp.duty?.busId ?? null,
            routeNumber: dutyResp.duty?.routeNumber ?? null,
          });
          setRoute(routeResp.route ?? null);
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load route information.',
          );
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    void fetchAll();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return { route, duty, loading, error, refresh };
}
