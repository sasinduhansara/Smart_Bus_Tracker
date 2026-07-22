import { useCallback, useEffect, useMemo, useState } from "react";

import { Search, Users } from "lucide-react";

import { getDrivers } from "../../api/driverApi";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingState } from "../../components/common/LoadingState";
import { Notice } from "../../components/common/Notice";
import { PageHeader } from "../../components/common/pageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import type { Driver } from "../../types";
import { formatDateTime } from "../../utils/date";
import { getErrorMessage } from "../../utils/errors";
import { getInitials, humanize } from "../../utils/text";

import { DriverReviewModal } from "./DriverReviewModal";

interface DriversPageProps {
  onDataChanged: () => void;
}

const FILTERS = [
  ["pending", "Pending"],
  ["under_review", "Under review"],
  ["correction_required", "Correction required"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["blocked", "Blocked"],
  ["", "All drivers"],
] as const;

export function DriversPage({ onDataChanged }: DriversPageProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filter, setFilter] = useState("pending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setDrivers(await getDrivers(filter));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load drivers"));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadDrivers();
  }, [loadDrivers]);

  const visibleDrivers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return drivers;
    }

    return drivers.filter((driver) =>
      [
        driver.fullName,
        driver.email,
        driver.mobile,
        driver.nic,
        driver.driverNtcRegistrationNumber,
        driver.drivingLicenseNumber,
        driver.depotOperator,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [drivers, query]);

  const handleDriverChanged = async () => {
    await loadDrivers();
    onDataChanged();
  };

  return (
    <>
      <PageHeader
        eyebrow="PEOPLE & TRUST"
        title="Driver approvals"
        subtitle="Review driver identity, qualifications and KYC documents."
        onRefresh={loadDrivers}
        loading={loading}
      />

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

        <label className="search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search identity or licence"
          />
        </label>
      </div>

      {error ? <Notice tone="error" message={error} /> : null}

      <section className="panel table-panel">
        {loading ? (
          <LoadingState label="Loading driver applications..." />
        ) : visibleDrivers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No drivers in this view"
            detail="Try another verification status or search term."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Qualifications</th>
                  <th>KYC</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {visibleDrivers.map((driver) => (
                  <tr key={driver._id}>
                    <td>
                      <button
                        type="button"
                        className="person person-link"
                        onClick={() => setSelectedDriver(driver)}
                      >
                        <span className="avatar">
                          {getInitials(driver.fullName)}
                        </span>

                        <span>
                          <strong>{driver.fullName || "Unnamed driver"}</strong>
                          <small>
                            {driver.email || driver.mobile || "No contact"}
                          </small>
                        </span>
                      </button>
                    </td>

                    <td>
                      <strong>
                        {driver.driverNtcRegistrationNumber ||
                          "NTC not provided"}
                      </strong>
                      <small>
                        Licence {driver.drivingLicenseNumber || "—"}
                      </small>
                    </td>

                    <td>
                      <StatusBadge
                        value={driver.verificationStatus || "pending"}
                      />
                      <small className="sub-status">
                        {humanize(driver.kycStatus || "NOT_SUBMITTED")}
                      </small>
                    </td>

                    <td>{formatDateTime(driver.createdAt)}</td>

                    <td>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => setSelectedDriver(driver)}
                      >
                        Open review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedDriver ? (
        <DriverReviewModal
          initialDriver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
          onChanged={handleDriverChanged}
        />
      ) : null}
    </>
  );
}
