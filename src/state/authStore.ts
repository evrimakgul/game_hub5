import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";

export type AuthStatus = "idle" | "loading" | "ready" | "error";

type AuthStore = {
  configured: boolean;
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  errorMessage: string | null;
  setConfigured: (configured: boolean) => void;
  setLoading: () => void;
  setSession: (session: Session | null) => void;
  setError: (message: string) => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  configured: false,
  status: "idle",
  session: null,
  user: null,
  errorMessage: null,
  setConfigured: (configured) => set({ configured }),
  setLoading: () => set({ status: "loading", errorMessage: null }),
  setSession: (session) =>
    set({
      status: "ready",
      session,
      user: session?.user ?? null,
      errorMessage: null,
    }),
  setError: (errorMessage) =>
    set({
      status: "error",
      errorMessage,
      session: null,
      user: null,
    }),
}));
