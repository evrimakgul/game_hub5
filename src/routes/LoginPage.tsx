import { useState } from "react";
import { Link } from "react-router-dom";

import { getSupabaseBrowserClient } from "../lib/supabase";
import { useAuthStore } from "../state/authStore";

export function LoginPage() {
  const configured = useAuthStore((state) => state.configured);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const errorMessage = useAuthStore((state) => state.errorMessage);

  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleMagicLinkSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configured) {
      setFeedback("Supabase environment variables are missing. Add them before testing auth.");
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const client = getSupabaseBrowserClient();
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        throw error;
      }

      setFeedback(`Magic link sent to ${email}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to start sign-in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    if (!configured) {
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const client = getSupabaseBrowserClient();
      const { error } = await client.auth.signOut();

      if (error) {
        throw error;
      }

      setFeedback("Signed out.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="auth-card">
        <div className="hero-topline">
          <p className="eyebrow">Convergence Access</p>
          <span className={`status-pill ${configured ? "ok" : "warn"}`}>
            {configured ? "Supabase Auth Ready" : "Auth Env Missing"}
          </span>
        </div>

        <h1>Login</h1>
        <p className="hero-copy">
          This screen uses Supabase magic-link auth. It is wired for real sessions, but it degrades
          safely when the environment variables are not configured yet.
        </p>

        <nav className="route-nav" aria-label="Primary routes">
          <Link to="/">Player Route</Link>
          <Link to="/dm">DM Route</Link>
        </nav>

        <section className="auth-panel">
          <div className="auth-status">
            <p className="panel-label">Session Status</p>
            <h2>{user?.email ?? "Not signed in"}</h2>
            <p className="auth-note">
              {status === "loading"
                ? "Checking the current browser session."
                : status === "error"
                  ? errorMessage ?? "Authentication failed."
                  : user
                    ? "The browser holds an active Supabase session."
                    : "Use a magic link to sign in on this browser."}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleMagicLinkSubmit}>
            <label className="auth-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="auth-input"
              type="email"
              value={email}
              autoComplete="email"
              placeholder="player@example.com"
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting || !configured}
              required
            />

            <div className="auth-actions">
              <button type="submit" disabled={submitting || !configured}>
                {submitting ? "Working..." : "Send Magic Link"}
              </button>
              <button type="button" className="ghost-button" onClick={handleSignOut} disabled={submitting || !user}>
                Sign Out
              </button>
            </div>
          </form>

          {(feedback || errorMessage) && <p className="auth-feedback">{feedback ?? errorMessage}</p>}
        </section>
      </section>
    </main>
  );
}
