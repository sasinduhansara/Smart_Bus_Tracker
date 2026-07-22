import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";

import {
  BadgeCheck,
  Building2,
  BusFront,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  MessageSquareWarning,
  Pencil,
  Search,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import {
  approveAdminBusRequest,
  deleteAdminBusRequest,
  getAdminBusRequests,
  rejectAdminBusRequest,
  requestAdminBusCorrection,
  startAdminBusRequestReview,
  type BusRequestStatus,
  type DriverBusRequest,
} from "../../api/busRequestsApi";

import { BusRequestDeleteModal } from "./BusRequestDeleteModal";
import { BusRequestEditorModal } from "./BusRequestEditorModal";

import { EmptyState } from "../../components/common/EmptyState";
import { LoadingState } from "../../components/common/LoadingState";
import { Notice } from "../../components/common/Notice";
import { PageHeader } from "../../components/common/pageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";

import { formatDateTime } from "../../utils/date";
import { getErrorMessage } from "../../utils/errors";

type StatusFilter = BusRequestStatus | "";

type ActionMode = "correction" | "rejection" | null;

interface CorrectionFieldOption {
  value: string;
  label: string;
}

const CORRECTION_FIELDS: CorrectionFieldOption[] = [
  {
    value: "vehicleRegistrationNumber",
    label: "Vehicle registration number",
  },
  {
    value: "ntcPermitNumber",
    label: "NTC permit number",
  },
  {
    value: "depotId",
    label: "Depot",
  },
  {
    value: "serviceType",
    label: "Service type",
  },
  {
    value: "routeId",
    label: "Route",
  },
  {
    value: "make",
    label: "Vehicle make",
  },
  {
    value: "model",
    label: "Vehicle model",
  },
  {
    value: "manufactureYear",
    label: "Manufacture year",
  },
  {
    value: "seatingCapacity",
    label: "Seating capacity",
  },
  {
    value: "notes",
    label: "Additional notes",
  },
];

const detailGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "12px",
  marginTop: "18px",
};

const detailBoxStyle: CSSProperties = {
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: "14px",
  padding: "13px",
  background: "var(--surface-muted, #f8fafc)",
};

const modalStyle: CSSProperties = {
  width: "min(920px, calc(100vw - 32px))",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
};

function requestTypeLabel(
  requestType: DriverBusRequest["requestType"],
): string {
  return requestType === "existing_bus_claim"
    ? "Existing bus claim"
    : "New bus registration";
}

function statusLabel(status: BusRequestStatus): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function DetailBox({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div style={detailBoxStyle}>
      <small
        style={{
          display: "block",
          color: "#64748b",
          marginBottom: "5px",
        }}
      >
        {label}
      </small>

      <strong
        style={{
          display: "block",
          color: "#0f172a",
          overflowWrap: "anywhere",
        }}
      >
        {value === null || value === undefined || value === "" ? "—" : value}
      </strong>
    </div>
  );
}

