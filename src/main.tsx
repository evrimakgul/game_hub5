import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./app.css";
import { isSupabaseConfigured } from "./lib/env";
import { getSupabaseBrowserClient } from "./lib/supabase";
import { useAuthStore } from "./state/authStore";

function AuthBootstrap() {
  const setConfigured = useAuthStore((state) => state.setConfigured);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setSession = useAuthStore((state) => state.setSession);
  const setError = useAuthStore((state) => state.setError);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setConfigured(false);
      setSession(null);
      return;
    }

    const client = getSupabaseBrowserClient();
    setConfigured(true);
    setLoading();

    let cancelled = false;

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }

        if (error) {
          setError(error.message);
          return;
        }

        setSession(data.session ?? null);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setError(error instanceof Error ? error.message : "Unable to read auth session.");
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setSession(session);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setConfigured, setError, setLoading, setSession]);

  return null;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthBootstrap />
      <App />
    </BrowserRouter>
  </StrictMode>
);
