import { BASE_URL } from './config';
import type {
  BusLocation,
  BusLocationUpdate,
  BusOperationalStatus,
  EtaPredictionRequest,
  EtaPredictionResponse,
  PassengerSearchResponse,
  RouteDetails,
  RouteStopsResponse,
  RouteSummary,
} from '../types';
import { hasBusCoordinates } from '../utils/busUpdates';

interface ApiErrorResponse {
  error?: string;
  message?: string;
}

interface RoutesResponse {
  status: 'success';
  routes: RouteSummary[];
}

interface RouteDetailsResponse {
  status: 'success';
  route: RouteDetails;
}

const routeDetailsCache = new Map<string, Promise<RouteDetailsResponse>>();
const REQUEST_TIMEOUT_MS = 15000;

function getErrorMessage(data: unknown, fallbackMessage: string): string {
  if (data && typeof data === 'object') {
    const response = data as ApiErrorResponse;

    return response.error || response.message || fallbackMessage;
  }

  return fallbackMessage;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.headers) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  const controller = new AbortController();
  const externalSignal = options.signal;
  const forwardExternalAbort = () => controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  externalSignal?.addEventListener('abort', forwardExternalAbort);
  if (externalSignal?.aborted) {
    controller.abort();
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const responseText = await response.text();
    let data: unknown = null;

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('The backend returned an unreadable response.');
      }
    }

    if (!response.ok) {
      throw new Error(
        getErrorMessage(data, `Request failed with status ${response.status}`),
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (externalSignal?.aborted && !timedOut) {
        throw error;
      }

      throw new Error('The backend did not respond in time. Please retry.');
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('The backend is unavailable. Check your connection.');
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', forwardExternalAbort);
  }
}

function toNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    typeof value === 'boolean'
  ) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

const OPERATIONAL_STATUSES = new Set<BusOperationalStatus>([
  'active',
  'paused',
  'offline',
]);

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function normalizeBusLocationUpdate(
  value: unknown,
): BusLocationUpdate | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const bus = value as Record<string, unknown>;
  const busId = String(bus.bus_id || '').trim();
  const hasLatitude = hasOwn(bus, 'lat');
  const hasLongitude = hasOwn(bus, 'lng');
  const hasDisplayLatitude = hasOwn(bus, 'displayLatitude');
  const hasDisplayLongitude = hasOwn(bus, 'displayLongitude');
  const hasRawLatitude = hasOwn(bus, 'rawLatitude');
  const hasRawLongitude = hasOwn(bus, 'rawLongitude');

  if (
    !busId ||
    hasLatitude !== hasLongitude ||
    hasDisplayLatitude !== hasDisplayLongitude ||
    hasRawLatitude !== hasRawLongitude
  ) {
    return null;
  }

  const update: BusLocationUpdate = { bus_id: busId };

  if (hasLatitude && hasLongitude) {
    const latitude = toNumber(bus.lat);
    const longitude = toNumber(bus.lng);

    if (
      latitude === null ||
      longitude === null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }

    update.lat = latitude;
    update.lng = longitude;
  }

  if (hasOwn(bus, 'vehicleRegistrationNumber')) {
    update.vehicleRegistrationNumber = String(
      bus.vehicleRegistrationNumber || '',
    ).trim();
  }

  if (hasOwn(bus, 'routeNumber')) {
    update.routeNumber = String(bus.routeNumber || '').trim();
  }

  const numericBounds = {
    speed: { minimum: 0, maximum: 200 },
    heading: { minimum: 0, maximum: 359.999999 },
    accuracy: { minimum: 0, maximum: 500 },
    rawLatitude: { minimum: -90, maximum: 90 },
    rawLongitude: { minimum: -180, maximum: 180 },
    displayLatitude: { minimum: -90, maximum: 90 },
    displayLongitude: { minimum: -180, maximum: 180 },
    distanceFromRouteMeters: { minimum: 0, maximum: 100000 },
  } as const;

  for (const field of [
    'speed',
    'heading',
    'accuracy',
    'rawLatitude',
    'rawLongitude',
    'displayLatitude',
    'displayLongitude',
    'distanceFromRouteMeters',
  ] as const) {
    if (!hasOwn(bus, field)) {
      continue;
    }

    const parsedValue = toNumber(bus[field]);

    const bounds = numericBounds[field];

    if (
      parsedValue === null ||
      parsedValue < bounds.minimum ||
      parsedValue > bounds.maximum
    ) {
      return null;
    }

    update[field] = parsedValue;
  }

  for (const field of ['updatedAt', 'statusUpdatedAt'] as const) {
    if (!hasOwn(bus, field)) {
      continue;
    }

    const timestamp = bus[field];

    if (
      typeof timestamp !== 'string' ||
      !Number.isFinite(new Date(timestamp).getTime())
    ) {
      return null;
    }

    update[field] = timestamp;
  }

  for (const field of ['tripId', 'activeTripId'] as const) {
    if (hasOwn(bus, field)) {
      update[field] = String(bus[field] || '').trim();
    }
  }

  if (hasOwn(bus, 'isActive')) {
    if (typeof bus.isActive !== 'boolean') {
      return null;
    }

    update.isActive = bus.isActive;
  }

  if (hasOwn(bus, 'isRouteDeviation')) {
    if (typeof bus.isRouteDeviation !== 'boolean') {
      return null;
    }

    update.isRouteDeviation = bus.isRouteDeviation;
  }

  if (hasOwn(bus, 'direction')) {
    update.direction = String(bus.direction || '').trim();
  }

  if (hasOwn(bus, 'operationalStatus')) {
    const operationalStatus = String(bus.operationalStatus || '')
      .trim()
      .toLowerCase() as BusOperationalStatus;

    if (!OPERATIONAL_STATUSES.has(operationalStatus)) {
      return null;
    }

    update.operationalStatus = operationalStatus;
  }

  return update;
}

