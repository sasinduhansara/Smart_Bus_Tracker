import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { getAdminIssues } from "../../api/issuesApi";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingState } from "../../components/common/LoadingState";
import { Notice } from "../../components/common/Notice";
import { PageHeader } from "../../components/common/pageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import type { Issue } from "../../types";
import { formatDateTime } from "../../utils/date";
import { getErrorMessage } from "../../utils/errors";
import { humanize } from "../../utils/text";
import { IssueReviewModal } from "./IssueReviewModal";

const FILTERS = [
  ["unresolved", "To resolve"],
  ["resolved", "Resolved"],
  ["", "All"],
] as const;

export function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filter, setFilter] = useState("unresolved");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const loadIssues = async () => {
    setLoading(true);
    setError("");

    try {
      setIssues((await getAdminIssues(filter)).issues);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load issues"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIssues();
  }, [filter]);

  const handleIssueChanged = async (
    status: string,
    notificationSent: boolean,
  ) => {
    await loadIssues();

    if (status === "resolved" && !notificationSent) {
      setNotice("");
      setError(
        "Issue resolved, but the driver notification could not be sent.",
      );
      return;
    }

    setNotice(
      status === "resolved"
        ? "Issue resolved and the driver was notified."
        : "Issue status updated.",
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="SERVICE DESK"
        title="Issue reports"
        subtitle="Review incidents reported from the driver application."
        onRefresh={loadIssues}
        loading={loading}
      />

      {notice ? <Notice tone="success" message={notice} /> : null}
      {error ? <Notice tone="error" message={error} /> : null}

      <div className="toolbar">
        <div className="tabs">
          {FILTERS.map(([value, label]) => (
            <button
              type="button"
              className={filter === value ? "active" : ""}
              key={value || "all"}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="issue-list">
        {loading ? (
          <LoadingState label="Loading issue reports..." />
        ) : issues.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No reports in this view"
            detail="No issue reports match the selected status."
          />
        ) : (
          issues.map((issue) => (
            <article className="panel issue-card" key={issue.id}>
              <div className="issue-icon">
                <AlertTriangle size={18} />
              </div>

              <div className="issue-content">
                <div className="issue-title">
                  <div>
                    <StatusBadge value={issue.severity} />
                    <h3>{humanize(issue.category)}</h3>
                  </div>
                  <StatusBadge value={issue.status} />
                </div>

                <p>{issue.message || "No description provided."}</p>

                <div className="issue-meta">
                  <span>{issue.driverName || "Unknown driver"}</span>
                  <span>Bus {issue.busId || "—"}</span>
                  <span>Route {issue.routeNumber || "—"}</span>
                  <span>{formatDateTime(issue.createdAt)}</span>
                </div>
              </div>

              {!["resolved", "dismissed"].includes(issue.status) ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSelectedIssue(issue)}
                >
                  {issue.status === "open" ? "Start review" : "Resolve"}
                </button>
              ) : null}
            </article>
          ))
        )}
      </section>

      {selectedIssue ? (
        <IssueReviewModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onChanged={handleIssueChanged}
        />
      ) : null}
    </>
  );
}
