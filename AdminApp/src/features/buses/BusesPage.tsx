import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BusFront,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import {
  deleteAdminBus,
  deleteAdminDepot,
  getAdminBuses,
  getAdminDepots,
} from "../../api/busesApi";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingState } from "../../components/common/LoadingState";
import { Notice } from "../../components/common/Notice";
import { PageHeader } from "../../components/common/pageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import type { Bus, Depot } from "../../types";
import { formatDateTime } from "../../utils/date";
import { getErrorMessage } from "../../utils/errors";
import { BusEditorModal } from "./BusEditorModal";
import { DeleteRecordModal } from "./DeleteRecordModal";
import type { DeleteRecordKind } from "./DeleteRecordModal";
import { DepotEditorModal } from "./DepotEditorModal";

type OperationsTab = "buses" | "depots";

interface DeleteTarget {
  kind: DeleteRecordKind;
  id: string;
  name: string;
}

export function BusesPage() {
  const [tab, setTab] = useState<OperationsTab>("buses");
  const [buses, setBuses] = useState<Bus[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [query, setQuery] = useState("");
  const [recordStatus, setRecordStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [busEditorOpen, setBusEditorOpen] = useState(false);
  const [editingDepot, setEditingDepot] = useState<Depot | null>(null);
  const [depotEditorOpen, setDepotEditorOpen] = useState(false);

  const loadOperations = async () => {
    setLoading(true);
    setError("");

    try {
      const [busResponse, depotResponse] = await Promise.all([
        getAdminBuses(),
        getAdminDepots(),
      ]);

      setBuses(busResponse.buses);
      setDepots(depotResponse.depots);
    } catch (loadError) {
      setError(
        getErrorMessage(loadError, "Could not load operational records"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOperations();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const visibleBuses = useMemo(
    () =>
      buses.filter((bus) => {
        if (recordStatus && bus.recordStatus !== recordStatus) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [
          bus.vehicleRegistrationNumber,
          bus.busId,
          bus.ntcPermitNumber,
          bus.depotName,
          bus.make,
          bus.model,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [buses, normalizedQuery, recordStatus],
  );

  const visibleDepots = useMemo(
    () =>
      depots.filter((depot) => {
        if (!normalizedQuery) {
          return true;
        }

        return [
          depot.name,
          depot.code,
          depot.district,
          depot.address,
          depot.contactPhone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [depots, normalizedQuery],
  );

  const openNewBus = () => {
    setEditingBus(null);
    setBusEditorOpen(true);
  };

  const openNewDepot = () => {
    setEditingDepot(null);
    setDepotEditorOpen(true);
  };

  const actionLabel = tab === "buses" ? "Add bus" : "Add depot";

  const handleAdd = () => {
    if (tab === "buses") {
      openNewBus();
    } else {
      openNewDepot();
    }
  };

  const openDeleteConfirmation = (target: DeleteTarget) => {
    setDeleteError("");
    setDeleteTarget(target);
  };

  const closeDeleteConfirmation = () => {
    if (deleteBusy) {
      return;
    }

    setDeleteTarget(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteBusy(true);
    setDeleteError("");
    setNotice("");

    try {
      if (deleteTarget.kind === "bus") {
        await deleteAdminBus(deleteTarget.id);
      } else {
        await deleteAdminDepot(deleteTarget.id);
      }

      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      await loadOperations();
      setNotice(`${deletedName} was deleted successfully`);
    } catch (deleteFailure) {
      setDeleteError(
        getErrorMessage(deleteFailure, "Could not delete this record"),
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="OPERATIONS"
        title="Fleet & depots"
        subtitle="Manage canonical fleet records separately from live trip telemetry."
        onRefresh={loadOperations}
        loading={loading}
      />

      <div className="operations-toolbar">
        <div className="tabs">
          <button
            type="button"
            className={tab === "buses" ? "active" : ""}
            onClick={() => setTab("buses")}
          >
            Buses
          </button>
          <button
            type="button"
            className={tab === "depots" ? "active" : ""}
            onClick={() => setTab("depots")}
          >
            Depots
          </button>
        </div>

        <div className="operations-toolbar-right">
          {tab === "buses" ? (
            <select
              className="compact-select"
              value={recordStatus}
              onChange={(event) => setRecordStatus(event.target.value)}
              aria-label="Filter buses by record status"
            >
              <option value="">All record statuses</option>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </select>
          ) : null}

          <label className="search-box">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${tab}`}
            />
          </label>

          <button
            type="button"
            className="primary-button operations-add-button"
            onClick={handleAdd}
          >
            <Plus size={16} />
            {actionLabel}
          </button>
        </div>
      </div>

      {error ? <Notice tone="error" message={error} /> : null}
      {notice ? <Notice tone="success" message={notice} /> : null}

      {loading ? (
        <section className="panel">
          <LoadingState label="Loading operational records..." />
        </section>
      ) : tab === "buses" ? (
        <section className="panel table-panel">
          {visibleBuses.length === 0 ? (
            <EmptyState
              icon={BusFront}
              title="No bus records in this view"
              detail="Create a bus record or adjust the search and status filters."
            />
          ) : (
            <div className="table-scroll">
              <table className="operations-table">
                <thead>
                  <tr>
                    <th>Bus</th>
                    <th>Depot</th>
                    <th>Master status</th>
                    <th>Live state</th>
                    <th>Latest telemetry</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBuses.map((bus) => (
                    <tr key={bus.id || bus.busId}>
                      <td>
                        <strong>
                          {bus.vehicleRegistrationNumber || bus.busId || "—"}
                        </strong>
                        <small>
                          {bus.ntcPermitNumber
                            ? `NTC ${bus.ntcPermitNumber}`
                            : "No NTC permit recorded"}
                        </small>
                        <small>
                          {[bus.make, bus.model].filter(Boolean).join(" ") ||
                            "Make and model not recorded"}
                        </small>
                      </td>
                      <td>
                        <strong>{bus.depotName || "Unassigned depot"}</strong>
                      </td>
                      <td>
                        <StatusBadge value={bus.recordStatus || "active"} />
                      </td>
                      <td>
                        <StatusBadge
                          value={bus.operationalStatus || "offline"}
                        />
                        <small>
                          {bus.routeNumber
                            ? `Route ${bus.routeNumber}`
                            : "No active route"}
                        </small>
                      </td>
                      <td>
                        <span className="operations-meta-line">
                          <Clock3 size={13} />
                          {formatDateTime(
                            bus.statusUpdatedAt || bus.updatedAt || "",
                          )}
                        </span>
                        {typeof bus.speed === "number" ? (
                          <span className="operations-meta-line">
                            <Activity size={13} />
                            {Math.round(bus.speed)} km/h
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="mini-button"
                            onClick={() => {
                              setEditingBus(bus);
                              setBusEditorOpen(true);
                            }}
                          >
                            <Pencil size={13} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="mini-button delete-record-button"
                            onClick={() =>
                              openDeleteConfirmation({
                                kind: "bus",
                                id: bus.id,
                                name:
                                  bus.vehicleRegistrationNumber ||
                                  bus.busId ||
                                  "Bus record",
                              })
                            }
                          >
                            <Trash2 size={13} />
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
      ) : (
        <section className="operations-card-grid">
          {visibleDepots.length === 0 ? (
            <div className="panel operations-empty-panel">
              <EmptyState
                icon={MapPin}
                title="No depots in this view"
                detail="Create a depot to get started."
              />
            </div>
          ) : (
            visibleDepots.map((depot) => {
              const depotBuses = buses.filter(
                (bus) => bus.depotId === depot.id,
              );

              return (
                <article
                  className="panel operations-record-card"
                  key={depot.id}
                >
                  <div className="operations-card-heading">
                    <span className="operations-card-icon">
                      <MapPin size={18} />
                    </span>
                    <StatusBadge
                      value={depot.isActive ? "active" : "inactive"}
                    />
                  </div>
                  <h3>{depot.name}</h3>
                  <p className="muted">{depot.code}</p>
                  <div className="operations-card-stats">
                    <span>
                      <strong>{depotBuses.length}</strong>
                      <small>buses</small>
                    </span>
                    <span>
                      <strong>{depot.district || "—"}</strong>
                      <small>district</small>
                    </span>
                  </div>
                  <div className="operations-card-contact">
                    <span>{depot.address || "No address recorded"}</span>
                    <span>{depot.contactPhone || "No contact phone"}</span>
                  </div>
                  <div className="operations-card-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setEditingDepot(depot);
                        setDepotEditorOpen(true);
                      }}
                    >
                      <Pencil size={14} />
                      Edit depot
                    </button>
                    <button
                      type="button"
                      className="secondary-button danger-outline-button"
                      onClick={() =>
                        openDeleteConfirmation({
                          kind: "depot",
                          id: depot.id,
                          name: depot.name,
                        })
                      }
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      {busEditorOpen ? (
        <BusEditorModal
          bus={editingBus}
          depots={depots}
          onClose={() => {
            setBusEditorOpen(false);
            setEditingBus(null);
          }}
          onSaved={loadOperations}
        />
      ) : null}

      {depotEditorOpen ? (
        <DepotEditorModal
          depot={editingDepot}
          onClose={() => {
            setDepotEditorOpen(false);
            setEditingDepot(null);
          }}
          onSaved={loadOperations}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteRecordModal
          kind={deleteTarget.kind}
          name={deleteTarget.name}
          busy={deleteBusy}
          error={deleteError}
          onClose={closeDeleteConfirmation}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </>
  );
}
