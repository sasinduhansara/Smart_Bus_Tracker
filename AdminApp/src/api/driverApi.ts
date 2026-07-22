import { request } from "./client";

import type {
  Driver,
  DriverActionResponse,
  DriverCorrectionField,
  DriverDetailResponse,
} from "../types";

export function getDrivers(status = ""): Promise<Driver[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";

  return request(`/admin/drivers${query}`);
}

export function getDriver(driverId: string): Promise<DriverDetailResponse> {
  return request(`/admin/drivers/${driverId}`);
}

export function startDriverReview(
  driverId: string,
): Promise<DriverDetailResponse> {
  return request(`/admin/drivers/${driverId}/review`, {
    method: "PATCH",
  });
}

export function approveDriver(driverId: string): Promise<DriverActionResponse> {
  return request(`/admin/drivers/${driverId}/approve`, {
    method: "PATCH",
  });
}

export function requestDriverCorrection(
  driverId: string,
  fields: DriverCorrectionField[],
  message: string,
): Promise<DriverActionResponse> {
  return request(`/admin/drivers/${driverId}/request-correction`, {
    method: "PATCH",
    body: JSON.stringify({
      fields,
      message,
    }),
  });
}

export function rejectDriver(
  driverId: string,
  reason: string,
): Promise<DriverActionResponse> {
  return request(`/admin/drivers/${driverId}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function blockDriver(
  driverId: string,
  reason: string,
): Promise<DriverActionResponse> {
  return request(`/admin/drivers/${driverId}/block`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function unblockDriver(driverId: string): Promise<DriverActionResponse> {
  return request(`/admin/drivers/${driverId}/unblock`, {
    method: "PATCH",
  });
}

export function unrejectDriver(
  driverId: string,
): Promise<DriverActionResponse> {
  return request(`/admin/drivers/${driverId}/unreject`, {
    method: "PATCH",
  });
}
