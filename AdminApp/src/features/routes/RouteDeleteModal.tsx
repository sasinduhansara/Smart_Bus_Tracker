import { AlertTriangle, Trash2, X } from "lucide-react";

import type { RouteSummary } from "../../types/route";

interface RouteDeleteModalProps {
  route: RouteSummary;
  deleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RouteDeleteModal({
  route,
  deleting,
  error,
  onCancel,
  onConfirm,
}: RouteDeleteModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal delete-record-modal" aria-label="Delete route">
        <div className="modal-heading">
          <div className="delete-record-heading">
            <span className="delete-record-icon">
              <AlertTriangle size={19} />
            </span>
            <div>
              <h2>Delete route?</h2>
              <p className="muted">
                Route {route.routeNumber} · {route.direction}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            disabled={deleting}
            aria-label="Close delete confirmation"
          >
            <X size={17} />
          </button>
        </div>

        <div className="delete-record-body">
          <p>
            This permanently removes the route and all of its stop definitions.
          </p>
          <small>
            The backend will refuse deletion when the route is already linked to
            trip history or a daily service. In that case, set the route to
            inactive instead.
          </small>
        </div>

        {error ? (
          <p className="form-error route-delete-error">{error}</p>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button danger-button"
            onClick={onConfirm}
            disabled={deleting}
          >
            <Trash2 size={16} />
            {deleting ? "Deleting..." : "Delete route"}
          </button>
        </div>
      </section>
    </div>
  );
}
