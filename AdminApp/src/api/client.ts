import { getAccessToken } from "../storage/adminSessionStorage";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

interface ApiErrorBody {
  error?: string;
  code?: string;
  details?: unknown;
  fieldErrors?: Record<string, string>;
  conflicts?: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, body: ApiErrorBody = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.fieldErrors = body.fieldErrors ?? body.conflicts;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => "");
  return text ? { error: text } : {};
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken = getAccessToken();
  const isFormData = init.body instanceof FormData;

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers || {}),
    },
  });

  const body = (await parseResponse(response)) as ApiErrorBody;

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event("admin:unauthorized"));
    }

    throw new ApiError(
      body.error || `Request failed with status ${response.status}`,
      response.status,
      body,
    );
  }

  return body as T;
}
