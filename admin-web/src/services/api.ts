import axios from "axios";

// ⚠️ Use hardcoded URL to avoid "process is not defined" error in browser
// In production, change this to your deployed backend URL
const API_BASE_URL = "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Request interceptor: attach auth token ──────────────────────
api.interceptors.request.use(
  (config: any) => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => Promise.reject(error),
);

// ─── Response interceptor: handle 401 → redirect to login ───────
api.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export const adminAPI = {
  login: (email: string, password: string) =>
    api.post("/admin/login", { email, password }),

  // ─── Dashboard Stats ────────────────────────────────────────
  getDashboardStats: () => api.get("/admin/dashboard/stats"),

  getDrivers: (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get("/admin/drivers", { params }),

  getStats: () => api.get("/admin/drivers/stats"),

  // ─── Admin creates a driver (NO self-registration) ───────────
  createDriver: (data: {
    fullName: string;
    nic: string;
    phone: string;
    licenseNumber: string;
    busNumber: string;
    routeNumber: string;
    employer?: string;
    experience?: string;
    photo?: string;
  }) => api.post("/admin/drivers/create", data),

  // ─── Update driver's bus/route assignment ────────────────────
  updateDriverAssignment: (
    id: string,
    data: {
      busNumber?: string;
      routeNumber?: string;
    },
  ) => api.put(`/admin/drivers/${id}/assign`, data),

  updateDriverStatus: (
    id: string,
    data: { status: string; employeeId?: string; password?: string },
  ) => api.put(`/admin/drivers/${id}/status`, data),

  getDriver: (id: string) => api.get(`/admin/drivers/${id}`),

  deleteDriver: (id: string) => api.delete(`/admin/drivers/${id}`),

  // ─── Buses & Routes (for dropdowns) ──────────────────────────
  getBuses: (params?: { status?: string }) =>
    api.get("/admin/buses", { params }),

  getRoutes: () => api.get("/admin/routes"),

  // ─── Bus Fleet (from drivers) ───────────────────────────────
  getBusFleet: () => api.get("/admin/bus-fleet"),

  // ─── Update Bus Fleet Entry ─────────────────────────────────
  updateBusFleet: (
    id: string,
    data: {
      busNumber?: string;
      routeNumber?: string;
      phone?: string;
      licenseNumber?: string;
      fullName?: string;
    },
  ) => api.put(`/admin/bus-fleet/${id}`, data),

  // ─── Delete Bus Fleet Entry ─────────────────────────────────
  deleteBusFleet: (id: string) => api.delete(`/admin/bus-fleet/${id}`),

  // ═══════════════════════════════════════════════════════════════
  //  BUS PRE-REGISTRATION - Admin registers bus+driver data
  // ═══════════════════════════════════════════════════════════════

  getBusRegistrations: (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get("/admin/bus-registrations", { params }),

  createBusRegistration: (data: {
    busNumber: string;
    routeNumber: string;
    phone: string;
    nic?: string;
    licenseNumber?: string;
    fullName?: string;
  }) => api.post("/admin/bus-registrations/create", data),

  deleteBusRegistration: (id: string) =>
    api.delete(`/admin/bus-registrations/${id}`),

  getBusRegistrationStats: () => api.get("/admin/bus-registrations/stats"),

  // ─── Alerts & Notifications ─────────────────────────────────
  getAlerts: (params?: { status?: string; search?: string }) =>
    api.get("/admin/alerts", { params }),

  createAlert: (data: {
    title: string;
    message: string;
    severity: string;
    busNumber?: string;
    routeNumber?: string;
  }) => api.post("/admin/alerts/create", data),

  resolveAlert: (id: string) => api.put(`/admin/alerts/${id}/resolve`),

  deleteAlert: (id: string) => api.delete(`/admin/alerts/${id}`),
};

export default api;
