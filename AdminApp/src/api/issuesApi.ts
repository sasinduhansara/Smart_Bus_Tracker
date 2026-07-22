import { request } from "./client";
import type { Issue } from "../types";

export function getAdminIssues(status = ""): Promise<{ issues: Issue[] }> {
  const statusQuery = status ? `&status=${encodeURIComponent(status)}` : "";

  return request(`/admin/issues?limit=100${statusQuery}`);
}

export function updateAdminIssue(
  issueId: string,
  status: string,
  resolutionNote: string,
): Promise<{
  status: string;
  issue: Issue;
  notificationSent: boolean;
}> {
  return request(`/admin/issues/${issueId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, resolutionNote }),
  });
}
