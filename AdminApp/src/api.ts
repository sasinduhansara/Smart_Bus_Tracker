import type { AdminSession, Bus, Driver, Issue, Metrics, RouteSummary, Trip } from "./types";

// In development Vite proxies /api to Flask, so browser requests stay same-origin
// and do not depend on the backend CORS process being restarted. Deployments can
// provide an absolute VITE_API_URL when the API is hosted on another origin.
const defaultApiBase = import.meta.env.DEV ? "/api" : "http://localhost:5000/api";
const API_BASE = (import.meta.env.VITE_API_URL || defaultApiBase).replace(/\/$/, "");
const TOKEN_KEY = "bus-track-admin-token";
const ADMIN_KEY = "bus-track-admin-profile";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getSession(): AdminSession | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const profile = sessionStorage.getItem(ADMIN_KEY);
  if (!token || !profile) return null;
  try {
    return { accessToken: token, admin: JSON.parse(profile) };
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error || "Request failed", response.status);
  return body as T;
}

export async function login(email: string, password: string): Promise<AdminSession> {
  const body = await request<{ accessToken: string; admin: AdminSession["admin"] }>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  sessionStorage.setItem(TOKEN_KEY, body.accessToken);
  sessionStorage.setItem(ADMIN_KEY, JSON.stringify(body.admin));
  return { accessToken: body.accessToken, admin: body.admin };
}

export const api = {
  overview: () => request<{ metrics: Metrics }>("/admin/overview"),
  drivers: (status = "") => request<Driver[]>(`/admin/drivers${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  approveDriver: (id: string) => request(`/admin/drivers/${id}/approve`, { method: "PATCH" }),
  rejectDriver: (id: string, reason: string) => request(`/admin/drivers/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  blockDriver: (id: string, reason: string) => request(`/admin/drivers/${id}/block`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  buses: () => request<{ buses: Bus[] }>("/admin/buses"),
  trips: (status = "") => request<{ trips: Trip[] }>(`/admin/trips?limit=100${status ? `&status=${encodeURIComponent(status)}` : ""}`),
  issues: (status = "") => request<{ issues: Issue[] }>(`/admin/issues?limit=100${status ? `&status=${encodeURIComponent(status)}` : ""}`),
  updateIssue: (id: string, status: string, resolutionNote: string) => request(`/admin/issues/${id}`, { method: "PATCH", body: JSON.stringify({ status, resolutionNote }) }),
  routes: () => request<{ routes: RouteSummary[] }>("/admin/routes"),
};
