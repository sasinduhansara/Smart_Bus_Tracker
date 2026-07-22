import { AlertTriangle, Trash2, X } from "lucide-react";

import { Notice } from "../../components/common/Notice";

export type DeleteRecordKind = "bus" | "depot";

interface DeleteRecordModalProps {
  kind: DeleteRecordKind;
  name: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}

const COPY: Record<
  DeleteRecordKind,
  { title: string; dependencyMessage: string }
> = {
  bus: {
    title: "Delete bus record",
    dependencyMessage:
      "A bus can only be deleted when it has no active trip and no trip history. Otherwise set it to inactive instead.",
  },
  depot: {
    title: "Delete depot",
    dependencyMessage:
      "A depot can only be deleted after all linked buses have been deleted or reassigned.",
  },
};

export function DeleteRecordModal({
  kind,
  name,
  busy,
  error,
  onClose,
  onConfirm,
}: DeleteRecordModalProps) {
  const copy = COPY[kind];

  return (
    <div className="modal-backdrop" onMouseDown={busy ? undefined : onClose}>
      <section
        className="modal delete-record-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-record-title"
      >
        <div className="modal-heading">
          <div className="delete-record-heading">
            <span className="delete-record-icon">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="eyebrow">PERMANENT ACTION</p>
              <h2 id="delete-record-title">{copy.title}</h2>
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
            You are about to permanently delete <strong>{name}</strong>. This
            action cannot be undone.
          </p>
          <small>{copy.dependencyMessage}</small>
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
