import { useEffect, useState } from "react";

import { AdminLoginPage } from "./features/auth/AdminLoginPage";
import { AppRouter } from "./routes/AppRouter";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import {
  clearAdminSession,
  getAdminSession,
} from "./storage/adminSessionStorage";
import type { AdminSession } from "./types";

export default function App() {
  const [session, setSession] = useState<AdminSession | null>(getAdminSession);

  const logout = () => {
    clearAdminSession();
    setSession(null);
  };

  useEffect(() => {
    window.addEventListener("admin:unauthorized", logout);

    return () => {
      window.removeEventListener("admin:unauthorized", logout);
    };
  }, []);

  return (
    <ProtectedRoute
      session={session}
      loginPage={<AdminLoginPage onLogin={setSession} />}
    >
      {session ? <AppRouter session={session} onLogout={logout} /> : null}
    </ProtectedRoute>
  );
}
