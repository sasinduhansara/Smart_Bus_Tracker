import { useEffect, useMemo, useState } from "react";
import { BusFront, X } from "lucide-react";

import { createAdminBus, updateAdminBus } from "../../api/busesApi";
import { Notice } from "../../components/common/Notice";
import type { Bus, BusInput, BusRecordStatus, Depot } from "../../types";
import { getErrorMessage } from "../../utils/errors";

interface BusEditorModalProps {
  bus: Bus | null;
  depots: Depot[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

interface BusFormState {
  vehicleRegistrationNumber: string;
  ntcPermitNumber: string;
  depotId: string;
  make: string;
  model: string;
  manufactureYear: string;
  seatingCapacity: string;
  recordStatus: BusRecordStatus;
  notes: string;
}

function createInitialState(bus: Bus | null): BusFormState {
  return {
    vehicleRegistrationNumber:
      bus?.vehicleRegistrationNumber || bus?.busId || "",
    ntcPermitNumber: bus?.ntcPermitNumber || "",
    depotId: bus?.depotId || "",
    make: bus?.make || "",
    model: bus?.model || "",
    manufactureYear:
      typeof bus?.manufactureYear === "number"
        ? String(bus.manufactureYear)
        : "",
    seatingCapacity:
      typeof bus?.seatingCapacity === "number"
        ? String(bus.seatingCapacity)
        : "",
    recordStatus:
      bus?.recordStatus === "inactive" || bus?.recordStatus === "maintenance"
        ? bus.recordStatus
        : "active",
    notes: bus?.notes || "",
  };
}

function optionalNumber(value: string): number | null {
  const normalized = value.trim();
  return normalized ? Number(normalized) : null;
}

export function BusEditorModal({
  bus,
  depots,
  onClose,
  onSaved,
}: BusEditorModalProps) {
  const [form, setForm] = useState<BusFormState>(() => createInitialState(bus));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(createInitialState(bus));
    setError("");
  }, [bus]);

  const availableDepots = useMemo(
    () => depots.filter((depot) => depot.isActive || depot.id === form.depotId),
    [depots, form.depotId],
  );

  const updateField = <K extends keyof BusFormState>(
    field: K,
    value: BusFormState[K],
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

    const payload: BusInput = {
      vehicleRegistrationNumber: registration,
      ntcPermitNumber: form.ntcPermitNumber.trim().toUpperCase(),
      depotId: form.depotId,
      make: form.make.trim(),
      model: form.model.trim(),
      manufactureYear,
      seatingCapacity,
      recordStatus: form.recordStatus,
      notes: form.notes.trim(),
    };

    setBusy(true);
    setError("");

    try {
      if (bus) {
        await updateAdminBus(bus.id, payload);
      } else {
        await createAdminBus(payload);
      }

      await onSaved();
      onClose();
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          bus ? "Could not update the bus" : "Could not create the bus",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal operations-editor-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bus-editor-title"
      >
        <div className="modal-heading">
          <div className="editor-title-row">
            <span className="editor-icon">
              <BusFront size={18} />
            </span>
            <div>
              <p className="eyebrow">FLEET MASTER DATA</p>
              <h2 id="bus-editor-title">
                {bus ? "Edit bus record" : "Add bus"}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close bus editor"
          >
            <X size={18} />
          </button>
        </div>

        {error ? <Notice tone="error" message={error} /> : null}

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
              placeholder="NC-1234"
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
              placeholder="Optional"
              disabled={busy}
            />
          </label>

          <label>
            Depot
            <select
              value={form.depotId}
              onChange={(event) => updateField("depotId", event.target.value)}
              disabled={busy}
            >
              <option value="">Select depot</option>
              {availableDepots.map((depot) => (
                <option value={depot.id} key={depot.id}>
                  {depot.name} ({depot.code})
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
              placeholder="Ashok Leyland"
              disabled={busy}
            />
          </label>

          <label>
            Model
            <input
              value={form.model}
              onChange={(event) => updateField("model", event.target.value)}
              maxLength={80}
              placeholder="Viking"
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

          <label>
            Record status
            <select
              value={form.recordStatus}
              onChange={(event) =>
                updateField(
                  "recordStatus",
                  event.target.value as BusRecordStatus,
                )
              }
              disabled={busy}
            >
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <label className="operations-form-wide">
            Administrative notes
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              maxLength={1000}
              placeholder="Optional operational notes"
              disabled={busy}
            />
          </label>
        </div>

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
            disabled={busy}
          >
            {busy ? "Saving..." : bus ? "Save changes" : "Create bus"}
          </button>
        </div>
      </section>
    </div>
  );
}
