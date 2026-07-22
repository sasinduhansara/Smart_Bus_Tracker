import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, BusFront, ShieldCheck } from "lucide-react";

import { loginAdmin } from "../../api/authApi";
import type { AdminSession } from "../../types";
import { getErrorMessage } from "../../utils/errors";

interface AdminLoginPageProps {
  onLogin: (session: AdminSession) => void;
}

export function AdminLoginPage({ onLogin }: AdminLoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      onLogin(await loginAdmin(email.trim().toLowerCase(), password));
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Could not sign in"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark">
          <BusFront size={25} strokeWidth={2.5} />
        </div>

        <p className="eyebrow">BUS TRACK LK</p>
        <h1>Operations, in one clear view.</h1>
        <p className="muted">
          Sign in to manage drivers, live buses and service quality.
        </p>

        <form onSubmit={submit} className="login-form">
          <label>
            Admin email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@bustrack.lk"
              disabled={busy}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              disabled={busy}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="primary-button full" disabled={busy}>
            {busy ? "Signing in..." : "Sign in to console"}
            <ArrowUpRight size={17} />
          </button>
        </form>

        <p className="login-foot">
          <ShieldCheck size={15} /> Protected by the Smart Bus API
        </p>
      </section>
    </main>
  );
}