export function BusRequestsPage() {
  const [requests, setRequests] = useState<DriverBusRequest[]>([]);

  const [status, setStatus] = useState<StatusFilter>("");

  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [selectedRequest, setSelectedRequest] =
    useState<DriverBusRequest | null>(null);

  const [editorRequest, setEditorRequest] =
    useState<DriverBusRequest | null>(null);

  const [deleteRequest, setDeleteRequest] =
    useState<DriverBusRequest | null>(null);

  const [deleteBusy, setDeleteBusy] = useState(false);

  const [deleteError, setDeleteError] = useState("");

  const [actionBusy, setActionBusy] = useState(false);

  const [actionError, setActionError] = useState("");

  const [actionMode, setActionMode] = useState<ActionMode>(null);

  const [correctionFields, setCorrectionFields] = useState<string[]>([]);

  const [correctionMessage, setCorrectionMessage] = useState("");

  const [rejectionReason, setRejectionReason] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getAdminBusRequests({
        status,
        q: query,
      });

      setRequests(response.requests);
    } catch (loadError) {
      setError(
        getErrorMessage(loadError, "Could not load bus registration requests"),
      );
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRequests();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadRequests]);

  const counts = useMemo(() => {
    return {
      visible: requests.length,

      pending: requests.filter((request) => request.status === "pending")
        .length,

      reviewing: requests.filter((request) => request.status === "under_review")
        .length,

      approved: requests.filter((request) => request.status === "approved")
        .length,
    };
  }, [requests]);

  const openRequest = (busRequest: DriverBusRequest) => {
    setSelectedRequest(busRequest);
    setActionMode(null);
    setActionError("");
    setCorrectionFields([]);
    setCorrectionMessage("");
    setRejectionReason("");
    setSuccess("");
  };

  const closeRequest = () => {
    if (actionBusy) {
      return;
    }

    setSelectedRequest(null);
    setActionMode(null);
    setActionError("");
    setCorrectionFields([]);
    setCorrectionMessage("");
    setRejectionReason("");
  };

  const updateRequestState = (updatedRequest: DriverBusRequest) => {
    setSelectedRequest(updatedRequest);

    setRequests((currentRequests) =>
      currentRequests.map((busRequest) =>
        busRequest.id === updatedRequest.id ? updatedRequest : busRequest,
      ),
    );
  };

  const requestUpdated = async (updatedRequest: DriverBusRequest) => {
    updateRequestState(updatedRequest);
    setSuccess(
      `${updatedRequest.vehicleRegistrationNumber} request was updated successfully.`,
    );
    await loadRequests();
  };

  const deleteSelectedRequest = async () => {
    if (!deleteRequest || deleteBusy) {
      return;
    }

    setDeleteBusy(true);
    setDeleteError("");

    try {
      await deleteAdminBusRequest(deleteRequest.id);

      setRequests((currentRequests) =>
        currentRequests.filter((request) => request.id !== deleteRequest.id),
      );
      if (selectedRequest?.id === deleteRequest.id) {
        setSelectedRequest(null);
      }
      setDeleteRequest(null);
      setSuccess(
        `${deleteRequest.vehicleRegistrationNumber} request was deleted.`,
      );
      await loadRequests();
    } catch (deleteRequestError) {
      setDeleteError(
        getErrorMessage(deleteRequestError, "Could not delete the bus request"),
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const startReview = async () => {
    if (!selectedRequest || actionBusy) {
      return;
    }

    setActionBusy(true);
    setActionError("");

    try {
      const response = await startAdminBusRequestReview(selectedRequest.id);

      updateRequestState(response.busRequest);

      setSuccess(
        `${response.busRequest.vehicleRegistrationNumber} is now under review.`,
      );

      void loadRequests();
    } catch (reviewError) {
      setActionError(
        getErrorMessage(reviewError, "Could not start the bus request review"),
      );
    } finally {
      setActionBusy(false);
    }
  };

  const approveRequest = async () => {
    if (!selectedRequest || actionBusy) {
      return;
    }

    const confirmed = window.confirm(
      selectedRequest.requestType === "existing_bus_claim"
        ? `Approve this driver claim for ${selectedRequest.vehicleRegistrationNumber}?`
        : `Approve and register bus ${selectedRequest.vehicleRegistrationNumber}?`,
    );

    if (!confirmed) {
      return;
    }

    setActionBusy(true);
    setActionError("");

    try {
      const response = await approveAdminBusRequest(selectedRequest.id);

      updateRequestState(response.busRequest);
      setActionMode(null);

      setSuccess(
        selectedRequest.requestType === "existing_bus_claim"
          ? `${selectedRequest.vehicleRegistrationNumber} was linked to the driver successfully.`
          : `${selectedRequest.vehicleRegistrationNumber} was registered and approved successfully.`,
      );

      void loadRequests();
    } catch (approveError) {
      setActionError(
        getErrorMessage(approveError, "Could not approve the bus request"),
      );
    } finally {
      setActionBusy(false);
    }
  };

  const toggleCorrectionField = (field: string) => {
    setCorrectionFields((currentFields) =>
      currentFields.includes(field)
        ? currentFields.filter((currentField) => currentField !== field)
        : [...currentFields, field],
    );
  };

  const submitCorrection = async () => {
    if (!selectedRequest || actionBusy) {
      return;
    }

    const message = correctionMessage.trim();

    if (correctionFields.length === 0) {
      setActionError("Select at least one field that requires correction.");
      return;
    }

    if (!message) {
      setActionError("Enter a correction message for the driver.");
      return;
    }

    setActionBusy(true);
    setActionError("");

    try {
      const response = await requestAdminBusCorrection(selectedRequest.id, {
        fields: correctionFields,
        message,
      });

      updateRequestState(response.busRequest);
      setActionMode(null);
      setCorrectionFields([]);
      setCorrectionMessage("");

      setSuccess(
        `Correction request sent for ${selectedRequest.vehicleRegistrationNumber}.`,
      );

      void loadRequests();
    } catch (correctionError) {
      setActionError(
        getErrorMessage(correctionError, "Could not request corrections"),
      );
    } finally {
      setActionBusy(false);
    }
  };

  const submitRejection = async () => {
    if (!selectedRequest || actionBusy) {
      return;
    }

    const reason = rejectionReason.trim();

    if (!reason) {
      setActionError("Enter the reason for rejecting this request.");
      return;
    }

    setActionBusy(true);
    setActionError("");

    try {
      const response = await rejectAdminBusRequest(selectedRequest.id, reason);

      updateRequestState(response.busRequest);
      setActionMode(null);
      setRejectionReason("");

      setSuccess(
        `${selectedRequest.vehicleRegistrationNumber} request was rejected.`,
      );

      void loadRequests();
    } catch (rejectError) {
      setActionError(
        getErrorMessage(rejectError, "Could not reject the bus request"),
      );
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="DRIVER ONBOARDING"
        title="Bus registration requests"
        subtitle="Review existing bus claims and new fleet registration requests submitted by approved drivers."
        onRefresh={loadRequests}
        loading={loading}
      />

      {error ? <Notice tone="error" message={error} /> : null}

      {success ? <Notice tone="success" message={success} /> : null}

      <section className="route-registry-summary">
        <span>
          <small>Visible requests</small>
          <strong>{counts.visible}</strong>
        </span>

        <span>
          <small>Pending</small>
          <strong>{counts.pending}</strong>
        </span>

        <span>
          <small>Under review</small>
          <strong>{counts.reviewing}</strong>
        </span>

        <span>
          <small>Approved</small>
          <strong>{counts.approved}</strong>
        </span>
      </section>

      <div className="operations-toolbar">
        <div className="tabs" aria-label="Bus request status filter">
          <button
            type="button"
            className={status === "" ? "active" : ""}
            onClick={() => setStatus("")}
          >
            All
          </button>

          <button
            type="button"
            className={status === "pending" ? "active" : ""}
            onClick={() => setStatus("pending")}
          >
            Pending
          </button>

          <button
            type="button"
            className={status === "under_review" ? "active" : ""}
            onClick={() => setStatus("under_review")}
          >
            Under review
          </button>

          <button
            type="button"
            className={status === "correction_required" ? "active" : ""}
            onClick={() => setStatus("correction_required")}
          >
            Corrections
          </button>

          <button
            type="button"
            className={status === "approved" ? "active" : ""}
            onClick={() => setStatus("approved")}
          >
            Approved
          </button>

          <button
            type="button"
            className={status === "rejected" ? "active" : ""}
            onClick={() => setStatus("rejected")}
          >
            Rejected
          </button>
        </div>

        <div className="operations-toolbar-right">
          <label className="search-box">
            <Search size={16} />

            <input
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setQuery(event.target.value)
              }
              placeholder="Driver, vehicle, permit or depot"
              maxLength={80}
              aria-label="Search bus requests"
            />
          </label>
        </div>
      </div>

      <section className="panel table-panel">
        {loading ? (
          <LoadingState label="Loading bus registration requests..." />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No bus requests in this view"
            detail="New bus registrations and existing bus claims will appear here."
          />
        ) : (
          <div className="table-scroll">
            <table className="operations-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Operator & depot</th>
                  <th>Request type</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {requests.map((busRequest) => (
                  <tr key={busRequest.id}>
                    <td>
                      <strong>{busRequest.vehicleRegistrationNumber}</strong>

                      <small>
                        {busRequest.ntcPermitNumber
                          ? `NTC ${busRequest.ntcPermitNumber}`
                          : "No NTC permit submitted"}
                      </small>

                      <small>
                        {[busRequest.make, busRequest.model]
                          .filter(Boolean)
                          .join(" ") || "Make and model not submitted"}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {busRequest.driverName || "Unknown driver"}
                      </strong>

                      <small>{busRequest.driverMobile || "No mobile"}</small>

                      <small>
                        {busRequest.driverNtcRegistrationNumber ||
                          "No driver NTC number"}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {busRequest.operatorName || "No operator"}
                      </strong>

                      <small>{busRequest.depotName || "No depot"}</small>
                    </td>

                    <td>
                      <strong>
                        {requestTypeLabel(busRequest.requestType)}
                      </strong>

                      <small>Revision {busRequest.requestRevision}</small>
                    </td>

                    <td>
                      <StatusBadge value={busRequest.status} />
                    </td>

                    <td>
                      {formatDateTime(
                        busRequest.updatedAt || busRequest.createdAt,
                      )}
                    </td>

                    <td>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "7px",
                        }}
                      >
                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => openRequest(busRequest)}
                        >
                          Review
                        </button>

                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => setEditorRequest(busRequest)}
                          title="Edit bus registration request"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="mini-button danger-outline-button"
                          onClick={() => {
                            setDeleteError("");
                            setDeleteRequest(busRequest);
                          }}
                          title="Delete bus registration request"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRequest ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal schedule-editor-modal"
            style={modalStyle}
            role="dialog"
            aria-modal="true"
            aria-label="Review bus registration request"
          >
            <div className="modal-heading">
              <div>
                <p
                  className="muted"
                  style={{
                    margin: 0,
                    textTransform: "uppercase",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                  }}
                >
                  {requestTypeLabel(selectedRequest.requestType)}
                </p>

                <h2
                  style={{
                    marginBottom: "4px",
                  }}
                >
                  {selectedRequest.vehicleRegistrationNumber}
                </h2>

                <StatusBadge value={selectedRequest.status} />
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={closeRequest}
                disabled={actionBusy}
                aria-label="Close bus request"
              >
                <X size={17} />
              </button>
            </div>

            <div style={detailGridStyle}>
              <DetailBox label="Driver" value={selectedRequest.driverName} />

              <DetailBox
                label="Driver mobile"
                value={selectedRequest.driverMobile}
              />

              <DetailBox
                label="Driver NTC number"
                value={selectedRequest.driverNtcRegistrationNumber}
              />

              <DetailBox
                label="Vehicle registration"
                value={selectedRequest.vehicleRegistrationNumber}
              />

              <DetailBox
                label="NTC permit"
                value={selectedRequest.ntcPermitNumber}
              />

              <DetailBox
                label="Operator"
                value={selectedRequest.operatorName}
              />

              <DetailBox label="Depot" value={selectedRequest.depotName} />

              <DetailBox
                label="Service type"
                value={
                  selectedRequest.serviceType === "sltb"
                    ? "SLTB"
                    : selectedRequest.serviceType
                }
              />

              <DetailBox
                label="Route"
                value={
                  [selectedRequest.routeNumber, selectedRequest.routeName]
                    .filter(Boolean)
                    .join(" · ")
                }
              />

              <DetailBox label="Make" value={selectedRequest.make} />

              <DetailBox label="Model" value={selectedRequest.model} />

              <DetailBox
                label="Manufacture year"
                value={selectedRequest.manufactureYear}
              />

              <DetailBox
                label="Seating capacity"
                value={selectedRequest.seatingCapacity}
              />

              <DetailBox
                label="Request revision"
                value={selectedRequest.requestRevision}
              />
            </div>

            {selectedRequest.notes ? (
              <div
                style={{
                  ...detailBoxStyle,
                  marginTop: "12px",
                }}
              >
                <small
                  style={{
                    display: "block",
                    color: "#64748b",
                    marginBottom: "5px",
                  }}
                >
                  Driver notes
                </small>

                <p style={{ margin: 0 }}>{selectedRequest.notes}</p>
              </div>
            ) : null}

            {selectedRequest.correctionMessage ? (
              <div
                style={{
                  marginTop: "14px",
                  padding: "14px",
                  borderRadius: "14px",
                  border: "1px solid #fde68a",
                  background: "#fffbeb",
                }}
              >
                <strong style={{ color: "#92400e" }}>
                  Correction requested
                </strong>

                <p
                  style={{
                    color: "#a16207",
                    marginBottom: "6px",
                  }}
                >
                  {selectedRequest.correctionMessage}
                </p>

                <small>
                  Fields: {selectedRequest.correctionFields.join(", ")}
                </small>
              </div>
            ) : null}

            {selectedRequest.rejectionReason ? (
              <div
                style={{
                  marginTop: "14px",
                  padding: "14px",
                  borderRadius: "14px",
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                }}
              >
                <strong style={{ color: "#991b1b" }}>Rejection reason</strong>

                <p
                  style={{
                    color: "#b91c1c",
                    marginBottom: 0,
                  }}
                >
                  {selectedRequest.rejectionReason}
                </p>
              </div>
            ) : null}

            {actionMode === "correction" ? (
              <div
                style={{
                  marginTop: "18px",
                  padding: "16px",
                  borderRadius: "16px",
                  border: "1px solid #fde68a",
                  background: "#fffbeb",
                }}
              >
                <h3
                  style={{
                    marginTop: 0,
                    color: "#92400e",
                  }}
                >
                  Request corrections
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "9px",
                    marginBottom: "14px",
                  }}
                >
                  {CORRECTION_FIELDS.map((field) => (
                    <label
                      key={field.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontWeight: 700,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={correctionFields.includes(field.value)}
                        onChange={() => toggleCorrectionField(field.value)}
                      />

                      {field.label}
                    </label>
                  ))}
                </div>

                <label
                  style={{
                    display: "grid",
                    gap: "7px",
                  }}
                >
                  <strong>Message to driver</strong>

                  <textarea
                    value={correctionMessage}
                    onChange={(event) =>
                      setCorrectionMessage(event.target.value)
                    }
                    maxLength={1000}
                    rows={4}
                    placeholder="Explain what the driver must correct."
                  />
                </label>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setActionMode(null);
                      setActionError("");
                    }}
                    disabled={actionBusy}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void submitCorrection()}
                    disabled={actionBusy}
                  >
                    <MessageSquareWarning size={15} />

                    {actionBusy ? "Sending..." : "Send correction request"}
                  </button>
                </div>
              </div>
            ) : null}

            {actionMode === "rejection" ? (
              <div
                style={{
                  marginTop: "18px",
                  padding: "16px",
                  borderRadius: "16px",
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                }}
              >
                <h3
                  style={{
                    marginTop: 0,
                    color: "#991b1b",
                  }}
                >
                  Reject bus request
                </h3>

                <label
                  style={{
                    display: "grid",
                    gap: "7px",
                  }}
                >
                  <strong>Reason for rejection</strong>

                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="Explain why this bus request cannot be approved."
                  />
                </label>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setActionMode(null);
                      setActionError("");
                    }}
                    disabled={actionBusy}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="secondary-button danger-outline-button"
                    onClick={() => void submitRejection()}
                    disabled={actionBusy}
                  >
                    <XCircle size={15} />

                    {actionBusy ? "Rejecting..." : "Confirm rejection"}
                  </button>
                </div>
              </div>
            ) : null}

            {actionError ? <p className="form-error">{actionError}</p> : null}

            {!actionMode ? (
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeRequest}
                  disabled={actionBusy}
                >
                  Close
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setEditorRequest(selectedRequest);
                    setActionError("");
                  }}
                  disabled={actionBusy}
                  title="Edit bus registration request"
                >
                  <Pencil size={15} />
                  Edit request
                </button>

                <button
                  type="button"
                  className="secondary-button danger-outline-button"
                  onClick={() => {
                    setDeleteError("");
                    setDeleteRequest(selectedRequest);
                  }}
                  disabled={actionBusy}
                  title="Delete bus registration request"
                >
                  <Trash2 size={15} />
                  Delete
                </button>

                {selectedRequest.status === "pending" ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void startReview()}
                    disabled={actionBusy}
                  >
                    <ClipboardCheck size={15} />

                    {actionBusy ? "Starting..." : "Start review"}
                  </button>
                ) : null}

                {selectedRequest.status === "under_review" ? (
                  <>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setActionMode("correction");
                        setActionError("");
                      }}
                      disabled={actionBusy}
                    >
                      <MessageSquareWarning size={15} />
                      Request correction
                    </button>

                    <button
                      type="button"
                      className="secondary-button danger-outline-button"
                      onClick={() => {
                        setActionMode("rejection");
                        setActionError("");
                      }}
                      disabled={actionBusy}
                    >
                      <XCircle size={15} />
                      Reject
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void approveRequest()}
                      disabled={actionBusy}
                    >
                      <CheckCircle2 size={15} />

                      {actionBusy ? "Approving..." : "Approve request"}
                    </button>
                  </>
                ) : null}

                {selectedRequest.status === "approved" ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      color: "#15803d",
                      fontWeight: 800,
                    }}
                  >
                    <BadgeCheck size={18} />
                    Bus approved
                  </span>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {editorRequest ? (
        <BusRequestEditorModal
          busRequest={editorRequest}
          onClose={() => setEditorRequest(null)}
          onSaved={requestUpdated}
        />
      ) : null}

      {deleteRequest ? (
        <BusRequestDeleteModal
          registration={deleteRequest.vehicleRegistrationNumber}
          busy={deleteBusy}
          error={deleteError}
          onClose={() => {
            if (!deleteBusy) {
              setDeleteRequest(null);
              setDeleteError("");
            }
          }}
          onConfirm={() => void deleteSelectedRequest()}
        />
      ) : null}
    </>
  );
}
