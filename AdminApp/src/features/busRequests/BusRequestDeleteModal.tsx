import { AlertTriangle, Trash2, X } from "lucide-react";

import { Notice } from "../../components/common/Notice";

interface BusRequestDeleteModalProps {
  registration: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function BusRequestDeleteModal({
  registration,
  busy,
  error,
  onClose,
  onConfirm,
}: BusRequestDeleteModalProps) {
  return (
    <div className="modal-backdrop" onMouseDown={busy ? undefined : onClose}>
      <section
        className="modal delete-record-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-bus-request-title"
      >
        <div className="modal-heading">
          <div className="delete-record-heading">
            <span className="delete-record-icon">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="eyebrow">PERMANENT ACTION</p>
              <h2 id="delete-bus-request-title">Delete bus request</h2>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close delete confirmation"
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        {error ? <Notice tone="error" message={error} /> : null}

        <div className="delete-record-body">
          <p>
            Permanently delete the registration request for{" "}
            <strong>{registration}</strong>?
          </p>
          <small>
            Deleting an open request resets the driver's bus onboarding status.
            Deleting an approved request removes only this request record; its
            approved bus and driver assignment remain active.
          </small>
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
            className="primary-button danger-button"
            onClick={onConfirm}
            disabled={busy}
          >
            <Trash2 size={16} />
            {busy ? "Deleting..." : "Delete permanently"}
          </button>
        </div>
      </section>
    </div>
  );
}
