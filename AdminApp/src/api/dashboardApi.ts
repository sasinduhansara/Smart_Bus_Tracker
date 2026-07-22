import { request } from "./client";
import type { Metrics } from "../types";

export function getAdminOverview(): Promise<{ metrics: Metrics }> {
  return request("/admin/overview");
}
