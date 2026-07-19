import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, BusFront, Check, ChevronRight,
  CircleHelp, Clock3, FileCheck2, LayoutDashboard, LogOut, Map, Menu,
  ExternalLink, RefreshCw, Search, ShieldCheck, Users, X, Zap,
} from "lucide-react";
import { ApiError, api, clearSession, getSession, login } from "./api";
import type { AdminSession, Bus, Driver, Issue, Metrics, Page, RouteSummary, Trip } from "./types";

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "drivers", label: "Driver approvals", icon: Users },
  { id: "buses", label: "Live fleet", icon: BusFront },
  { id: "trips", label: "Trip activity", icon: Activity },
  { id: "issues", label: "Issue reports", icon: AlertTriangle },
  { id: "routes", label: "Routes & stops", icon: Map },
];

function pageFromHash(): Page {
  const value = window.location.hash.replace("#", "") as Page;
  return navItems.some((item) => item.id === value) ? value : "overview";
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill ${value.toLowerCase().replace(/\s/g, "-")}`}>{value.replace("_", " ")}</span>;
}

function LoginScreen({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try { onLogin(await login(email, password)); } catch (err) { setError(err instanceof Error ? err.message : "Could not sign in"); } finally { setBusy(false); }
  }
  return <main className="login-page">
    <section className="login-card">
      <div className="brand-mark"><BusFront size={25} strokeWidth={2.5} /></div>
      <p className="eyebrow">BUS TRACK LK</p>
      <h1>Operations, in one clear view.</h1>
      <p className="muted">Sign in to manage drivers, live buses and service quality.</p>
      <form onSubmit={submit} className="login-form">
        <label>Admin email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@bustrack.lk" /></label>
        <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full" disabled={busy}>{busy ? "Signing in…" : "Sign in to console"}<ArrowUpRight size={17} /></button>
      </form>
      <p className="login-foot"><ShieldCheck size={15} /> Protected by the Smart Bus API</p>
    </section>
  </main>;
}

function MetricCard({ icon: Icon, label, value, hint, tone }: { icon: typeof Users; label: string; value: number; hint: string; tone: string }) {
  return <article className={`metric-card ${tone}`}><div className="metric-icon"><Icon size={19} /></div><div><p>{label}</p><strong>{value}</strong><span>{hint}</span></div></article>;
}

function Overview({ metrics, onNavigate, onRefresh, loading }: { metrics: Metrics | null; onNavigate: (page: Page) => void; onRefresh: () => void; loading: boolean }) {
  if (!metrics) return <Loading />;
  return <>
    <div className="page-heading"><div><p className="eyebrow">COMMAND CENTRE</p><h1>Good day, admin.</h1><p className="muted">Here’s what’s happening across your network right now.</p></div><button className="secondary-button" onClick={onRefresh} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh data</button></div>
    <div className="metrics-grid">
      <MetricCard icon={Users} label="Total drivers" value={metrics.drivers} hint={`${metrics.approvedDrivers} approved`} tone="blue" />
      <MetricCard icon={FileCheck2} label="Awaiting review" value={metrics.pendingDrivers} hint="Needs your attention" tone="amber" />
      <MetricCard icon={Zap} label="Buses on the road" value={metrics.activeBuses} hint={`${metrics.buses} registered fleet`} tone="green" />
      <MetricCard icon={AlertTriangle} label="Open issues" value={metrics.openIssues} hint="Service desk queue" tone="red" />
    </div>
    <section className="content-grid overview-grid">
      <article className="panel welcome-panel"><div className="panel-heading"><div><p className="eyebrow">LIVE PULSE</p><h2>Network health</h2></div><span className="live-dot"><i /> Live</span></div><div className="pulse-stat"><div className="pulse-ring"><Activity size={25} /></div><div><strong>{metrics.activeTrips}</strong><p>active trips transmitting</p></div></div><div className="health-row"><span><i className="legend green" /> Active buses</span><strong>{metrics.activeBuses}</strong></div><div className="health-row"><span><i className="legend amber" /> Paused buses</span><strong>{metrics.pausedBuses}</strong></div><button className="text-button" onClick={() => onNavigate("buses")}>Open fleet monitor <ChevronRight size={15} /></button></article>
      <article className="panel action-panel"><div className="panel-heading"><div><p className="eyebrow">QUICK ACTIONS</p><h2>Keep things moving</h2></div></div><button className="action-row" onClick={() => onNavigate("drivers")}><span className="action-icon amber-bg"><FileCheck2 size={19} /></span><span><strong>Review driver applications</strong><small>{metrics.pendingDrivers ? `${metrics.pendingDrivers} applications waiting` : "You’re all caught up"}</small></span><ChevronRight size={17} /></button><button className="action-row" onClick={() => onNavigate("issues")}><span className="action-icon red-bg"><CircleHelp size={19} /></span><span><strong>Resolve reported issues</strong><small>{metrics.openIssues ? `${metrics.openIssues} issues in queue` : "No open issues"}</small></span><ChevronRight size={17} /></button></article>
    </section>
  </>;
}

function Loading() { return <div className="loading"><RefreshCw size={19} className="spin" /> Loading live data…</div>; }

function DriversPage({ onDataChanged }: { onDataChanged: () => void }) {
  const [drivers, setDrivers] = useState<Driver[]>([]); const [filter, setFilter] = useState("pending"); const [query, setQuery] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [busyId, setBusyId] = useState(""); const [notice, setNotice] = useState(""); const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  async function load() { setLoading(true); setError(""); try { setDrivers(await api.drivers(filter)); } catch (e) { setError(e instanceof Error ? e.message : "Could not load drivers"); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, [filter]);
  const visible = useMemo(() => drivers.filter((driver) => `${driver.fullName} ${driver.email} ${driver.vehicleRegistrationNumber}`.toLowerCase().includes(query.toLowerCase())), [drivers, query]);
  async function action(driver: Driver, type: "approve" | "reject" | "block") { const reason = type === "approve" ? "" : window.prompt(`${type === "block" ? "Block" : "Reject"} reason (optional)`, ""); if (reason === null) return; setBusyId(driver._id); setNotice(""); try { if (type === "approve") await api.approveDriver(driver._id); else if (type === "reject") await api.rejectDriver(driver._id, reason); else await api.blockDriver(driver._id, reason); setNotice(`${driver.fullName} is now ${type === "approve" ? "approved" : `${type}ed`}.`); await load(); onDataChanged(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); } finally { setBusyId(""); } }
  return <><PageTitle eyebrow="PEOPLE & TRUST" title="Driver approvals" subtitle="Review KYC submissions and keep trusted operators on the network." onRefresh={load} loading={loading} /><div className="toolbar"><div className="tabs">{["pending", "approved", "blocked", "rejected", ""].map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value || "All drivers"}</button>)}</div><label className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or bus" /></label></div>{notice && <div className="notice success"><Check size={17} />{notice}</div>}{error && <div className="notice error"><AlertTriangle size={17} />{error}</div>}<section className="panel table-panel">{loading ? <Loading /> : visible.length === 0 ? <Empty icon={Users} title="No drivers here" detail="Try another status or search term." /> : <div className="table-scroll"><table><thead><tr><th>Driver</th><th>Assignment</th><th>KYC</th><th>Joined</th><th>Action</th></tr></thead><tbody>{visible.map((driver) => <tr key={driver._id}><td><button className="person person-link" onClick={() => setSelectedDriver(driver)}><span className="avatar">{initials(driver.fullName)}</span><span><strong>{driver.fullName || "Unnamed driver"}</strong><small>{driver.email || driver.mobile || "No contact"}</small></span></button></td><td><strong>{driver.vehicleRegistrationNumber || "Unassigned"}</strong><small>Route {driver.busRouteNumber || "—"}</small></td><td><StatusPill value={driver.verificationStatus || "pending"} /><small className="sub-status">{driver.kycStatus?.replace("_", " ")}</small></td><td>{formatDate(driver.createdAt)}</td><td><div className="row-actions"><button className="mini-button" onClick={() => setSelectedDriver(driver)}>Review</button>{driver.verificationStatus === "pending" && <button className="mini-button approve" disabled={busyId === driver._id} onClick={() => void action(driver, "approve")}><Check size={14} /> Approve</button>}{driver.verificationStatus !== "blocked" && driver.verificationStatus !== "approved" && <button className="icon-button" title="Reject" disabled={busyId === driver._id} onClick={() => void action(driver, "reject")}><X size={16} /></button>}{driver.verificationStatus !== "blocked" && <button className="icon-button danger" title="Block" disabled={busyId === driver._id} onClick={() => void action(driver, "block")}><ShieldCheck size={16} /></button>}</div></td></tr>)}</tbody></table></div>}</section>{selectedDriver && <div className="modal-backdrop" onClick={() => setSelectedDriver(null)}><section className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">KYC REVIEW</p><h2>{selectedDriver.fullName || "Unnamed driver"}</h2><p className="muted">{selectedDriver.email || selectedDriver.mobile || "No contact"}</p></div><button className="icon-button" onClick={() => setSelectedDriver(null)}><X size={18} /></button></div><div className="detail-grid"><span><small>NIC</small><strong>{selectedDriver.nic || "—"}</strong></span><span><small>Route</small><strong>{selectedDriver.busRouteNumber || "—"}</strong></span><span><small>Vehicle</small><strong>{selectedDriver.vehicleRegistrationNumber || "—"}</strong></span><span><small>Status</small><StatusPill value={selectedDriver.verificationStatus || "pending"} /></span></div><h3 className="document-title">Submitted documents</h3><div className="document-grid">{Object.entries(selectedDriver.documents || {}).map(([type, document]) => <a className="document-link" href={document.url || "#"} target="_blank" rel="noreferrer" key={type}><FileCheck2 size={17} /><span><strong>{type.replace(/([A-Z])/g, " $1")}</strong><small>{document.fileName || "Open document"}</small></span><ExternalLink size={14} /></a>)}</div>{selectedDriver.verificationStatus === "pending" && <div className="modal-actions"><button className="secondary-button" onClick={() => setSelectedDriver(null)}>Close</button><button className="primary-button" disabled={busyId === selectedDriver._id} onClick={() => void action(selectedDriver, "approve").then(() => setSelectedDriver(null))}><Check size={16} /> Approve driver</button></div>}</section></div>}</>;
}

function BusesPage() { const [buses, setBuses] = useState<Bus[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); async function load() { setLoading(true); try { setBuses((await api.buses()).buses); } catch (e) { setError(e instanceof Error ? e.message : "Could not load buses"); } finally { setLoading(false); } } useEffect(() => { void load(); }, []); return <><PageTitle eyebrow="OPERATIONS" title="Live fleet" subtitle="See every tracked bus and its latest operational heartbeat." onRefresh={load} loading={loading} />{error && <div className="notice error">{error}</div>}<section className="fleet-grid">{loading ? <Loading /> : buses.length === 0 ? <Empty icon={BusFront} title="No bus telemetry yet" detail="Buses appear here after a driver starts a trip." /> : buses.map((bus) => <article className="bus-card" key={bus.id || bus.busId}><div className="bus-card-top"><span className="bus-number">{bus.busId || "—"}</span><StatusPill value={bus.operationalStatus} /></div><h3>Route {bus.routeNumber || "Unassigned"}</h3><p className="muted">{bus.lat && bus.lng ? `${bus.lat.toFixed(4)}, ${bus.lng.toFixed(4)}` : "Location waiting for GPS"}</p><div className="bus-meta"><span><Clock3 size={14} /> {formatDate(bus.statusUpdatedAt)}</span>{bus.speed !== undefined && <span><Activity size={14} /> {Math.round(bus.speed)} km/h</span>}</div></article>)}</section></>; }

function TripsPage() { const [trips, setTrips] = useState<Trip[]>([]); const [filter, setFilter] = useState(""); const [loading, setLoading] = useState(true); async function load() { setLoading(true); try { setTrips((await api.trips(filter)).trips); } finally { setLoading(false); } } useEffect(() => { void load(); }, [filter]); return <><PageTitle eyebrow="SERVICE HISTORY" title="Trip activity" subtitle="Monitor active journeys and review completed service runs." onRefresh={load} loading={loading} /><div className="toolbar"><div className="tabs">{[["", "All trips"], ["active", "Active"], ["paused", "Paused"], ["completed", "Completed"]].map(([value, label]) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div></div><section className="panel table-panel">{loading ? <Loading /> : trips.length === 0 ? <Empty icon={Activity} title="No trip activity" detail="Trip history will appear when drivers operate a bus." /> : <div className="table-scroll"><table><thead><tr><th>Route</th><th>Bus</th><th>Journey</th><th>Status</th><th>Started</th><th>Distance</th></tr></thead><tbody>{trips.map((trip) => <tr key={trip.id}><td><strong>Route {trip.routeNumber || "—"}</strong><small>{trip.routeName}</small></td><td>{trip.busId || "—"}</td><td>{trip.origin || "—"} <ChevronRight size={13} /> {trip.destination || "—"}</td><td><StatusPill value={trip.status} /></td><td>{formatDate(trip.startedAt)}</td><td>{trip.distanceKm.toFixed(1)} km</td></tr>)}</tbody></table></div>}</section></>; }

function IssuesPage() { const [issues, setIssues] = useState<Issue[]>([]); const [filter, setFilter] = useState("open"); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState(""); async function load() { setLoading(true); try { setIssues((await api.issues(filter)).issues); } finally { setLoading(false); } } useEffect(() => { void load(); }, [filter]); async function update(issue: Issue) { const next = issue.status === "open" ? "in_review" : "resolved"; const note = window.prompt("Resolution note (optional)", issue.resolutionNote) ?? issue.resolutionNote; await api.updateIssue(issue.id, next, note); setNotice(`Issue marked ${next.replace("_", " ")}.`); await load(); } return <><PageTitle eyebrow="SERVICE DESK" title="Issue reports" subtitle="Respond to incidents raised from the driver app before they affect riders." onRefresh={load} loading={loading} />{notice && <div className="notice success"><Check size={17} />{notice}</div>}<div className="toolbar"><div className="tabs">{[["open", "Open"], ["in_review", "In review"], ["resolved", "Resolved"], ["", "All"]].map(([value, label]) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div></div><section className="issue-list">{loading ? <Loading /> : issues.length === 0 ? <Empty icon={AlertTriangle} title="No reports in this view" detail="That’s a good sign for the network." /> : issues.map((issue) => <article className="panel issue-card" key={issue.id}><div className="issue-icon"><AlertTriangle size={18} /></div><div className="issue-content"><div className="issue-title"><div><StatusPill value={issue.severity} /><h3>{issue.category.replace(/_/g, " ")}</h3></div><StatusPill value={issue.status} /></div><p>{issue.message || "No description provided."}</p><div className="issue-meta"><span>{issue.driverName || "Unknown driver"}</span><span>Bus {issue.busId || "—"}</span><span>Route {issue.routeNumber || "—"}</span><span>{formatDate(issue.createdAt)}</span></div></div>{issue.status !== "resolved" && issue.status !== "dismissed" && <button className="secondary-button" onClick={() => void update(issue)}>{issue.status === "open" ? "Review" : "Resolve"}</button>}</article>)}</section></>; }

function RoutesPage() { const [routes, setRoutes] = useState<RouteSummary[]>([]); const [loading, setLoading] = useState(true); async function load() { setLoading(true); try { setRoutes((await api.routes()).routes); } finally { setLoading(false); } } useEffect(() => { void load(); }, []); return <><PageTitle eyebrow="NETWORK DESIGN" title="Routes & stops" subtitle="Your canonical route data, shared with both mobile apps." onRefresh={load} loading={loading} /><section className="route-grid">{loading ? <Loading /> : routes.length === 0 ? <Empty icon={Map} title="No routes configured" detail="Add route documents to the shared MongoDB routes collection." /> : routes.map((route) => <article className="panel route-card" key={`${route.routeNumber}-${route.direction}`}><div className="route-badge">{route.routeNumber}</div><div><h3>{route.name}</h3><p className="muted">{route.direction} direction</p></div><div className="stop-count"><strong>{route.stopCount}</strong><span>stops</span></div><ChevronRight size={17} /></article>)}</section></>; }

function PageTitle({ eyebrow, title, subtitle, onRefresh, loading }: { eyebrow: string; title: string; subtitle: string; onRefresh: () => void; loading: boolean }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{subtitle}</p></div><button className="secondary-button" onClick={onRefresh} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh</button></div>; }
function Empty({ icon: Icon, title, detail }: { icon: typeof Users; title: string; detail: string }) { return <div className="empty"><Icon size={27} /><strong>{title}</strong><span>{detail}</span></div>; }

function AppShell({ session, onLogout }: { session: AdminSession; onLogout: () => void }) {
  const [page, setPage] = useState<Page>(pageFromHash); const [mobileNav, setMobileNav] = useState(false); const [metrics, setMetrics] = useState<Metrics | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  function navigate(next: Page) { setPage(next); window.location.hash = next; setMobileNav(false); }
  async function refreshOverview() { setLoading(true); setError(""); try { setMetrics((await api.overview()).metrics); } catch (e) { if (e instanceof ApiError && e.status === 401) onLogout(); else setError(e instanceof Error ? e.message : "Could not load dashboard"); } finally { setLoading(false); } }
  useEffect(() => { void refreshOverview(); const onHash = () => setPage(pageFromHash()); window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash); }, []);
  const activeItem = navItems.find((item) => item.id === page) || navItems[0];
  return <div className="app-shell"><aside className={`sidebar ${mobileNav ? "open" : ""}`}><div className="side-brand"><span className="brand-mark small"><BusFront size={19} /></span><span><strong>BusTrack <em>LK</em></strong><small>Admin console</small></span></div><nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? "selected" : ""} onClick={() => navigate(id)}><Icon size={18} />{label}{id === "drivers" && metrics?.pendingDrivers ? <b>{metrics.pendingDrivers}</b> : null}</button>)}</nav><div className="sidebar-bottom"><div className="admin-profile"><span className="avatar">{initials(session.admin.email)}</span><span><strong>Administrator</strong><small>{session.admin.email}</small></span></div><button className="logout-button" onClick={onLogout}><LogOut size={16} /> Sign out</button></div></aside><div className="main-area"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)}><Menu size={21} /></button><div><p className="topbar-kicker">{activeItem.label}</p><span className="topbar-status"><i /> API connected</span></div><div className="topbar-right"><span className="date-label">{new Date().toLocaleDateString("en-LK", { weekday: "short", day: "numeric", month: "short" })}</span><span className="top-avatar">{initials(session.admin.email)}</span></div></header><main className="page-content">{error && <div className="notice error"><AlertTriangle size={17} />{error}</div>}{page === "overview" && <Overview metrics={metrics} onNavigate={navigate} onRefresh={refreshOverview} loading={loading} />}{page === "drivers" && <DriversPage onDataChanged={refreshOverview} />}{page === "buses" && <BusesPage />}{page === "trips" && <TripsPage />}{page === "issues" && <IssuesPage />}{page === "routes" && <RoutesPage />}</main></div></div>;
}

export default function App() { const [session, setSession] = useState<AdminSession | null>(getSession); function logout() { clearSession(); setSession(null); } return session ? <AppShell session={session} onLogout={logout} /> : <LoginScreen onLogin={setSession} />; }
