import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminSettings from "./pages/AdminSettings";
import BusManagement from "./pages/BusManagement";
import BusRegistration from "./pages/BusRegistration";
import Dashboard from "./pages/Dashboard";
import DriverManagement from "./pages/DriverManagement";
import LiveTracking from "./pages/LiveTracking";
import Login from "./pages/Login";
import ReportsAnalytics from "./pages/ReportsAnalytics";
import RouteManagement from "./pages/RouteManagement";
import SystemAlerts from "./pages/SystemAlerts";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/bus-management" element={<BusManagement />} />
        <Route path="/bus-registration" element={<BusRegistration />} />
        <Route path="/driver-management" element={<DriverManagement />} />
        <Route path="/live-tracking" element={<LiveTracking />} />
        <Route path="/route-management" element={<RouteManagement />} />
        <Route path="/alerts" element={<SystemAlerts />} />
        <Route path="/reports" element={<ReportsAnalytics />} />
        <Route path="/settings" element={<AdminSettings />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
