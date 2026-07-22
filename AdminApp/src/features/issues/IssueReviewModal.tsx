import { useState } from "react";
import { X } from "lucide-react";

import { updateAdminIssue } from "../../api/issuesApi";
import { Notice } from "../../components/common/Notice";
import { StatusBadge } from "../../components/common/StatusBadge";
import type { Issue } from "../../types";
import { formatDateTime } from "../../utils/date";
import { getErrorMessage } from "../../utils/errors";
import { humanize } from "../../utils/text";

interface IssueReviewModalProps {
  issue: Issue;
  onClose: () => void;
  onChanged: (
    status: string,
    notificationSent: boolean,
  ) => Promise<void> | void;
}

export function IssueReviewModal({
  issue,
  onClose,
  onChanged,
}: IssueReviewModalProps) {
  const [resolutionNote, setResolutionNote] = useState(
    issue.resolutionNote || "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const nextStatus = issue.status === "open" ? "in_review" : "resolved";

  const submit = async () => {
    setBusy(true);
    setError("");

    try {
      const response = await updateAdminIssue(
        issue.id,
        nextStatus,
        resolutionNote.trim(),
      );
      await onChanged(nextStatus, response.notificationSent);
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Issue update failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-review-title"
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">ISSUE REVIEW</p>
            <h2 id="issue-review-title">{humanize(issue.category)}</h2>
            <p className="muted">Reported {formatDateTime(issue.createdAt)}</p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close issue review"
          >
            <X size={18} />
          </button>
        </div>

        {error ? <Notice tone="error" message={error} /> : null}

        <div className="detail-grid">
          <span>
            <small>Driver</small>
            <strong>{issue.driverName || issue.driverId || "Unknown"}</strong>
          </span>
          <span>
            <small>Bus</small>
            <strong>{issue.busId || "—"}</strong>
          </span>
          <span>
            <small>Route</small>
            <strong>{issue.routeNumber || "—"}</strong>
          </span>
          <span>
            <small>Status</small>
            <StatusBadge value={issue.status} />
          </span>
        </div>

        <div className="issue-description-box">
          <small>Driver report</small>
          <p>{issue.message || "No description provided."}</p>
        </div>

        <label>
          Resolution note
          <textarea
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            maxLength={1000}
            placeholder="Add review findings or the resolution taken"
            disabled={busy}
          />
        </label>

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
            disabled={
              busy || (nextStatus === "resolved" && !resolutionNote.trim())
            }
          >
            {issue.status === "open" ? "Start review" : "Resolve issue"}
          </button>
        </div>
      </section>
    </div>
  );
}
