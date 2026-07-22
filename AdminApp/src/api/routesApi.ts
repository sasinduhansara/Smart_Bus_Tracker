import { request } from "./client";
import type {
  RouteDetails,
  RouteDirection,
  RouteInput,
  RouteRecordStatus,
  RouteServiceCategory,
  RouteSummary,
} from "../types/route";

export interface RouteFilters {
  q?: string;
  status?: RouteRecordStatus | "";
  direction?: RouteDirection | "";
}

interface RouteListResponse {
  status: string;
  routes: RouteSummary[];
  meta: {
    count: number;
    directions: RouteDirection[];
    statuses: RouteRecordStatus[];
    serviceCategories: RouteServiceCategory[];
  };
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

export function getAdminRoutes(
  filters: RouteFilters = {},
): Promise<RouteListResponse> {
  return request(
    `/admin/routes${buildQuery({
      q: filters.q,
      status: filters.status,
      direction: filters.direction,
    })}`,
  );
}

export function getAdminRoute(
  routeId: string,
): Promise<{ status: string; route: RouteDetails }> {
  return request(`/admin/routes/${routeId}`);
}

export function createAdminRoute(
  payload: RouteInput,
): Promise<{ status: string; route: RouteDetails }> {
  return request("/admin/routes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminRoute(
  routeId: string,
  payload: RouteInput,
): Promise<{ status: string; route: RouteDetails }> {
  return request(`/admin/routes/${routeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminRoute(
  routeId: string,
): Promise<{ status: string; routeId: string }> {
  return request(`/admin/routes/${routeId}`, {
    method: "DELETE",
  });
}
