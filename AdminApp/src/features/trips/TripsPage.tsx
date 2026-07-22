import { useEffect, useState } from "react";
import { Activity, ChevronRight } from "lucide-react";

import { getAdminTrips } from "../../api/tripsApi";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingState } from "../../components/common/LoadingState";
import { Notice } from "../../components/common/Notice";
import { PageHeader } from "../../components/common/pageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import type { Trip } from "../../types";
import { formatDateTime } from "../../utils/date";
import { getErrorMessage } from "../../utils/errors";

const FILTERS = [
  ["", "All trips"],
  ["active", "Active"],
  ["paused", "Paused"],
  ["completed", "Completed"],
] as const;

export function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTrips = async () => {
    setLoading(true);
    setError("");

    try {
      setTrips((await getAdminTrips(filter)).trips);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load trips"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTrips();
  }, [filter]);

  return (
    <>
      <PageHeader
        eyebrow="SERVICE HISTORY"
        title="Trip activity"
        subtitle="Monitor active journeys and review completed service runs."
        onRefresh={loadTrips}
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
      </div>

      {error ? <Notice tone="error" message={error} /> : null}

      <section className="panel table-panel">
        {loading ? (
          <LoadingState label="Loading trip activity..." />
        ) : trips.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No trip activity"
            detail="Trips appear after assigned drivers begin service."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Bus</th>
                  <th>Journey</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Distance</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => (
                  <tr key={trip.id}>
                    <td>
                      <strong>Route {trip.routeNumber || "—"}</strong>
                      <small>{trip.routeName}</small>
                    </td>
                    <td>{trip.busId || "—"}</td>
                    <td>
                      <span className="journey-cell">
                        {trip.origin || "—"} <ChevronRight size={13} />{" "}
                        {trip.destination || "—"}
                      </span>
                    </td>
                    <td>
                      <StatusBadge value={trip.status} />
                    </td>
                    <td>{formatDateTime(trip.startedAt)}</td>
                    <td>{Number(trip.distanceKm || 0).toFixed(1)} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
