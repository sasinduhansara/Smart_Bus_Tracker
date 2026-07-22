import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BusFront, X } from "lucide-react";

import { createDailyService, updateDailyService } from "../../api/schedulesApi";
import type {
  DailyService,
  ScheduleTemplate,
  SchedulingBusReference,
  SchedulingDriverReference,
} from "../../types/schedule";
import { getErrorMessage } from "../../utils/errors";

interface DailyServiceModalProps {
  service: DailyService | null;
  defaultDate: string;
  templates: ScheduleTemplate[];
  buses: SchedulingBusReference[];
  drivers: SchedulingDriverReference[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

function templateLabel(template: ScheduleTemplate): string {
  const type =
    template.serviceType === "sltb"
      ? "SLTB"
      : template.serviceType[0].toUpperCase() + template.serviceType.slice(1);
  return `${template.departureTime} · Route ${template.routeNumber} · ${type}`;
}

export function DailyServiceModal({
  service,
  defaultDate,
  templates,
  buses,
  drivers,
  onClose,
  onSaved,
}: DailyServiceModalProps) {
  const [serviceDate, setServiceDate] = useState(defaultDate);
  const [scheduleTemplateId, setScheduleTemplateId] = useState("");
  const [busId, setBusId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [status, setStatus] = useState<"scheduled" | "cancelled">("scheduled");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const availableTemplates = useMemo(
    () =>
      service
        ? templates
        : templates.filter((template) => template.recordStatus === "active"),
    [service, templates],
  );

  useEffect(() => {
    setServiceDate(service?.serviceDate ?? defaultDate);
    setScheduleTemplateId(
      service?.scheduleTemplateId ?? availableTemplates[0]?.id ?? "",
    );
    setBusId(service?.busId ?? buses[0]?.id ?? "");
    setDriverId(service?.driverId ?? drivers[0]?.id ?? "");
    setStatus(service?.status === "cancelled" ? "cancelled" : "scheduled");
  }, [availableTemplates, buses, defaultDate, drivers, service]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!scheduleTemplateId || !busId || !driverId) {
      setError("Select the timetable slot, bus and driver.");
      return;
    }

    setSaving(true);
    try {
      const input = {
        scheduleTemplateId,
        serviceDate,
        busId,
        driverId,
        status,
      };

      if (service) {
        await updateDailyService(service.id, input);
        onSaved("Daily service updated successfully.");
      } else {
        await createDailyService(input);
        onSaved("Daily service assigned successfully.");
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not save daily service"));
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
              <BusFront size={19} />
            </span>
            <div>
              <h2>{service ? "Edit daily service" : "Assign daily service"}</h2>
              <p className="muted">
                Connect an approved driver and active bus to a timetable slot.
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
          <label>
            Service date
            <input
              type="date"
              value={serviceDate}
              onChange={(event) => setServiceDate(event.target.value)}
              required
            />
          </label>

          <label>
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "scheduled" | "cancelled")
              }
            >
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <label className="operations-form-wide">
            Timetable slot
            <select
              value={scheduleTemplateId}
              onChange={(event) => setScheduleTemplateId(event.target.value)}
              required
            >
              <option value="">Select timetable slot</option>
              {availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {templateLabel(template)} · {template.origin} →{" "}
                  {template.destination}
                </option>
              ))}
            </select>
          </label>

          <label>
            Bus
            <select
              value={busId}
              onChange={(event) => setBusId(event.target.value)}
              required
            >
              <option value="">Select bus</option>
              {buses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.registration}
                  {bus.operatorName ? ` · ${bus.operatorName}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Approved driver
            <select
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              required
            >
              <option value="">Select driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.fullName}
                  {driver.driverNtcRegistrationNumber
                    ? ` · ${driver.driverNtcRegistrationNumber}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : service ? "Save changes" : "Assign service"}
          </button>
        </div>
      </form>
    </div>
  );
}
