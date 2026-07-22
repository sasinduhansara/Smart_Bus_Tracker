import { useEffect, useMemo, useState } from "react";
import { Pencil, X } from "lucide-react";

import {
  updateAdminBusRequest,
  type BusRequestServiceType,
  type DriverBusRequest,
  type UpdateBusRequestInput,
} from "../../api/busRequestsApi";
import { getAdminDepots } from "../../api/busesApi";
import { getAdminRoutes } from "../../api/routesApi";
import { LoadingState } from "../../components/common/LoadingState";
import { Notice } from "../../components/common/Notice";
import type { Depot, RouteSummary } from "../../types";
import { getErrorMessage } from "../../utils/errors";

interface BusRequestEditorModalProps {
  busRequest: DriverBusRequest;
  onClose: () => void;
  onSaved: (updatedRequest: DriverBusRequest) => Promise<void> | void;
}

interface FormState {
  vehicleRegistrationNumber: string;
  ntcPermitNumber: string;
  serviceType: BusRequestServiceType;
  depotId: string;
  routeId: string;
  make: string;
  model: string;
  manufactureYear: string;
  seatingCapacity: string;
  notes: string;
}

const SERVICE_TYPES: Array<{
  value: BusRequestServiceType;
  label: string;
}> = [
  { value: "sltb", label: "SLTB" },
  { value: "private", label: "Private" },
  { value: "intercity", label: "Intercity" },
];

function initialForm(busRequest: DriverBusRequest): FormState {
  return {
    vehicleRegistrationNumber: busRequest.vehicleRegistrationNumber,
    ntcPermitNumber: busRequest.ntcPermitNumber,
    serviceType: busRequest.serviceType || "sltb",
    depotId: busRequest.depotId,
    routeId: busRequest.routeId,
    make: busRequest.make,
    model: busRequest.model,
    manufactureYear:
      typeof busRequest.manufactureYear === "number"
        ? String(busRequest.manufactureYear)
        : "",
    seatingCapacity:
      typeof busRequest.seatingCapacity === "number"
        ? String(busRequest.seatingCapacity)
        : "",
    notes: busRequest.notes,
  };
}

function optionalNumber(value: string): number | null {
  const normalized = value.trim();
  return normalized ? Number(normalized) : null;
}

