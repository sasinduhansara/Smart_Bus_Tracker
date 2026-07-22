import { request } from "./client";
import type {
  DailyService,
  DailyServiceInput,
  DailyServiceStatus,
  ScheduleRecordStatus,
  ScheduleTemplate,
  ScheduleTemplateInput,
  SchedulingReferences,
  ServiceType,
} from "../types/schedule";

function queryString(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function getSchedulingReferences(): Promise<
  SchedulingReferences & { status: string }
> {
  return request("/admin/scheduling/references");
}

export function getScheduleTemplates(
  filters: {
    q?: string;
    status?: ScheduleRecordStatus | "";
    serviceType?: ServiceType | "";
  } = {},
): Promise<{ status: string; templates: ScheduleTemplate[] }> {
  return request(
    `/admin/schedule-templates${queryString({
      q: filters.q,
      status: filters.status,
      serviceType: filters.serviceType,
    })}`,
  );
}

export function createScheduleTemplate(
  input: ScheduleTemplateInput,
): Promise<{ status: string; template: ScheduleTemplate }> {
  return request("/admin/schedule-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateScheduleTemplate(
  templateId: string,
  input: ScheduleTemplateInput,
): Promise<{ status: string; template: ScheduleTemplate }> {
  return request(`/admin/schedule-templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteScheduleTemplate(
  templateId: string,
): Promise<{ status: string; templateId: string }> {
  return request(`/admin/schedule-templates/${templateId}`, {
    method: "DELETE",
  });
}

export function getDailyServices(
  filters: {
    date?: string;
    status?: DailyServiceStatus | "";
    q?: string;
  } = {},
): Promise<{ status: string; services: DailyService[] }> {
  return request(
    `/admin/daily-services${queryString({
      date: filters.date,
      status: filters.status,
      q: filters.q,
    })}`,
  );
}

export function createDailyService(
  input: DailyServiceInput,
): Promise<{ status: string; service: DailyService }> {
  return request("/admin/daily-services", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDailyService(
  serviceId: string,
  input: DailyServiceInput,
): Promise<{ status: string; service: DailyService }> {
  return request(`/admin/daily-services/${serviceId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteDailyService(
  serviceId: string,
): Promise<{ status: string; serviceId: string }> {
  return request(`/admin/daily-services/${serviceId}`, {
    method: "DELETE",
  });
}
