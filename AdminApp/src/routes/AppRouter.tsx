import { useCallback, useEffect, useState } from "react";

import { getAdminOverview } from "../api/dashboardApi";
import { Notice } from "../components/common/Notice";
import { AdminLayout } from "../components/layout/AdminLayout";
import { BusRequestsPage } from "../features/busRequests/BusRequestsPage";
import { BusesPage } from "../features/buses/BusesPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { DriversPage } from "../features/drivers/DriversPage";
import { IssuesPage } from "../features/issues/IssuesPage";
import { LiveMonitorMap } from "../features/map/LiveMonitorMap";
import { RoutesPage } from "../features/routes/RoutesPage";
import { SchedulesPage } from "../features/schedules/SchedulesPage";
import { TripsPage } from "../features/trips/TripsPage";
import { useHashNavigation } from "../navigation/useHashNavigation";
import type { AdminSession, Metrics } from "../types";
import { getErrorMessage } from "../utils/errors";

interface AppRouterProps {
  session: AdminSession;
  onLogout: () => void;
}

export function AppRouter({ session, onLogout }: AppRouterProps) {
  const { page, navigate } = useHashNavigation();

  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const [loadingMetrics, setLoadingMetrics] = useState(true);

  const [error, setError] = useState("");

  const refreshMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    setError("");

    try {
      const response = await getAdminOverview();

      setMetrics(response.metrics);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load dashboard"));
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    void refreshMetrics();
  }, [refreshMetrics]);

  return (
    <AdminLayout
      session={session}
      page={page}
      metrics={metrics}
      onNavigate={navigate}
      onLogout={onLogout}
    >
      {error ? <Notice tone="error" message={error} /> : null}

      {page === "overview" ? (
        <DashboardPage
          metrics={metrics}
          loading={loadingMetrics}
          onNavigate={navigate}
          onRefresh={refreshMetrics}
        />
      ) : null}

      {page === "liveMonitor" ? <LiveMonitorMap /> : null}

      {page === "drivers" ? (
        <DriversPage onDataChanged={() => void refreshMetrics()} />
      ) : null}

      {page === "busRequests" ? <BusRequestsPage /> : null}

      {page === "buses" ? <BusesPage /> : null}

      {page === "routes" ? <RoutesPage /> : null}

      {page === "schedules" ? <SchedulesPage /> : null}

      {page === "trips" ? <TripsPage /> : null}

      {page === "issues" ? <IssuesPage /> : null}
    </AdminLayout>
  );
}
