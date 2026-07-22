import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileCheck2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Unlock,
  X,
} from "lucide-react";

import {
  approveDriver,
  blockDriver,
  getDriver,
  rejectDriver,
  requestDriverCorrection,
  startDriverReview,
  unblockDriver,
  unrejectDriver,
} from "../../api/driverApi";

import { LoadingState } from "../../components/common/LoadingState";
import { Notice } from "../../components/common/Notice";
import { StatusBadge } from "../../components/common/StatusBadge";

import type { Driver, DriverCorrectionField } from "../../types";

import { formatDateOnly, formatDateTime } from "../../utils/date";

import { getErrorMessage } from "../../utils/errors";
import { humanize } from "../../utils/text";

import { getDriverDocuments, hasAllRequiredDocuments } from "./driverDocuments";

interface DriverReviewModalProps {
  initialDriver: Driver;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

type ReviewAction =
  | "correction"
  | "reject"
  | "block"
  | "unblock"
  | "unreject"
  | null;

export function DriverReviewModal({
  initialDriver,
  onClose,
  onChanged,
}: DriverReviewModalProps) {
  const [driver, setDriver] = useState<Driver>(initialDriver);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<ReviewAction>(null);
  const [reason, setReason] = useState("");

  const [selectedCorrectionFields, setSelectedCorrectionFields] = useState<
    DriverCorrectionField[]
  >([]);

  const loadLatestDriver = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const latestResponse = await getDriver(initialDriver._id);
      setDriver(latestResponse.driver);
    } catch (loadError) {
      setError(
        getErrorMessage(
          loadError,
          "Could not open the latest driver application",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [initialDriver._id]);

  useEffect(() => {
    void loadLatestDriver();
  }, [loadLatestDriver]);

  const documentsComplete = useMemo(
    () => hasAllRequiredDocuments(driver),
    [driver],
  );

  const verificationStatus = String(driver.verificationStatus || "pending")
    .trim()
    .toLowerCase();

  const canStartReview = ["pending", "unverified"].includes(verificationStatus);

  const canApprove = documentsComplete && verificationStatus === "under_review";

  const canTakeReviewDecision = verificationStatus === "under_review";

  const handleStartReview = async () => {
    setBusy(true);
    setError("");

    try {
      const reviewResponse = await startDriverReview(driver._id);

      setDriver(reviewResponse.driver);
      await onChanged();
    } catch (reviewError) {
      setError(
        getErrorMessage(
          reviewError,
          "Could not start the driver application review",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const completeAction = async (callback: () => Promise<unknown>) => {
    setBusy(true);
    setError("");

    try {
      await callback();
      await onChanged();
      onClose();
    } catch (actionError) {
      setError(getErrorMessage(actionError, "Driver review action failed"));
    } finally {
      setBusy(false);
    }
  };

  const beginCorrectionAction = () => {
    const missingFields = getDriverDocuments(driver)
      .filter(([, document]) => !document?.url)
      .map(([documentType]) => documentType as DriverCorrectionField);

    setSelectedCorrectionFields(missingFields);
    setReason("");
    setError("");
    setAction("correction");
  };

  const toggleCorrectionField = (field: DriverCorrectionField) => {
    setSelectedCorrectionFields((currentFields) =>
      currentFields.includes(field)
        ? currentFields.filter((currentField) => currentField !== field)
        : [...currentFields, field],
    );
  };

  const cancelAction = () => {
    setAction(null);
    setReason("");
    setSelectedCorrectionFields([]);
    setError("");
  };

  const submitReviewAction = async () => {
    if (!action) {
      return;
    }

    if (action === "unblock") {
      await completeAction(() => unblockDriver(driver._id));
      return;
    }

    if (action === "unreject") {
      await completeAction(() => unrejectDriver(driver._id));
      return;
    }

    const normalizedReason = reason.trim();

    if (!normalizedReason) {
      setError("A clear administrative reason is required");
      return;
    }

    if (action === "correction") {
      if (!selectedCorrectionFields.length) {
        setError("Select at least one document that requires correction");
        return;
      }

      await completeAction(() =>
        requestDriverCorrection(
          driver._id,
          selectedCorrectionFields,
          normalizedReason,
        ),
      );
      return;
    }

    if (action === "reject") {
      await completeAction(() => rejectDriver(driver._id, normalizedReason));
      return;
    }

    await completeAction(() => blockDriver(driver._id, normalizedReason));
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal driver-review-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-review-title"
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">KYC REVIEW</p>
            <h2 id="driver-review-title">
              {driver.fullName || "Unnamed driver"}
            </h2>
            <p className="muted">
              {driver.email || driver.mobile || "No contact information"}
            </p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close driver review"
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        {error ? <Notice tone="error" message={error} /> : null}

        {loading ? (
          <LoadingState label="Opening the latest application..." />
        ) : (
          <>
            <div className="review-status-row">
              <StatusBadge value={driver.verificationStatus || "pending"} />
              <span>KYC revision {driver.kycRevision ?? 0}</span>

              <button
                type="button"
                className="text-button review-refresh"
                onClick={() => void loadLatestDriver()}
                disabled={busy || loading}
              >
                <RefreshCw size={14} />
                Reload
              </button>
            </div>

            <div className="detail-grid">
              <span>
                <small>NIC</small>
                <strong>{driver.nic || "—"}</strong>
              </span>

              <span>
                <small>Mobile</small>
                <strong>{driver.mobile || "—"}</strong>
              </span>

              <span>
                <small>Driver NTC Number</small>
                <strong>{driver.driverNtcRegistrationNumber || "—"}</strong>
              </span>

              <span>
                <small>Driving Licence</small>
                <strong>{driver.drivingLicenseNumber || "—"}</strong>
              </span>

              <span>
                <small>Licence Expiry</small>
                <strong>{formatDateOnly(driver.drivingLicenseExpiry)}</strong>
              </span>

              <span>
                <small>Operator / Depot</small>
                <strong>{driver.depotOperator || "Not provided"}</strong>
              </span>

              <span>
                <small>Review started</small>
                <strong>{formatDateTime(driver.reviewedAt || "")}</strong>
              </span>

              <span>
                <small>Submitted</small>
                <strong>{formatDateTime(driver.createdAt)}</strong>
              </span>
            </div>

            {driver.correctionMessage ? (
              <div className="review-message-box">
                <small>Active correction request</small>
                <p>{driver.correctionMessage}</p>
              </div>
            ) : null}

            <div className="document-section-heading">
              <div>
                <h3 className="document-title">Required identity documents</h3>
                <p className="muted document-help">
                  Open and inspect every document before taking an action.
                </p>
              </div>

              <StatusBadge
                value={
                  documentsComplete ? "documents complete" : "documents missing"
                }
              />
            </div>

            <div className="document-grid">
              {getDriverDocuments(driver).map(([documentType, document]) =>
                document?.url ? (
                  <a
                    className="document-link"
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={documentType}
                  >
                    <FileCheck2 size={17} />
                    <span>
                      <strong>{humanize(documentType)}</strong>
                      <small>{document.fileName || "Open document"}</small>
                    </span>
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <div
                    className="document-link document-missing"
                    key={documentType}
                  >
                    <AlertTriangle size={17} />
                    <span>
                      <strong>{humanize(documentType)}</strong>
                      <small>Not submitted</small>
                    </span>
                  </div>
                ),
              )}
            </div>

            {action ? (
              <div className="review-reason-panel">
                {action === "unblock" || action === "unreject" ? (
                  <div className="review-message-box">
                    <small>Confirm administrative action</small>
                    <p>
                      {action === "unblock"
                        ? "Unblock this driver and restore the account to its previous verification state."
                        : "Reopen this rejected application and return it to the review workflow."}
                    </p>
                  </div>
                ) : (
                  <>
                    {action === "correction" ? (
                      <fieldset className="correction-fieldset">
                        <legend>Documents requiring correction</legend>

                        <div className="correction-options">
                          {getDriverDocuments(driver).map(([documentType]) => (
                            <label
                              className="correction-option"
                              key={documentType}
                            >
                              <input
                                type="checkbox"
                                checked={selectedCorrectionFields.includes(
                                  documentType,
                                )}
                                onChange={() =>
                                  toggleCorrectionField(documentType)
                                }
                                disabled={busy}
                              />
                              <span>{humanize(documentType)}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ) : null}

                    <label>
                      {action === "correction"
                        ? "Correction instructions"
                        : action === "reject"
                          ? "Rejection reason"
                          : "Block reason"}

                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={1000}
                        placeholder={
                          action === "correction"
                            ? "Explain exactly what must be corrected"
                            : "Enter a factual reason for the audit record"
                        }
                        disabled={busy}
                      />
                    </label>
                  </>
                )}

                <div className="reason-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={cancelAction}
                    disabled={busy}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={
                      action === "reject" || action === "block"
                        ? "primary-button danger-button"
                        : "primary-button"
                    }
                    onClick={() => void submitReviewAction()}
                    disabled={
                      busy ||
                      ((action === "correction" ||
                        action === "reject" ||
                        action === "block") &&
                        !reason.trim()) ||
                      (action === "correction" &&
                        !selectedCorrectionFields.length)
                    }
                  >
                    Confirm{" "}
                    {action === "correction"
                      ? "correction request"
                      : action === "reject"
                        ? "rejection"
                        : action === "block"
                          ? "block"
                          : action === "unblock"
                            ? "unblock"
                            : "reopen application"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-actions review-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onClose}
                  disabled={busy}
                >
                  Close
                </button>

                {verificationStatus === "blocked" ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setAction("unblock")}
                    disabled={busy}
                  >
                    <Unlock size={16} />
                    Unblock driver
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary-button danger-outline-button"
                    onClick={() => setAction("block")}
                    disabled={busy}
                  >
                    <ShieldCheck size={16} />
                    Block
                  </button>
                )}

                {verificationStatus === "rejected" ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setAction("unreject")}
                    disabled={busy}
                  >
                    <RotateCcw size={16} />
                    Reopen application
                  </button>
                ) : null}

                {canStartReview ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleStartReview()}
                    disabled={busy}
                  >
                    <ShieldCheck size={16} />
                    Start review
                  </button>
                ) : null}

                {canTakeReviewDecision ? (
                  <>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={beginCorrectionAction}
                      disabled={busy}
                    >
                      Request correction
                    </button>

                    <button
                      type="button"
                      className="secondary-button danger-outline-button"
                      onClick={() => setAction("reject")}
                      disabled={busy}
                    >
                      <X size={16} />
                      Reject
                    </button>
                  </>
                ) : null}

                {canApprove ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      void completeAction(() => approveDriver(driver._id))
                    }
                    disabled={busy}
                  >
                    <Check size={16} />
                    Approve driver
                  </button>
                ) : null}
              </div>
            )}

            {!canApprove && verificationStatus === "under_review" ? (
              <p className="review-action-help">
                Approval becomes available after all four required documents are
                present.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
