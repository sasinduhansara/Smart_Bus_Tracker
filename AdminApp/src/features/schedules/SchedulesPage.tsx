import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import {
  BusFront,
  CalendarClock,
  Edit3,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  deleteDailyService,
  deleteScheduleTemplate,
  getDailyServices,
  getScheduleTemplates,
  getSchedulingReferences,
} from "../../api/schedulesApi";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingState } from "../../components/common/LoadingState";
import { Notice } from "../../components/common/Notice";
import { PageHeader } from "../../components/common/pageHeader";
import type {
  DailyService,
  ScheduleTemplate,
  SchedulingReferences,
  ServiceType,
} from "../../types/schedule";
import { getErrorMessage } from "../../utils/errors";
import { DailyServiceModal } from "./DailyServiceModal";
import { ScheduleTemplateModal } from "./ScheduleTemplateModal";

type Tab = "templates" | "roster";
type ServiceFilter = "all" | ServiceType;
type RecordItem = ScheduleTemplate | DailyService;

type RouteGroup<T extends RecordItem> = {
  key: string;
  depotName: string;
  routeNumber: string;
  routeName: string;
  origin: string;
  destination: string;
  items: T[];
};

const SERVICE_TYPES: ServiceType[] = ["sltb", "private", "intercity"];

function todayValue(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function serviceLabel(value: ServiceType): string {
  return value === "sltb" ? "SLTB" : value[0].toUpperCase() + value.slice(1);
}

function clean(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function depotOf(record: RecordItem): string {
  if (record.depotName?.trim()) {
    return record.depotName.trim();
  }

  if ("busDepotName" in record && record.busDepotName.trim()) {
    return record.busDepotName.trim();
  }

  return "No depot assigned";
}

function routeIdOf(record: RecordItem): string {
  return record.routeId || record.routeNumber;
}

function groupByDepotAndRoute<T extends RecordItem>(
  items: T[],
): RouteGroup<T>[] {
  const groups = new Map<string, RouteGroup<T>>();

  items.forEach((item) => {
    const depotName = depotOf(item);
    const key = `${depotName}::${routeIdOf(item)}`;
    const current = groups.get(key);

    if (current) {
      current.items.push(item);
      return;
    }

    groups.set(key, {
      key,
      depotName,
      routeNumber: item.routeNumber,
      routeName: item.routeName,
      origin: item.origin,
      destination: item.destination,
      items: [item],
    });
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) =>
        a.departureTime.localeCompare(b.departureTime),
      ),
    }))
    .sort((a, b) =>
      `${a.depotName}-${a.routeNumber}`.localeCompare(
        `${b.depotName}-${b.routeNumber}`,
        undefined,
        {
          numeric: true,
        },
      ),
    );
}

