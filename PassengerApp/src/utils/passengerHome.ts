import type { LatLng } from 'react-native-maps';

import type {
  BusLocation,
  BusStop,
  NearbyBus,
  PassengerSearchResult,
  RouteDetails,
  RouteSummary,
} from '../types';
import { getBusStatus, getDistanceKm } from './busStatus';

export function getSavedStopId(routeNumber: string, stopId: string): string {
  return routeNumber + ':' + stopId;
}

export function findClosestStop(
  bus: BusLocation,
  route?: RouteDetails,
): BusStop | undefined {
  if (!route?.stops.length) {
    return undefined;
  }

  return route.stops.reduce((closestStop, stop) => {
    const currentDistance = getDistanceKm(
      bus.lat,
      bus.lng,
      stop.latitude,
      stop.longitude,
    );
    const closestDistance = getDistanceKm(
      bus.lat,
      bus.lng,
      closestStop.latitude,
      closestStop.longitude,
    );

    return currentDistance < closestDistance ? stop : closestStop;
  });
}

export function selectEtaStop(
  bus: BusLocation,
  route?: RouteDetails,
): BusStop | undefined {
  const closestStop = findClosestStop(bus, route);

  if (!closestStop || !route) {
    return undefined;
  }

  const closestIndex = route.stops.findIndex(
    stop => stop.id === closestStop.id,
  );
  const distanceToClosest = getDistanceKm(
    bus.lat,
    bus.lng,
    closestStop.latitude,
    closestStop.longitude,
  );

  if (distanceToClosest <= 0.25 && route.stops[closestIndex + 1]) {
    return route.stops[closestIndex + 1];
  }

  return closestStop;
}

export function buildNearbyBuses(
  buses: BusLocation[],
  routes: RouteSummary[],
  routeDetails: Record<string, RouteDetails>,
  userLocation: LatLng | null,
  now: number,
): NearbyBus[] {
  const routeNames = new Map(
    routes.map(route => [route.routeNumber, route.name]),
  );
  const statusOrder = { live: 0, paused: 1, stale: 2, offline: 3 } as const;

  return buses
    .map(bus => {
      const details = bus.routeNumber
        ? routeDetails[bus.routeNumber]
        : undefined;
      const destination = details?.stops[details.stops.length - 1];

      return {
        bus,
        routeName:
          (bus.routeNumber && routeNames.get(bus.routeNumber)) || undefined,
        destinationName: destination?.name,
        nextStop: selectEtaStop(bus, details),
        distanceKm: userLocation
          ? getDistanceKm(
              userLocation.latitude,
              userLocation.longitude,
              bus.lat,
              bus.lng,
            )
          : undefined,
        status: getBusStatus(bus, now),
        etaLoading: false,
      };
    })
    .sort((first, second) => {
      const statusDifference =
        statusOrder[first.status] - statusOrder[second.status];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      if (
        typeof first.distanceKm === 'number' &&
        typeof second.distanceKm === 'number'
      ) {
        return first.distanceKm - second.distanceKm;
      }

      const firstUpdatedAt = new Date(first.bus.updatedAt || 0).getTime() || 0;
      const secondUpdatedAt =
        new Date(second.bus.updatedAt || 0).getTime() || 0;
      return secondUpdatedAt - firstUpdatedAt;
    });
}

export function searchRoutesAndStops(
  query: string,
  routes: RouteSummary[],
  routeDetails: Record<string, RouteDetails>,
  limit = 8,
): PassengerSearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const results: PassengerSearchResult[] = [];

  routes.forEach(route => {
    const searchableRoute = (
      route.routeNumber +
      ' ' +
      route.name +
      ' ' +
      route.direction
    ).toLocaleLowerCase();

    if (searchableRoute.includes(normalizedQuery)) {
      results.push({
        id: 'route:' + route.routeNumber,
        type: 'route',
        title: 'Route ' + route.routeNumber,
        subtitle: route.name,
        routeNumber: route.routeNumber,
      });
    }
  });

  Object.values(routeDetails).forEach(route => {
    route.stops.forEach(stop => {
      if (stop.name.toLocaleLowerCase().includes(normalizedQuery)) {
        results.push({
          id: 'stop:' + route.routeNumber + ':' + stop.id,
          type: 'stop',
          title: stop.name,
          subtitle: 'Route ' + route.routeNumber + ' · ' + route.name,
          routeNumber: route.routeNumber,
          stopId: stop.id,
        });
      }
    });
  });

  return results.slice(0, limit);
}

export function formatRelativeTime(value?: string, now = Date.now()): string {
  if (!value) {
    return 'Update time unavailable';
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return 'Update time unavailable';
  }

  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));

  if (seconds < 10) {
    return 'Updated just now';
  }

  if (seconds < 60) {
    return 'Updated ' + seconds + ' sec ago';
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return 'Updated ' + minutes + ' min ago';
  }

  const hours = Math.floor(minutes / 60);
  return 'Updated ' + hours + ' hr ago';
}
