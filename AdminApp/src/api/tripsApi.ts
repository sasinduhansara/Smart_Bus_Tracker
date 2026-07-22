import { request } from "./client";
import type { Trip } from "../types";

export function getAdminTrips(status = ""): Promise<{ trips: Trip[] }> {
  const statusQuery = status ? `&status=${encodeURIComponent(status)}` : "";

  return request(`/admin/trips?limit=100${statusQuery}`);
}
