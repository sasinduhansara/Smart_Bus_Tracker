import { Platform } from 'react-native';

import type {
  ActiveTripResponse,
  DocumentUploadResponse,
  Driver,
  DriverEtaResponse,
  DriverHomeResponse,
  DriverIssueResponse,
  DriverNotificationsResponse,
  IssueCategory,
  IssueSeverity,
  LiveBusLocation,
  OTPResponse,
  RegistrationAvailabilityResponse,
  RouteDetailsResponse,
  TripHistoryResponse,
  TripLocation,
  TripMutationResponse,
  TripReadinessResponse,
  VerifyOTPResponse,
} from '../types';

import type {
  DocumentFile,
  DriverRegistrationPayload,
  RegistrationDocumentKey,
} from '../types/registration';

import { getAccessTokenAsync } from './secureSession';

export interface DriverStatusResponse {
  driver_id?: string;
  _id?: string;
  fullName?: string;
  mobile?: string;
  verificationStatus?: string;
  status?: string;
  kycStatus?: string;
  rejectionReason?: string;
  blockReason?: string;
  [key: string]: unknown;
}

export interface DriverLocationPayload {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy: number;
  timestamp: string;
}

export interface DriverLocationResponse {
  status: string;
  bus: LiveBusLocation;
}

export interface NearestTerminalDetails {
  id?: string;
  name: string;
  distanceMeters: number;
  remainingDistanceMeters?: number;
  allowedRadiusMeters: number;
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
  code?: string;
  nearestTerminal?: NearestTerminalDetails;
  maximumAccuracyMeters?: number;
}

const REQUEST_TIMEOUT_MS = 15000;
const routeRequestCache = new Map<string, Promise<RouteDetailsResponse>>();

let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: ApiErrorResponse;

  constructor(
    message: string,
    status = 0,
    code?: string,
    details?: ApiErrorResponse,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function configureUnauthorizedHandler(
  handler: (() => void | Promise<void>) | null,
): void {
  unauthorizedHandler = handler;
}

const API_HOST = Platform.select({
  android: '10.0.2.2',
  ios: 'localhost',
  default: 'localhost',
});

export const BASE_URL = `http://${API_HOST}:5000`;

function getErrorMessage(data: unknown, fallbackMessage: string): string {
  if (data && typeof data === 'object') {
    const apiError = data as ApiErrorResponse;

    return apiError.error || apiError.message || fallbackMessage;
  }

  return fallbackMessage;
}

function parseResponseBody(
  responseText: string,
  status: number,
  url: string,
): unknown {
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new ApiError(
      `The server returned an unreadable response for ${url}.`,
      status,
      'INVALID_RESPONSE',
    );
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getAccessTokenAsync();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (options.headers) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    const responseText = await response.text();
    const data = parseResponseBody(responseText, response.status, url);

    if (!response.ok) {
      if (response.status === 401 && accessToken) {
        Promise.resolve(unauthorizedHandler?.()).catch(() => undefined);
      }

      const responseCode =
        data && typeof data === 'object'
          ? (data as ApiErrorResponse).code
          : undefined;

      throw new ApiError(
        getErrorMessage(
          data,
          response.status === 401
            ? 'Your login session has expired. Please sign in again.'
            : 'The request could not be completed.',
        ),
        response.status,
        responseCode,
        data && typeof data === 'object'
          ? (data as ApiErrorResponse)
          : undefined,
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(
        'The backend did not respond in time. Check your connection and retry.',
        0,
        'TIMEOUT',
      );
    }

    throw new ApiError(
      'Backend unavailable. Your session and current trip have been preserved.',
      0,
      'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function requestForm<T>(
  url: string,
  body: FormData,
  externalSignal?: AbortSignal,
): Promise<T> {
  const accessToken = await getAccessTokenAsync();

  const headers: Record<string, string> = {};

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromExternalSignal = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromExternalSignal);
  if (externalSignal?.aborted) {
    controller.abort();
  }

  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    const responseText = await response.text();
    const data = parseResponseBody(responseText, response.status, url);

    if (!response.ok) {
      if (response.status === 401 && accessToken) {
        Promise.resolve(unauthorizedHandler?.()).catch(() => undefined);
      }

      throw new ApiError(
        getErrorMessage(
          data,
          response.status === 401
            ? 'Your login session has expired. Please sign in again.'
            : 'Document upload failed.',
        ),
        response.status,
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw new ApiError('Document upload cancelled.', 0, 'CANCELLED');
      }

      throw new ApiError('Document upload timed out. Please retry.', 0, 'TIMEOUT');
    }

    throw new ApiError(
      'Document upload could not reach the backend. Please retry.',
      0,
      'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function get<T>(url: string): Promise<T> {
  return request<T>(url);
}

export function requestRegisterOTP(
  data: DriverRegistrationPayload,
): Promise<OTPResponse> {
  return post<OTPResponse>('/api/driver/register/request-otp', data);
}

export function checkDriverRegistrationAvailability(data: {
  mobile: string;
  email: string;
  nic: string;
  vehicleRegistrationNumber?: string;
}): Promise<RegistrationAvailabilityResponse> {
  return post<RegistrationAvailabilityResponse>(
    '/api/driver/register/check-availability',
    data,
  );
}

export function uploadRegistrationDocument(data: {
  mobile: string;
  docType: RegistrationDocumentKey;
  file: DocumentFile;
  signal?: AbortSignal;
}): Promise<DocumentUploadResponse> {
  const formData = new FormData();

  formData.append('mobile', data.mobile);
  formData.append('docType', data.docType);

  formData.append('file', {
    uri: data.file.uri,
    type: data.file.type || 'image/jpeg',
    name: data.file.fileName || `${data.docType}.jpg`,
  } as unknown as Blob);

  return requestForm<DocumentUploadResponse>(
    '/api/driver/register/documents/upload',
    formData,
    data.signal,
  );
}

export function verifyRegisterOTP(
  mobile: string,
  otp: string,
): Promise<VerifyOTPResponse> {
  return post<VerifyOTPResponse>('/api/driver/register/verify-otp', {
    mobile,
    otp,
  });
}

export function requestLoginOTP(mobile: string): Promise<OTPResponse> {
  return post<OTPResponse>('/api/driver/login/request-otp', {
    mobile,
  });
}

export function verifyLoginOTP(
  mobile: string,
  otp: string,
): Promise<VerifyOTPResponse> {
  return post<VerifyOTPResponse>('/api/driver/login/verify-otp', {
    mobile,
    otp,
  });
}

export function getDriverProfile(driverId: string): Promise<Driver> {
  return request<Driver>(`/api/driver/${encodeURIComponent(driverId)}`);
}

export function getDriverHome(driverId: string): Promise<DriverHomeResponse> {
  return request<DriverHomeResponse>(
    `/api/driver/${encodeURIComponent(driverId)}/home`,
  );
}

export function getDriverNotifications(
  limit = 50,
): Promise<DriverNotificationsResponse> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);

  return get<DriverNotificationsResponse>(
    `/api/driver/notifications?limit=${safeLimit}`,
  );
}

export function getDriverStatus(
  driverId: string,
): Promise<DriverStatusResponse> {
  if (!driverId.trim()) {
    return Promise.reject(
      new Error('Driver ID is required to check approval status.'),
    );
  }

  return request<DriverStatusResponse>(
    `/api/driver/${encodeURIComponent(driverId)}/status`,
  );
}

export function uploadDriverDocument(data: {
  driverId: string;
  docType: RegistrationDocumentKey;
  file: DocumentFile;
  signal?: AbortSignal;
}): Promise<DocumentUploadResponse> {
  const formData = new FormData();

  formData.append('docType', data.docType);

  formData.append('file', {
    uri: data.file.uri,
    type: data.file.type || 'image/jpeg',
    name: data.file.fileName || `${data.docType}.jpg`,
  } as unknown as Blob);

  return requestForm<DocumentUploadResponse>(
    `/api/driver/${encodeURIComponent(data.driverId)}/documents/upload`,
    formData,
    data.signal,
  );
}

export function sendDriverLocation(
  location: DriverLocationPayload,
): Promise<DriverLocationResponse> {
  return post<DriverLocationResponse>('/api/location', location);
}

export function getActiveTrip(): Promise<ActiveTripResponse> {
  return get<ActiveTripResponse>('/api/driver/trips/active');
}

export function getTripHistory(limit = 30): Promise<TripHistoryResponse> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);

  return get<TripHistoryResponse>(`/api/driver/trips?limit=${safeLimit}`);
}

