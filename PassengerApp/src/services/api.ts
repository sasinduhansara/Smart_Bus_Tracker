import { BASE_URL } from './config';
import type {
  BusLocation,
  EtaPredictionRequest,
  EtaPredictionResponse,
  RouteDetails,
  RouteSummary,
} from '../types';

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

function getErrorMessage(data: unknown, fallbackMessage: string): string {
  if (data && typeof data === 'object') {
    const response = data as ApiErrorResponse;

    return response.error || response.message || fallbackMessage;
  }

  return fallbackMessage;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.headers) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, `Request failed with status ${response.status}`),
    );
  }

  return data as T;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'boolean') {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function normalizeBusLocation(value: unknown): BusLocation | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const bus = value as Record<string, unknown>;
  const busId = String(bus.bus_id || '').trim();
  const latitude = toNumber(bus.lat);
  const longitude = toNumber(bus.lng);

  if (
    !busId ||
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const speed = toNumber(bus.speed);
  const heading = toNumber(bus.heading);
  const updatedAt =
    typeof bus.updatedAt === 'string' ? bus.updatedAt : undefined;
  const routeNumber = bus.routeNumber
    ? String(bus.routeNumber).trim()
    : undefined;
  const vehicleRegistrationNumber = bus.vehicleRegistrationNumber
    ? String(bus.vehicleRegistrationNumber).trim()
    : undefined;

  return {
    bus_id: busId,
    vehicleRegistrationNumber,
    routeNumber,
    lat: latitude,
    lng: longitude,
    speed: speed ?? undefined,
    heading: heading ?? undefined,
    updatedAt,
  };
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
): Promise<RouteDetailsResponse> {
  return request<RouteDetailsResponse>(
    `/api/routes/${encodeURIComponent(routeNumber)}`,
  );
}

export function predictEta(
  payload: EtaPredictionRequest,
): Promise<EtaPredictionResponse> {
  return request<EtaPredictionResponse>('/api/eta/predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
