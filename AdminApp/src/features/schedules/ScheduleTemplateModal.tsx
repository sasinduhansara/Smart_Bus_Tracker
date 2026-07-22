import { useEffect, useState, type FormEvent } from "react";
import { CalendarClock, X } from "lucide-react";

import {
  createScheduleTemplate,
  updateScheduleTemplate,
} from "../../api/schedulesApi";
import type {
  OperatingDay,
  ScheduleRecordStatus,
  ScheduleTemplate,
  SchedulingRouteReference,
  ServiceType,
} from "../../types/schedule";
import { getErrorMessage } from "../../utils/errors";

interface ScheduleTemplateModalProps {
  template: ScheduleTemplate | null;
  routes: SchedulingRouteReference[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

const DAY_LABELS: Record<OperatingDay, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const ALL_DAYS = Object.keys(DAY_LABELS) as OperatingDay[];

const SERVICE_TYPES: ServiceType[] = ["sltb", "private", "intercity"];

function serviceTypeLabel(serviceType: ServiceType): string {
  switch (serviceType) {
    case "sltb":
      return "SLTB";

    case "private":
      return "Private";

    case "intercity":
      return "Intercity";

    default:
      return serviceType;
  }
}

export function ScheduleTemplateModal({
  template,
  routes,
  onClose,
  onSaved,
}: ScheduleTemplateModalProps) {
  const [routeId, setRouteId] = useState("");

  const [serviceType, setServiceType] = useState<ServiceType>("sltb");

  const [departureTime, setDepartureTime] = useState("06:30");

  const [operatingDays, setOperatingDays] = useState<OperatingDay[]>(ALL_DAYS);

  const [recordStatus, setRecordStatus] =
    useState<ScheduleRecordStatus>("active");

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (template) {
      setRouteId(template.routeId);
      setServiceType(template.serviceType);
      setDepartureTime(template.departureTime);
      setOperatingDays(template.operatingDays);
      setRecordStatus(template.recordStatus);
      setError("");

      return;
    }

    setRouteId(routes[0]?.id ?? "");
    setServiceType("sltb");
    setDepartureTime("06:30");
    setOperatingDays(ALL_DAYS);
    setRecordStatus("active");
    setError("");
  }, [routes, template]);

  const toggleDay = (day: OperatingDay) => {
    setOperatingDays((currentDays) => {
      if (currentDays.includes(day)) {
        return currentDays.filter((currentDay) => currentDay !== day);
      }

      return ALL_DAYS.filter(
        (currentDay) => currentDay === day || currentDays.includes(currentDay),
      );
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!routeId) {
      setError("Select a route.");
      return;
    }

    if (!serviceType) {
      setError("Select a service type.");
      return;
    }

    if (!departureTime) {
      setError("Select a departure time.");
      return;
    }

    if (operatingDays.length === 0) {
      setError("Select at least one operating day.");
      return;
    }

    setSaving(true);

    try {
      const input = {
        routeId,
        serviceType,
        departureTime,
        operatingDays,
        recordStatus,
      };

      if (template) {
        await updateScheduleTemplate(template.id, input);

        onSaved("Timetable slot updated successfully.");
      } else {
        await createScheduleTemplate(input);

        onSaved("Timetable slot created successfully.");
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not save timetable slot"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal schedule-editor-modal" onSubmit={submit}>
        <div className="modal-heading">
          <div className="editor-title-row">
            <span className="editor-icon">
              <CalendarClock size={19} />
            </span>

            <div>
              <h2>{template ? "Edit timetable slot" : "Add timetable slot"}</h2>

              <p className="muted">
                Create an SLTB, private or intercity departure time.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="operations-form-grid schedule-form-grid">
          <label className="operations-form-wide">
            Route
            <select
              value={routeId}
              onChange={(event) => {
                setRouteId(event.target.value);
                setError("");
              }}
              required
            >
              <option value="">Select route</option>

              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.routeNumber} · {route.origin} → {route.destination}
                  {route.depotName ? ` · ${route.depotName}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Service type
            <select
              value={serviceType}
              onChange={(event) => {
                setServiceType(event.target.value as ServiceType);

                setError("");
              }}
              required
            >
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {serviceTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Departure time
            <input
              type="time"
              value={departureTime}
              onChange={(event) => {
                setDepartureTime(event.target.value);

                setError("");
              }}
              required
            />
          </label>

          <label>
            Master status
            <select
              value={recordStatus}
              onChange={(event) =>
                setRecordStatus(event.target.value as ScheduleRecordStatus)
              }
            >
              <option value="active">Active</option>

              <option value="inactive">Inactive</option>
            </select>
          </label>

          <fieldset className="schedule-days-fieldset operations-form-wide">
            <legend>Operating days</legend>

            <div className="schedule-day-options">
              {ALL_DAYS.map((day) => (
                <label key={day} className="schedule-day-option">
                  <input
                    type="checkbox"
                    checked={operatingDays.includes(day)}
                    onChange={() => toggleDay(day)}
                  />

                  <span>{DAY_LABELS[day]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={saving || !routeId}
          >
            {saving ? "Saving..." : template ? "Save changes" : "Create slot"}
          </button>
        </div>
      </form>
    </div>
  );
}