export function startDriverTrip(
  location: TripLocation,
): Promise<TripMutationResponse> {
  return post<TripMutationResponse>('/api/driver/trips/start', { location });
}

export function checkTripReadiness(
  location: TripLocation,
): Promise<TripReadinessResponse> {
  return post<TripReadinessResponse>('/api/driver/trips/readiness', {
    location,
  });
}

export function pauseDriverTrip(tripId: string): Promise<TripMutationResponse> {
  return post<TripMutationResponse>(
    `/api/driver/trips/${encodeURIComponent(tripId)}/pause`,
    {},
  );
}

export function resumeDriverTrip(
  tripId: string,
): Promise<TripMutationResponse> {
  return post<TripMutationResponse>(
    `/api/driver/trips/${encodeURIComponent(tripId)}/resume`,
    {},
  );
}

export function completeDriverTrip(
  tripId: string,
): Promise<TripMutationResponse> {
  return post<TripMutationResponse>(
    `/api/driver/trips/${encodeURIComponent(tripId)}/complete`,
    {},
  );
}

export function getAssignedRoute(
  routeNumber: string,
  forceRefresh = false,
): Promise<RouteDetailsResponse> {
  const normalizedRouteNumber = routeNumber.trim();

  if (forceRefresh) {
    routeRequestCache.delete(normalizedRouteNumber);
  }

  const cachedRequest = routeRequestCache.get(normalizedRouteNumber);

  if (cachedRequest) {
    return cachedRequest;
  }

  const routeRequest = get<RouteDetailsResponse>(
    `/api/routes/${encodeURIComponent(normalizedRouteNumber)}`,
  ).catch(error => {
    routeRequestCache.delete(normalizedRouteNumber);
    throw error;
  });

  routeRequestCache.set(normalizedRouteNumber, routeRequest);
  return routeRequest;
}

export function predictDriverEta(data: {
  busId: string;
  routeNumber: string;
  destinationStopId: string;
}): Promise<DriverEtaResponse> {
  return post<DriverEtaResponse>('/api/eta/predict', data);
}

export function reportDriverIssue(data: {
  category: IssueCategory;
  severity: IssueSeverity;
  message?: string;
  location?: TripLocation;
}): Promise<DriverIssueResponse> {
  return post<DriverIssueResponse>('/api/driver/issues', data);
}
