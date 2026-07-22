import { request } from "./client";
import { saveAdminSession } from "../storage/adminSessionStorage";
import type { AdminSession } from "../types";

interface LoginResponse {
  accessToken: string;
  admin: AdminSession["admin"];
}

export async function loginAdmin(
  email: string,
  password: string,
): Promise<AdminSession> {
  const response = await request<LoginResponse>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const session: AdminSession = {
    accessToken: response.accessToken,
    admin: response.admin,
  };

  saveAdminSession(session);
  return session;
}