export function SchedulesPage() {
  const [tab, setTab] = useState<Tab>("templates");

  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);

  const [services, setServices] = useState<DailyService[]>([]);

  const [references, setReferences] = useState<SchedulingReferences | null>(
    null,
  );

  const [selectedDate, setSelectedDate] = useState(todayValue);

  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");

  const [depotFilter, setDepotFilter] = useState("all");

  const [routeFilter, setRouteFilter] = useState("all");

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingTemplate, setEditingTemplate] =
    useState<ScheduleTemplate | null>(null);

  const [editingService, setEditingService] = useState<DailyService | null>(
    null,
  );

  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const [serviceModalOpen, setServiceModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [templateResponse, serviceResponse, referenceResponse] =
        await Promise.all([
          getScheduleTemplates(),
          getDailyServices({
            date: selectedDate,
          }),
          getSchedulingReferences(),
        ]);

      setTemplates(templateResponse.templates);
      setServices(serviceResponse.services);
      setReferences(referenceResponse);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load timetable data"));
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentRecords: RecordItem[] =
    tab === "templates" ? templates : services;

  const serviceCounts = useMemo(() => {
    const counts: Record<ServiceType, number> = {
      sltb: 0,
      private: 0,
      intercity: 0,
    };

    currentRecords.forEach((record) => {
      counts[record.serviceType] += 1;
    });

    return counts;
  }, [currentRecords]);

  const depotOptions = useMemo(() => {
    const values = new Set<string>();

    currentRecords.forEach((record) => {
      if (serviceFilter === "all" || record.serviceType === serviceFilter) {
        values.add(depotOf(record));
      }
    });

    return [...values].sort((a, b) => a.localeCompare(b));
  }, [currentRecords, serviceFilter]);

  const routeOptions = useMemo(() => {
    const values = new Map<
      string,
      {
        id: string;
        label: string;
      }
    >();

    currentRecords.forEach((record) => {
      if (serviceFilter !== "all" && record.serviceType !== serviceFilter) {
        return;
      }

      if (depotFilter !== "all" && depotOf(record) !== depotFilter) {
        return;
      }

      const id = routeIdOf(record);

      if (!values.has(id)) {
        values.set(id, {
          id,
          label: `${record.routeNumber} · ${record.routeName}`,
        });
      }
    });

    return [...values.values()].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, {
        numeric: true,
      }),
    );
  }, [currentRecords, depotFilter, serviceFilter]);

  useEffect(() => {
    if (depotFilter !== "all" && !depotOptions.includes(depotFilter)) {
      setDepotFilter("all");
    }
  }, [depotFilter, depotOptions]);

  useEffect(() => {
    if (
      routeFilter !== "all" &&
      !routeOptions.some((route) => route.id === routeFilter)
    ) {
      setRouteFilter("all");
    }
  }, [routeFilter, routeOptions]);

  const matches = useCallback(
    (record: RecordItem) => {
      if (serviceFilter !== "all" && record.serviceType !== serviceFilter) {
        return false;
      }

      if (depotFilter !== "all" && depotOf(record) !== depotFilter) {
        return false;
      }

      if (routeFilter !== "all" && routeIdOf(record) !== routeFilter) {
        return false;
      }

      const query = clean(search);

      if (!query) {
        return true;
      }

      const searchable = [
        record.routeNumber,
        record.routeName,
        record.origin,
        record.destination,
        depotOf(record),
        record.departureTime,
        serviceLabel(record.serviceType),
        "busRegistration" in record ? record.busRegistration : "",
        "driverName" in record ? record.driverName : "",
        "operatorName" in record ? record.operatorName : "",
      ].join(" ");

      return clean(searchable).includes(query);
    },
    [depotFilter, routeFilter, search, serviceFilter],
  );

  const templateGroups = useMemo(
    () => groupByDepotAndRoute(templates.filter(matches)),
    [matches, templates],
  );

  const serviceGroups = useMemo(
    () => groupByDepotAndRoute(services.filter(matches)),
    [matches, services],
  );

  const saved = (message: string) => {
    setTemplateModalOpen(false);
    setServiceModalOpen(false);
    setEditingTemplate(null);
    setEditingService(null);
    setSuccess(message);

    void loadData();
  };

  const removeTemplate = async (template: ScheduleTemplate) => {
    const confirmed = window.confirm(
      `Delete the ${template.departureTime} timetable slot for Route ${template.routeNumber}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteScheduleTemplate(template.id);

      setSuccess("Timetable slot deleted successfully.");

      void loadData();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Could not delete timetable slot"));
    }
  };

  const removeService = async (service: DailyService) => {
    const confirmed = window.confirm(
      `Delete the ${service.departureTime} service for bus ${service.busRegistration}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDailyService(service.id);

      setSuccess("Daily service deleted successfully.");

      void loadData();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Could not delete daily service"));
    }
  };

  const switchTab = (nextTab: Tab) => {
    setTab(nextTab);
    setServiceFilter("all");
    setDepotFilter("all");
    setRouteFilter("all");
    setSearch("");
  };

  return (
    <>
      <PageHeader
        eyebrow="SERVICE PLANNING"
        title="Timetable & daily roster"
        subtitle="Manage SLTB, private and intercity schedules separately, grouped by depot and route."
        onRefresh={loadData}
        loading={loading}
      />

      {error ? <Notice tone="error" message={error} /> : null}

      {success ? <Notice tone="success" message={success} /> : null}

      <section className="schedule-summary-grid">
        {SERVICE_TYPES.map((type) => (
          <span key={type}>
            <small>{serviceLabel(type)}</small>

            <strong>{serviceCounts[type]}</strong>
          </span>
        ))}
      </section>

      <div className="operations-toolbar">
        <div className="tabs">
          <button
            type="button"
            className={tab === "templates" ? "active" : ""}
            onClick={() => switchTab("templates")}
          >
            Timetable templates
          </button>

          <button
            type="button"
            className={tab === "roster" ? "active" : ""}
            onClick={() => switchTab("roster")}
          >
            Daily roster
          </button>
        </div>

        <button
          type="button"
          className="primary-button operations-add-button"
          disabled={
            tab === "templates"
              ? !references?.routes.length
              : !references?.templates.length ||
                !references?.buses.length ||
                !references?.drivers.length
          }
          onClick={() => {
            setError("");
            setSuccess("");

            if (tab === "templates") {
              setEditingTemplate(null);
              setTemplateModalOpen(true);
            } else {
              setEditingService(null);
              setServiceModalOpen(true);
            }
          }}
        >
          <Plus size={16} />

          {tab === "templates" ? "Add timetable slot" : "Assign service"}
        </button>
      </div>

      <div className="operations-toolbar">
        <div className="tabs">
          <button
            type="button"
            className={serviceFilter === "all" ? "active" : ""}
            onClick={() => {
              setServiceFilter("all");
              setDepotFilter("all");
              setRouteFilter("all");
            }}
          >
            All ({currentRecords.length})
          </button>

          {SERVICE_TYPES.map((type) => (
            <button
              type="button"
              key={type}
              className={serviceFilter === type ? "active" : ""}
              onClick={() => {
                setServiceFilter(type);
                setDepotFilter("all");
                setRouteFilter("all");
              }}
            >
              {serviceLabel(type)} ({serviceCounts[type]})
            </button>
          ))}
        </div>

        <div className="operations-toolbar-right">
          {tab === "roster" ? (
            <input
              className="schedule-date-filter"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          ) : null}

          <select
            className="compact-select"
            value={depotFilter}
            onChange={(event) => {
              setDepotFilter(event.target.value);

              setRouteFilter("all");
            }}
          >
            <option value="all">All depots</option>

            {depotOptions.map((depot) => (
              <option key={depot} value={depot}>
                {depot}
              </option>
            ))}
          </select>

          <select
            className="compact-select"
            value={routeFilter}
            onChange={(event) => setRouteFilter(event.target.value)}
          >
            <option value="all">All routes</option>

            {routeOptions.map((route) => (
              <option key={route.id} value={route.id}>
                {route.label}
              </option>
            ))}
          </select>

          <label className="search-box">
            <Search size={15} />

            <input
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setSearch(event.target.value)
              }
              placeholder="Search route, depot, bus or driver"
              maxLength={80}
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="panel">
          <LoadingState label="Loading timetable data..." />
        </div>
      ) : tab === "templates" ? (
        templateGroups.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={CalendarClock}
              title="No timetable slots match these filters"
              detail="Change the service, depot or route filter, or add a new timetable slot."
            />
          </div>
        ) : (
          templateGroups.map((group) => (
            <section
              className="panel"
              key={group.key}
              style={{
                padding: 18,
                marginBottom: 16,
              }}
            >
              <div
                className="panel-heading"
                style={{
                  marginBottom: 16,
                }}
              >
                <div>
                  <p className="eyebrow">{group.depotName.toUpperCase()}</p>

                  <h2>
                    Route {group.routeNumber} · {group.routeName}
                  </h2>

                  <p
                    className="muted"
                    style={{
                      margin: "6px 0 0",
                    }}
                  >
                    {group.origin} → {group.destination}
                  </p>
                </div>

                <span className="status-pill active">
                  {group.items.length} slot
                  {group.items.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="schedule-card-grid">
                {group.items.map((template) => (
                  <article
                    className="panel schedule-template-card"
                    key={template.id}
                  >
                    <div className="schedule-card-top">
                      <div>
                        <span className="schedule-time">
                          {template.departureTime}
                        </span>

                        <span
                          className={`status-pill ${template.recordStatus}`}
                        >
                          {template.recordStatus}
                        </span>
                      </div>

                      <span className="schedule-service-pill">
                        {serviceLabel(template.serviceType)}
                      </span>
                    </div>

                    <h3>Route {template.routeNumber}</h3>

                    <p className="muted">{template.routeName}</p>

                    <div className="schedule-journey">
                      <span>{template.origin}</span>

                      <span>to</span>

                      <span>{template.destination}</span>
                    </div>

                    <div className="schedule-days">
                      {template.operatingDays.map((day) => (
                        <span key={day}>{day.slice(0, 3)}</span>
                      ))}
                    </div>

                    <div className="operations-card-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setEditingTemplate(template);

                          setTemplateModalOpen(true);
                        }}
                      >
                        <Edit3 size={14} />
                        Edit
                      </button>

                      <button
                        type="button"
                        className="secondary-button delete-record-button"
                        onClick={() => void removeTemplate(template)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )
      ) : serviceGroups.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={BusFront}
            title="No daily services match these filters"
            detail="Change the date, service, depot or route filter, or assign a service."
          />
        </div>
      ) : (
        serviceGroups.map((group) => (
          <section
            className="panel table-panel"
            key={group.key}
            style={{
              marginBottom: 16,
            }}
          >
            <div
              className="panel-heading"
              style={{
                padding: 18,
              }}
            >
              <div>
                <p className="eyebrow">{group.depotName.toUpperCase()}</p>

                <h2>
                  Route {group.routeNumber} · {group.routeName}
                </h2>

                <p
                  className="muted"
                  style={{
                    margin: "6px 0 0",
                  }}
                >
                  {group.origin} → {group.destination}
                </p>
              </div>

              <span className="status-pill active">
                {group.items.length} service
                {group.items.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="table-scroll">
              <table className="schedule-roster-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Service</th>
                    <th>Bus</th>
                    <th>Driver</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {group.items.map((service) => (
                    <tr key={service.id}>
                      <td>
                        <strong>{service.departureTime}</strong>

                        <small>Route {service.routeNumber}</small>
                      </td>

                      <td>
                        <strong>{serviceLabel(service.serviceType)}</strong>

                        <small>{group.depotName}</small>
                      </td>

                      <td>
                        <strong>{service.busRegistration}</strong>

                        <small>
                          {service.operatorName || service.busDepotName || "—"}
                        </small>
                      </td>

                      <td>
                        <span className="schedule-person-cell">
                          <UserRound size={14} />

                          <span>
                            <strong>{service.driverName}</strong>

                            <small>
                              {service.driverNtcRegistrationNumber ||
                                "Approved driver"}
                            </small>
                          </span>
                        </span>
                      </td>

                      <td>
                        <span
                          className={`status-pill ${service.status.replace(
                            "_",
                            "-",
                          )}`}
                        >
                          {service.status.replace("_", " ")}
                        </span>
                      </td>

                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Edit daily service"
                            onClick={() => {
                              setEditingService(service);

                              setServiceModalOpen(true);
                            }}
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            type="button"
                            className="icon-button danger"
                            aria-label="Delete daily service"
                            onClick={() => void removeService(service)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {templateModalOpen && references ? (
        <ScheduleTemplateModal
          template={editingTemplate}
          routes={references.routes}
          onClose={() => {
            setTemplateModalOpen(false);
            setEditingTemplate(null);
          }}
          onSaved={saved}
        />
      ) : null}

      {serviceModalOpen && references ? (
        <DailyServiceModal
          service={editingService}
          defaultDate={selectedDate}
          templates={references.templates}
          buses={references.buses}
          drivers={references.drivers}
          onClose={() => {
            setServiceModalOpen(false);
            setEditingService(null);
          }}
          onSaved={saved}
        />
      ) : null}
    </>
  );
}
