import { request } from "./client";

import type { Bus, BusInput, Depot, DepotInput } from "../types";

export interface BusFilters {
  status?: string;
  recordStatus?: string;
  depotId?: string;
  q?: string;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const normalizedValue = value?.trim();
    if (normalizedValue) {
      searchParams.set(key, normalizedValue);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getAdminBuses(
  filters: BusFilters = {},
): Promise<{ status: string; buses: Bus[] }> {
  return request(
    `/admin/buses${buildQuery({
      status: filters.status,
      recordStatus: filters.recordStatus,
      depotId: filters.depotId,
      q: filters.q,
    })}`,
  );
}

export function createAdminBus(
  payload: BusInput,
): Promise<{ status: string; bus: Bus }> {
  return request("/admin/buses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminBus(
  busId: string,
  payload: BusInput,
): Promise<{ status: string; bus: Bus }> {
  return request(`/admin/buses/${busId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getAdminDepots(
  active?: boolean,
): Promise<{ status: string; depots: Depot[] }> {
  return request(
    `/admin/depots${buildQuery({
      active: typeof active === "boolean" ? String(active) : undefined,
    })}`,
  );
}

export function createAdminDepot(
  payload: DepotInput,
): Promise<{ status: string; depot: Depot }> {
  return request("/admin/depots", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminDepot(
  depotId: string,
  payload: DepotInput,
): Promise<{ status: string; depot: Depot }> {
  return request(`/admin/depots/${depotId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminBus(
  busId: string,
): Promise<{ status: string; busId: string }> {
  return request(`/admin/buses/${busId}`, {
    method: "DELETE",
  });
}

export function deleteAdminDepot(
  depotId: string,
): Promise<{ status: string; depotId: string }> {
  return request(`/admin/depots/${depotId}`, {
    method: "DELETE",
  });
}
