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
} from "../../types/schedule";
import { getErrorMessage } from "../../utils/errors";
import { DailyServiceModal } from "./DailyServiceModal";
import { ScheduleTemplateModal } from "./ScheduleTemplateModal";

type Tab = "templates" | "roster";

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayServiceType(value: string): string {
  return value === "sltb" ? "SLTB" : value[0].toUpperCase() + value.slice(1);
}

export function SchedulesPage() {
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [services, setServices] = useState<DailyService[]>([]);
  const [references, setReferences] = useState<SchedulingReferences | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState(localDateValue);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingTemplate, setEditingTemplate] =
    useState<ScheduleTemplate | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<DailyService | null>(
    null,
  );
  const [serviceModalOpen, setServiceModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [templateResponse, serviceResponse, referenceResponse] =
        await Promise.all([
          getScheduleTemplates(),
          getDailyServices({ date: selectedDate }),
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

  const visibleTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return templates;
    }
    return templates.filter((template) =>
      [
        template.routeNumber,
        template.routeName,
        template.origin,
        template.destination,
        template.departureTime,
        template.serviceType,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, templates]);

  const visibleServices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return services;
    }
    return services.filter((service) =>
      [
        service.routeNumber,
        service.routeName,
        service.busRegistration,
        service.driverName,
        service.operatorName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, services]);

  const activeTemplateCount = templates.filter(
    (template) => template.recordStatus === "active",
  ).length;
  const scheduledCount = services.filter(
    (service) => service.status === "scheduled",
  ).length;

  const saved = (message: string) => {
    setTemplateModalOpen(false);
    setServiceModalOpen(false);
    setEditingTemplate(null);
    setEditingService(null);
    setSuccess(message);
    void loadData();
  };

  const removeTemplate = async (template: ScheduleTemplate) => {
    if (
      !window.confirm(
        `Delete the ${template.departureTime} timetable slot for Route ${template.routeNumber}?`,
      )
    ) {
      return;
    }
    setError("");
    try {
      await deleteScheduleTemplate(template.id);
      setSuccess("Timetable slot deleted successfully.");
      void loadData();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Could not delete timetable slot"));
    }
  };

  const removeService = async (service: DailyService) => {
    if (
      !window.confirm(
        `Delete the ${service.departureTime} service for bus ${service.busRegistration}?`,
      )
    ) {
      return;
    }
    setError("");
    try {
      await deleteDailyService(service.id);
      setSuccess("Daily service deleted successfully.");
      void loadData();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Could not delete daily service"));
    }
  };

  const openCreate = () => {
    setSuccess("");
    setError("");
    if (tab === "templates") {
      setEditingTemplate(null);
      setTemplateModalOpen(true);
    } else {
      setEditingService(null);
      setServiceModalOpen(true);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="SERVICE PLANNING"
        title="Timetable & daily roster"
        subtitle="Create route departure slots, then assign the actual bus and approved driver for each operating day."
        onRefresh={loadData}
        loading={loading}
      />

      {error ? <Notice tone="error" message={error} /> : null}
      {success ? <Notice tone="success" message={success} /> : null}

      <section className="schedule-summary-grid">
        <span>
          <small>Active timetable slots</small>
          <strong>{activeTemplateCount}</strong>
        </span>
        <span>
          <small>Services on selected date</small>
          <strong>{services.length}</strong>
        </span>
        <span>
          <small>Scheduled</small>
          <strong>{scheduledCount}</strong>
        </span>
      </section>

      <div className="operations-toolbar schedule-toolbar">
        <div className="tabs" aria-label="Scheduling view">
          <button
            type="button"
            className={tab === "templates" ? "active" : ""}
            onClick={() => {
              setTab("templates");
              setSearch("");
            }}
          >
            Timetable templates
          </button>
          <button
            type="button"
            className={tab === "roster" ? "active" : ""}
            onClick={() => {
              setTab("roster");
              setSearch("");
            }}
          >
            Daily roster
          </button>
        </div>

        <div className="operations-toolbar-right">
          {tab === "roster" ? (
            <input
              className="schedule-date-filter"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              aria-label="Daily roster date"
            />
          ) : null}

          <label className="search-box">
            <Search size={15} />
            <input
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setSearch(event.target.value)
              }
              placeholder={
                tab === "templates" ? "Route or time" : "Route, bus or driver"
              }
              maxLength={80}
            />
          </label>

          <button
            type="button"
            className="primary-button operations-add-button"
            onClick={openCreate}
            disabled={
              tab === "templates"
                ? !references?.routes.length
                : !references?.templates.length ||
                  !references?.buses.length ||
                  !references?.drivers.length
            }
          >
            <Plus size={16} />
            {tab === "templates" ? "Add timetable slot" : "Assign service"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel">
          <LoadingState label="Loading timetable data..." />
        </div>
      ) : tab === "templates" ? (
        visibleTemplates.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={CalendarClock}
              title="No timetable slots"
              detail="Add the first departure time for an active route."
            />
          </div>
        ) : (
          <section className="schedule-card-grid">
            {visibleTemplates.map((template) => (
              <article
                className="panel schedule-template-card"
                key={template.id}
              >
                <div className="schedule-card-top">
                  <div>
                    <span className="schedule-time">
                      {template.departureTime}
                    </span>
                    <span className={`status-pill ${template.recordStatus}`}>
                      {template.recordStatus}
                    </span>
                  </div>
                  <span className="schedule-service-pill">
                    {displayServiceType(template.serviceType)}
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
          </section>
        )
      ) : visibleServices.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={BusFront}
            title="No services for this date"
            detail="Choose a date and assign an active bus and approved driver to a timetable slot."
          />
        </div>
      ) : (
        <div className="panel table-panel">
          <div className="table-scroll">
            <table className="schedule-roster-table">
              <thead>
                <tr>
                  <th>Time / route</th>
                  <th>Service</th>
                  <th>Bus</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleServices.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <strong>
                        {service.departureTime} · Route {service.routeNumber}
                      </strong>
                      <small>
                        {service.origin} → {service.destination}
                      </small>
                    </td>
                    <td>
                      <strong>{displayServiceType(service.serviceType)}</strong>
                      <small>{service.depotName || "No route depot"}</small>
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
                      <span className={`status-pill ${service.status}`}>
                        {service.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingService(service);
                            setServiceModalOpen(true);
                          }}
                          aria-label="Edit daily service"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => void removeService(service)}
                          aria-label="Delete daily service"
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
        </div>
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
