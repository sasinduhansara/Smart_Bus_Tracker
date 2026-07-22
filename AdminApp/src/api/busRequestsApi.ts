import { request } from "./client";

export type BusRequestStatus =
  | "pending"
  | "under_review"
  | "correction_required"
  | "approved"
  | "rejected";

export type BusRequestType = "existing_bus_claim" | "new_bus_registration";
export type BusRequestServiceType = "sltb" | "private" | "intercity";

export interface DriverBusRequest {
  id: string;

  driverId: string;
  driverName: string;
  driverMobile: string;
  driverNtcRegistrationNumber: string;

  requestType: BusRequestType;

  existingBusId: string;
  approvedBusId: string;

  vehicleRegistrationNumber: string;
  ntcPermitNumber: string;

  operatorId: string;
  operatorName: string;

  depotId: string;
  depotName: string;

  serviceType: BusRequestServiceType;
  routeId: string;
  routeNumber: string;
  routeName: string;

  make: string;
  model: string;

  manufactureYear: number | null;
  seatingCapacity: number | null;

  notes: string;

  status: BusRequestStatus;
  requestRevision: number;

  correctionFields: string[];
  correctionMessage: string;
  rejectionReason: string;

  createdAt: string;
  updatedAt: string;
  reviewedAt: string;
  approvedAt: string;
  correctionRequestedAt: string;
  rejectedAt: string;
}

interface BusRequestMutationResponse {
  status: string;
  busRequest: DriverBusRequest;
}

export interface UpdateBusRequestInput {
  vehicleRegistrationNumber: string;
  ntcPermitNumber?: string;
  depotId: string;
  serviceType: BusRequestServiceType;
  routeId: string;
  make?: string;
  model?: string;
  manufactureYear?: number | null;
  seatingCapacity?: number | null;
  notes?: string;
}

export interface BusRequestsResponse {
  status: string;

  requests: DriverBusRequest[];

  meta: {
    count: number;
    statuses: BusRequestStatus[];
  };
}

export interface BusRequestDetailsResponse {
  status: string;
  busRequest: DriverBusRequest;
}

function patch<T>(path: string, body: unknown = {}): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function getAdminBusRequests(filters?: {
  status?: BusRequestStatus | "";
  q?: string;
}): Promise<BusRequestsResponse> {
  const params = new URLSearchParams();

  const status = filters?.status?.trim();
  const query = filters?.q?.trim();

  if (status) {
    params.set("status", status);
  }

  if (query) {
    params.set("q", query);
  }

  const queryString = params.toString();

  return request<BusRequestsResponse>(
    `/admin/bus-requests${queryString ? `?${queryString}` : ""}`,
  );
}

export function getAdminBusRequest(
  requestId: string,
): Promise<BusRequestDetailsResponse> {
  return request<BusRequestDetailsResponse>(
    `/admin/bus-requests/${encodeURIComponent(requestId)}`,
  );
}

export function startAdminBusRequestReview(
  requestId: string,
): Promise<BusRequestMutationResponse> {
  return patch<BusRequestMutationResponse>(
    `/admin/bus-requests/${encodeURIComponent(requestId)}/review`,
  );
}

export function updateAdminBusRequest(
  requestId: string,
  data: UpdateBusRequestInput,
): Promise<BusRequestMutationResponse> {
  return patch<BusRequestMutationResponse>(
    `/admin/bus-requests/${encodeURIComponent(requestId)}`,
    data,
  );
}

export function deleteAdminBusRequest(
  requestId: string,
): Promise<{ status: string; requestId: string }> {
  return request(`/admin/bus-requests/${encodeURIComponent(requestId)}`, {
    method: "DELETE",
  });
}

export function approveAdminBusRequest(
  requestId: string,
): Promise<BusRequestMutationResponse> {
  return patch<BusRequestMutationResponse>(
    `/admin/bus-requests/${encodeURIComponent(requestId)}/approve`,
  );
}

export function requestAdminBusCorrection(
  requestId: string,
  data: {
    fields: string[];
    message: string;
  },
): Promise<BusRequestMutationResponse> {
  return patch<BusRequestMutationResponse>(
    `/admin/bus-requests/${encodeURIComponent(requestId)}/request-correction`,
    data,
  );
}

export function rejectAdminBusRequest(
  requestId: string,
  reason: string,
): Promise<BusRequestMutationResponse> {
  return patch<BusRequestMutationResponse>(
    `/admin/bus-requests/${encodeURIComponent(requestId)}/reject`,
    {
      reason,
    },
  );
}
