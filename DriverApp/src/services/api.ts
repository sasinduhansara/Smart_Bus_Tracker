import { Platform } from 'react-native';

import type {
  DocumentUploadResponse,
  Driver,
  DriverHomeResponse,
  OTPResponse,
  RegistrationAvailabilityResponse,
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
  [key: string]: unknown;
}

export interface DriverLocationPayload {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
}

export interface LiveBusLocation {
  bus_id: string;
  vehicleRegistrationNumber?: string;
  routeNumber?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  updatedAt?: string;
}

export interface DriverLocationResponse {
  status: string;
  bus: LiveBusLocation;
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
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
    const preview = responseText.trim().slice(0, 80);

    throw new Error(
      `Backend returned a non-JSON response (${status}) for ${url}. ` +
        `Check whether Flask is running on ${BASE_URL}. ` +
        `Response: ${preview}`,
    );
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getAccessTokenAsync();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (options.headers) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  const responseText = await response.text();

  const data = parseResponseBody(responseText, response.status, url);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        response.status === 401
          ? 'Your login session has expired.'
          : 'Something went wrong',
      ),
    );
  }

  return data as T;
}

async function requestForm<T>(url: string, body: FormData): Promise<T> {
  const accessToken = await getAccessTokenAsync();

  const headers: Record<string, string> = {};

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers,
    body,
  });

  const responseText = await response.text();

  const data = parseResponseBody(responseText, response.status, url);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        response.status === 401
          ? 'Your login session has expired.'
          : 'Document upload failed',
      ),
    );
  }

  return data as T;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
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
  );
}

export function sendDriverLocation(
  location: DriverLocationPayload,
): Promise<DriverLocationResponse> {
  return post<DriverLocationResponse>('/api/location', location);
}
