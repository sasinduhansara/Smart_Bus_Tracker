import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";

import { createAdminDepot, updateAdminDepot } from "../../api/busesApi";
import { Notice } from "../../components/common/Notice";
import type { Depot, DepotInput } from "../../types";
import { getErrorMessage } from "../../utils/errors";

interface DepotEditorModalProps {
  depot: Depot | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

interface DepotFormState {
  name: string;
  code: string;
  district: string;
  address: string;
  contactPhone: string;
  isActive: boolean;
}

function createInitialState(depot: Depot | null): DepotFormState {
  return {
    name: depot?.name || "",
    code: depot?.code || "",
    district: depot?.district || "",
    address: depot?.address || "",
    contactPhone: depot?.contactPhone || "",
    isActive: depot?.isActive ?? true,
  };
}

export function DepotEditorModal({
  depot,
  onClose,
  onSaved,
}: DepotEditorModalProps) {
  const [form, setForm] = useState<DepotFormState>(() =>
    createInitialState(depot),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(createInitialState(depot));
    setError("");
  }, [depot]);

  const updateField = <K extends keyof DepotFormState>(
    field: K,
    value: DepotFormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submit = async () => {
    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();

    if (!name) {
      setError("Depot name is required");
      return;
    }

    if (!code) {
      setError("Depot code is required");
      return;
    }

    const payload: DepotInput = {
      name,
      code,
      district: form.district.trim(),
      address: form.address.trim(),
      contactPhone: form.contactPhone.trim(),
      isActive: form.isActive,
    };

    setBusy(true);
    setError("");

    try {
      if (depot) {
        await updateAdminDepot(depot.id, payload);
      } else {
        await createAdminDepot(payload);
      }

      await onSaved();
      onClose();
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          depot ? "Could not update the depot" : "Could not create the depot",
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
        aria-labelledby="depot-editor-title"
      >
        <div className="modal-heading">
          <div className="editor-title-row">
            <span className="editor-icon">
              <MapPin size={18} />
            </span>
            <div>
              <p className="eyebrow">DEPOT MASTER DATA</p>
              <h2 id="depot-editor-title">
                {depot ? "Edit depot" : "Add depot"}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close depot editor"
          >
            <X size={18} />
          </button>
        </div>

        {error ? <Notice tone="error" message={error} /> : null}

        <div className="operations-form-grid">
          <label>
            Depot name
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              maxLength={120}
              placeholder="Kurunegala Depot"
              disabled={busy}
            />
          </label>

          <label>
            Depot code
            <input
              value={form.code}
              onChange={(event) =>
                updateField("code", event.target.value.toUpperCase())
              }
              maxLength={40}
              placeholder="KUR"
              disabled={busy}
            />
          </label>

          <label>
            District
            <input
              value={form.district}
              onChange={(event) => updateField("district", event.target.value)}
              maxLength={80}
              placeholder="Kurunegala"
              disabled={busy}
            />
          </label>

          <label>
            Contact phone
            <input
              value={form.contactPhone}
              onChange={(event) =>
                updateField("contactPhone", event.target.value)
              }
              maxLength={30}
              placeholder="Optional"
              disabled={busy}
            />
          </label>

          <label className="operations-form-wide">
            Address
            <textarea
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              maxLength={300}
              placeholder="Depot address"
              disabled={busy}
            />
          </label>

          <label className="status-toggle-row operations-form-wide">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                updateField("isActive", event.target.checked)
              }
              disabled={busy}
            />
            <span>
              <strong>Active depot</strong>
              <small>Inactive depots cannot receive active buses.</small>
            </span>
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
            {busy ? "Saving..." : depot ? "Save changes" : "Create depot"}
          </button>
        </div>
      </section>
    </div>
  );
}