export function BusRequestEditorModal({
  busRequest,
  onClose,
  onSaved,
}: BusRequestEditorModalProps) {
  const [form, setForm] = useState<FormState>(() => initialForm(busRequest));
  const [depots, setDepots] = useState<Depot[]>([]);
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadReferences = async () => {
      setLoadingReferences(true);
      setError("");

      try {
        const [depotResponse, routeResponse] = await Promise.all([
          getAdminDepots(true),
          getAdminRoutes({ status: "active" }),
        ]);

        if (active) {
          setDepots(depotResponse.depots);
          setRoutes(routeResponse.routes);
        }
      } catch (loadError) {
        if (active) {
          setError(
            getErrorMessage(loadError, "Could not load depots and routes"),
          );
        }
      } finally {
        if (active) {
          setLoadingReferences(false);
        }
      }
    };

    void loadReferences();

    return () => {
      active = false;
    };
  }, []);

  const serviceRoutes = useMemo(
    () =>
      routes.filter((route) =>
        route.serviceCategories.includes(form.serviceType),
      ),
    [form.serviceType, routes],
  );

  const availableDepots = useMemo(() => {
    const names = new Set(
      serviceRoutes.map((route) => route.depotName.trim().toLowerCase()),
    );

    return depots.filter((depot) =>
      names.has(depot.name.trim().toLowerCase()),
    );
  }, [depots, serviceRoutes]);

  const selectedDepot = availableDepots.find(
    (depot) => depot.id === form.depotId,
  );

  const availableRoutes = useMemo(
    () =>
      selectedDepot
        ? serviceRoutes.filter(
            (route) =>
              route.depotName.trim().toLowerCase() ===
              selectedDepot.name.trim().toLowerCase(),
          )
        : [],
    [selectedDepot, serviceRoutes],
  );

  const updateField = <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submit = async () => {
    const registration = form.vehicleRegistrationNumber.trim().toUpperCase();
    if (!registration) {
      setError("Vehicle registration number is required");
      return;
    }
    if (!form.depotId) {
      setError("Select a depot");
      return;
    }
    if (!form.routeId) {
      setError("Select a route");
      return;
    }

    const manufactureYear = optionalNumber(form.manufactureYear);
    const seatingCapacity = optionalNumber(form.seatingCapacity);
    if (
      manufactureYear !== null &&
      (!Number.isInteger(manufactureYear) ||
        manufactureYear < 1950 ||
        manufactureYear > new Date().getFullYear() + 1)
    ) {
      setError("Enter a valid manufacture year");
      return;
    }
    if (
      seatingCapacity !== null &&
      (!Number.isInteger(seatingCapacity) ||
        seatingCapacity < 1 ||
        seatingCapacity > 120)
    ) {
      setError("Seating capacity must be between 1 and 120");
      return;
    }

    const payload: UpdateBusRequestInput = {
      vehicleRegistrationNumber: registration,
      ntcPermitNumber: form.ntcPermitNumber.trim().toUpperCase(),
      serviceType: form.serviceType,
      depotId: form.depotId,
      routeId: form.routeId,
      make: form.make.trim(),
      model: form.model.trim(),
      manufactureYear,
      seatingCapacity,
      notes: form.notes.trim(),
    };

    setBusy(true);
    setError("");

    try {
      const response = await updateAdminBusRequest(busRequest.id, payload);
      await onSaved(response.busRequest);
      onClose();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not update the bus request"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={busy ? undefined : onClose}>
      <section
        className="modal operations-editor-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bus-request-editor-title"
      >
        <div className="modal-heading">
          <div className="editor-title-row">
            <span className="editor-icon">
              <Pencil size={18} />
            </span>
            <div>
              <p className="eyebrow">DRIVER ONBOARDING</p>
              <h2 id="bus-request-editor-title">Edit bus request</h2>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close bus request editor"
          >
            <X size={18} />
          </button>
        </div>

        {error ? <Notice tone="error" message={error} /> : null}

        {loadingReferences ? (
          <LoadingState label="Loading depots and routes..." />
        ) : (
          <div className="operations-form-grid">
            <label>
              Vehicle registration number
              <input
                value={form.vehicleRegistrationNumber}
                onChange={(event) =>
                  updateField(
                    "vehicleRegistrationNumber",
                    event.target.value.toUpperCase(),
                  )
                }
                maxLength={30}
                disabled={busy}
              />
            </label>

            <label>
              NTC permit number
              <input
                value={form.ntcPermitNumber}
                onChange={(event) =>
                  updateField("ntcPermitNumber", event.target.value.toUpperCase())
                }
                maxLength={80}
                disabled={busy}
              />
            </label>

            <label>
              Service type
              <select
                value={form.serviceType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    serviceType: event.target.value as BusRequestServiceType,
                    depotId: "",
                    routeId: "",
                  }))
                }
                disabled={busy}
              >
                {SERVICE_TYPES.map((serviceType) => (
                  <option key={serviceType.value} value={serviceType.value}>
                    {serviceType.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Depot
              <select
                value={form.depotId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    depotId: event.target.value,
                    routeId: "",
                  }))
                }
                disabled={busy}
              >
                <option value="">Select depot</option>
                {availableDepots.map((depot) => (
                  <option key={depot.id} value={depot.id}>
                    {depot.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="operations-form-wide">
              Route
              <select
                value={form.routeId}
                onChange={(event) => updateField("routeId", event.target.value)}
                disabled={busy || !form.depotId}
              >
                <option value="">Select route</option>
                {availableRoutes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.routeNumber} · {route.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Make
              <input
                value={form.make}
                onChange={(event) => updateField("make", event.target.value)}
                maxLength={80}
                disabled={busy}
              />
            </label>

            <label>
              Model
              <input
                value={form.model}
                onChange={(event) => updateField("model", event.target.value)}
                maxLength={80}
                disabled={busy}
              />
            </label>

            <label>
              Manufacture year
              <input
                type="number"
                value={form.manufactureYear}
                onChange={(event) =>
                  updateField("manufactureYear", event.target.value)
                }
                min={1950}
                max={new Date().getFullYear() + 1}
                disabled={busy}
              />
            </label>

            <label>
              Seating capacity
              <input
                type="number"
                value={form.seatingCapacity}
                onChange={(event) =>
                  updateField("seatingCapacity", event.target.value)
                }
                min={1}
                max={120}
                disabled={busy}
              />
            </label>

            <label className="operations-form-wide">
              Notes
              <textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                maxLength={1000}
                rows={4}
                disabled={busy}
              />
            </label>
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void submit()}
            disabled={busy || loadingReferences}
          >
            <Pencil size={16} />
            {busy ? "Saving..." : "Update request"}
          </button>
        </div>
      </section>
    </div>
  );
}
