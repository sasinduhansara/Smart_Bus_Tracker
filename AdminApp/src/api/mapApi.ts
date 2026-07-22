import { request } from "./client";
import type { RouteDetails } from "../types/route";
import type { StopWithCoordinates } from "../types/geometry";

export interface RouteGeometryPreview {
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  totalDistanceMeters: number;
}

export async function getRouteMapDetails(routeId: string) {
  const data = await request<{ status: string; route: RouteDetails }>(
    `/admin/routes/${routeId}/map`,
  );
  return data.route;
}

export async function updateRouteStops(routeId: string, stops: StopWithCoordinates[]) {
  const data = await request<{ status: string; route: RouteDetails }>(
    `/admin/routes/${routeId}/stops`,
    {
      method: "PATCH",
      body: JSON.stringify({ stops }),
    },
  );
  return data.route;
}

export async function generateRouteGeometry(routeId: string) {
  const data = await request<{
    status: string;
    geometry: RouteGeometryPreview["geometry"];
    totalDistanceMeters: number;
  }>(`/admin/routes/${routeId}/generate-geometry`, {
    method: "POST",
  });
  return data;
}

export async function saveRouteGeometry(
  routeId: string,
  geometry: RouteGeometryPreview["geometry"],
  totalDistanceMeters: number,
) {
  const data = await request<{ status: string; route: any }>(
    `/admin/routes/${routeId}/geometry`,
    {
      method: "PATCH",
      body: JSON.stringify({ geometry, totalDistanceMeters }),
    },
  );
  return data.route;
}

export async function validateRouteGeometry(routeId: string) {
  const data = await request<{
    status: string;
    validation: {
      valid: boolean;
      geometryVersion: number | null;
      errors: string[];
    };
  }>(`/admin/routes/${routeId}/validate-geometry`, {
    method: "POST",
  });
  return data.validation;
}

export async function getLiveMapStats() {
  const data = await request<{
    status: string;
    activeBuses: number;
    totalTrackedBuses: number;
  }>(`/admin/live-map`);
  return data;
}

export async function getLiveMapBuses() {
  const data = await request<{
    status: string;
    buses: any[];
  }>(`/admin/live-map/buses`);
  return data.buses;
}
