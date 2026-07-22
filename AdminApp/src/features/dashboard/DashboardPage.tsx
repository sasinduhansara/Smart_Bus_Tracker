import {
  Activity,
  AlertTriangle,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  RefreshCw,
  Users,
  Zap,
} from 'lucide-react';

import { LoadingState } from '../../components/common/LoadingState';
import { MetricCard } from './MetricCard';
import type { Metrics, Page } from '../../types';

interface DashboardPageProps {
  metrics: Metrics | null;
  loading: boolean;
  onNavigate: (page: Page) => void;
  onRefresh: () => void;
}

export function DashboardPage({
  metrics,
  loading,
  onNavigate,
  onRefresh,
}: DashboardPageProps) {
  if (!metrics) {
    return <LoadingState label="Loading dashboard data..." />;
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMAND CENTRE</p>
          <h1>Good day, admin.</h1>
          <p className="muted">
            Current operational status across the transport network.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh data
        </button>
      </div>

      <div className="metrics-grid">
        <MetricCard
          icon={Users}
          label="Total drivers"
          value={metrics.drivers}
          hint={`${metrics.approvedDrivers} approved`}
          tone="blue"
        />
        <MetricCard
          icon={FileCheck2}
          label="Awaiting review"
          value={metrics.pendingDrivers}
          hint="Needs administrator attention"
          tone="amber"
        />
        <MetricCard
          icon={Zap}
          label="Buses on the road"
          value={metrics.activeBuses}
          hint={`${metrics.buses} tracked fleet records`}
          tone="green"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Open issues"
          value={metrics.openIssues}
          hint="Service desk queue"
          tone="red"
        />
      </div>

      <section className="content-grid overview-grid">
        <article className="panel welcome-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">LIVE PULSE</p>
              <h2>Network health</h2>
            </div>
            <span className="live-dot">
              <i /> Live
            </span>
          </div>

          <div className="pulse-stat">
            <div className="pulse-ring">
              <Activity size={25} />
            </div>
            <div>
              <strong>{metrics.activeTrips}</strong>
              <p>active trips transmitting</p>
            </div>
          </div>

          <div className="health-row">
            <span>
              <i className="legend green" /> Active buses
            </span>
            <strong>{metrics.activeBuses}</strong>
          </div>
          <div className="health-row">
            <span>
              <i className="legend amber" /> Paused buses
            </span>
            <strong>{metrics.pausedBuses}</strong>
          </div>

          <button
            type="button"
            className="text-button"
            onClick={() => onNavigate('buses')}
          >
            Open fleet monitor <ChevronRight size={15} />
          </button>
        </article>

        <article className="panel action-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">QUICK ACTIONS</p>
              <h2>Priority queues</h2>
            </div>
          </div>

          <button
            type="button"
            className="action-row"
            onClick={() => onNavigate('drivers')}
          >
            <span className="action-icon amber-bg">
              <FileCheck2 size={19} />
            </span>
            <span>
              <strong>Review driver applications</strong>
              <small>
                {metrics.pendingDrivers
                  ? `${metrics.pendingDrivers} applications waiting`
                  : 'No pending applications'}
              </small>
            </span>
            <ChevronRight size={17} />
          </button>

          <button
            type="button"
            className="action-row"
            onClick={() => onNavigate('issues')}
          >
            <span className="action-icon red-bg">
              <CircleHelp size={19} />
            </span>
            <span>
              <strong>Resolve reported issues</strong>
              <small>
                {metrics.openIssues
                  ? `${metrics.openIssues} issues in queue`
                  : 'No open issues'}
              </small>
            </span>
            <ChevronRight size={17} />
          </button>
        </article>
      </section>
    </>
  );
}
