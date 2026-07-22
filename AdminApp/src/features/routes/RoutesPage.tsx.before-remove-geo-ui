import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { ArrowRight, Edit3, Map, Plus, Search, Trash2 } from "lucide-react";

import {
  deleteAdminRoute,
  getAdminRoute,
  getAdminRoutes,
} from "../../api/routesApi";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingState } from "../../components/common/LoadingState";
import { Notice } from "../../components/common/Notice";
import { PageHeader } from "../../components/common/pageHeader";
import type {
  RouteDetails,
  RouteRecordStatus,
  RouteSummary,
} from "../../types/route";
import { getErrorMessage } from "../../utils/errors";
import { RouteDeleteModal } from "./RouteDeleteModal";
import { RouteEditorModal } from "./RouteEditorModal";
import { RouteGeometryEditor } from "./RouteGeometryEditor";

const categoryLabels: Record<string, string> = {
  sltb: "SLTB",
  private: "Private",
  intercity: "Intercity",
};

export function RoutesPage() {
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RouteRecordStatus | "">("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteDetails | null>(null);
  const [loadingRouteId, setLoadingRouteId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RouteSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [geometryEditorOpen, setGeometryEditorOpen] = useState(false);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getAdminRoutes({
        q: search,
        status,
      });
      setRoutes(response.routes);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load routes"));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRoutes();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadRoutes]);

  const activeCount = useMemo(
    () => routes.filter((route) => route.recordStatus === "active").length,
    [routes],
  );

  const openCreate = () => {
    setSuccess("");
    setError("");
    setEditingRoute(null);
    setEditorOpen(true);
  };

  const openEdit = async (route: RouteSummary) => {
    setLoadingRouteId(route.id);
    setError("");
    setSuccess("");

    try {
      const response = await getAdminRoute(route.id);
      setEditingRoute(response.route);
      setEditorOpen(true);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load route details"));
    } finally {
      setLoadingRouteId("");
    }
  };

  const openGeometryEdit = async (route: RouteSummary) => {
    setLoadingRouteId(route.id);
    setError("");
    setSuccess("");

    try {
      const response = await getAdminRoute(route.id);
      setEditingRoute(response.route);
      setGeometryEditorOpen(true);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load route details"));
    } finally {
      setLoadingRouteId("");
    }
  };

  const handleSaved = (message: string) => {
    setEditorOpen(false);
    setGeometryEditorOpen(false);
    setEditingRoute(null);
    setSuccess(message);
    void loadRoutes();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      await deleteAdminRoute(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess(`Route ${deleteTarget.routeNumber} deleted successfully.`);
      void loadRoutes();
    } catch (deleteFailure) {
      setDeleteError(
        getErrorMessage(deleteFailure, "Could not delete the route"),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="NETWORK DESIGN"
        title="Routes & stops"
        subtitle="Manage route numbers, route names, depots and ordered stop names used by the timetable and passenger search."
        onRefresh={loadRoutes}
        loading={loading}
      />

      {error ? <Notice tone="error" message={error} /> : null}
      {success ? <Notice tone="success" message={success} /> : null}

      <section className="route-registry-summary">
        <span>
          <small>Visible records</small>
          <strong>{routes.length}</strong>
        </span>
        <span>
          <small>Active routes</small>
          <strong>{activeCount}</strong>
        </span>
        <span>
          <small>Current scope</small>
          <strong>Route registry</strong>
        </span>
      </section>

      <div className="operations-toolbar route-toolbar">
        <div className="tabs" aria-label="Route status filter">
          <button
            type="button"
            className={status === "" ? "active" : ""}
            onClick={() => setStatus("")}
          >
            All
          </button>
          <button
            type="button"
            className={status === "active" ? "active" : ""}
            onClick={() => setStatus("active")}
          >
            Active
          </button>
          <button
            type="button"
            className={status === "inactive" ? "active" : ""}
            onClick={() => setStatus("inactive")}
          >
            Inactive
          </button>
        </div>

        <div className="operations-toolbar-right">
          <label className="search-box">
            <Search size={15} />
            <input
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setSearch(event.target.value)
              }
              placeholder="Route, town or stop"
              maxLength={80}
              aria-label="Search routes"
            />
          </label>

          <button
            type="button"
            className="primary-button operations-add-button"
            onClick={openCreate}
          >
            <Plus size={16} />
            Add route
          </button>
        </div>
      </div>

      <section className="route-grid route-management-grid">
        {loading ? (
          <div className="panel operations-empty-panel">
            <LoadingState label="Loading routes..." />
          </div>
        ) : routes.length === 0 ? (
          <div className="panel operations-empty-panel">
            <EmptyState
              icon={Map}
              title="No matching routes"
              detail="Create the first route or change the current filters."
            />
          </div>
        ) : (
          routes.map((route) => (
            <article className="panel route-management-card" key={route.id}>
              <div className="route-management-card-top">
                <div className="route-badge">{route.routeNumber}</div>
                <span className={`status-pill ${route.recordStatus}`}>
                  {route.recordStatus}
                </span>
              </div>
              <h3>{route.name}</h3>

              <div className="route-journey-line">
                <span>{route.origin}</span>
                <ArrowRight size={15} />
                <span>{route.destination}</span>
              </div>

              <div className="route-category-list">
                {route.serviceCategories
                  .filter((category) => category !== "ac")
                  .map((category) => (
                    <span key={category}>
                      {categoryLabels[category] ?? category}
                    </span>
                  ))}
              </div>

              <div className="route-management-meta">
                <span>
                  <strong>{route.stopCount}</strong>
                  <small>ordered stops</small>
                </span>
                <span>
                  <strong>{route.depotName || "Not assigned"}</strong>
                  <small>depot name</small>
                </span>
                <span>
                  <strong>
                    {/* @ts-ignore */}
                    {route.geometryVersion ? `v${route.geometryVersion}` : "None"}
                  </strong>
                  <small>geometry</small>
                </span>
              </div>

              <div className="operations-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void openEdit(route)}
                  disabled={loadingRouteId === route.id}
                >
                  <Edit3 size={15} />
                  {loadingRouteId === route.id ? "Loading..." : "Edit"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void openGeometryEdit(route)}
                  disabled={loadingRouteId === route.id}
                >
                  <Map size={15} />
                  Geo
                </button>
                <button
                  type="button"
                  className="secondary-button delete-record-button"
                  onClick={() => {
                    setDeleteError("");
                    setDeleteTarget(route);
                  }}
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {editorOpen ? (
        <RouteEditorModal
          route={editingRoute}
          onClose={() => {
            setEditorOpen(false);
            setEditingRoute(null);
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {geometryEditorOpen && editingRoute ? (
        <RouteGeometryEditor
          route={editingRoute}
          onClose={() => {
            setGeometryEditorOpen(false);
            setEditingRoute(null);
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {deleteTarget ? (
        <RouteDeleteModal
          route={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError("");
          }}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </>
  );
}