export function normalizeBusLocation(value: unknown): BusLocation | null {
  const update = normalizeBusLocationUpdate(value);
  return update && hasBusCoordinates(update) ? update : null;
}

export async function getBuses(): Promise<BusLocation[]> {
  const data = await request<unknown[]>('/api/buses');

  return data
    .map(normalizeBusLocation)
    .filter((bus): bus is BusLocation => bus !== null);
}

export function getRoutes(): Promise<RoutesResponse> {
  return request<RoutesResponse>('/api/routes');
}

export function getRouteDetails(
  routeNumber: string,
  forceRefresh = false,
): Promise<RouteDetailsResponse> {
  const normalizedRouteNumber = routeNumber.trim();

  if (forceRefresh) {
    routeDetailsCache.delete(normalizedRouteNumber);
  }

  const cachedRequest = routeDetailsCache.get(normalizedRouteNumber);

  if (cachedRequest) {
    return cachedRequest;
  }

  const routeRequest = request<RouteDetailsResponse>(
    '/api/routes/' + encodeURIComponent(normalizedRouteNumber),
  ).catch(error => {
    routeDetailsCache.delete(normalizedRouteNumber);
    throw error;
  });

  routeDetailsCache.set(normalizedRouteNumber, routeRequest);
  return routeRequest;
}

export function getRouteStops(
  routeNumber: string,
): Promise<RouteStopsResponse> {
  return request<RouteStopsResponse>(
    '/api/routes/' + encodeURIComponent(routeNumber) + '/stops',
  );
}

export function searchPassengerDirectory(
  query: string,
  limit = 12,
  signal?: AbortSignal,
): Promise<PassengerSearchResponse> {
  const searchParams =
    '?q=' +
    encodeURIComponent(query.trim()) +
    '&limit=' +
    encodeURIComponent(String(limit));

  return request<PassengerSearchResponse>('/api/search' + searchParams, {
    signal,
  });
}

export function predictEta(
  payload: EtaPredictionRequest,
): Promise<EtaPredictionResponse> {
  return request<EtaPredictionResponse>('/api/eta/predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
