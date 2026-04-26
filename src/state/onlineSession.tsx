import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";

import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient.ts";
import type { OnlineProfile } from "../types/realtimeSession.ts";

type OnlineAuthStatus = "unconfigured" | "loading" | "anonymous" | "authenticated";

type OnlineSessionContextValue = {
  isConfigured: boolean;
  status: OnlineAuthStatus;
  user: User | null;
  profile: OnlineProfile | null;
  authError: string | null;
  signUpWithPassword: (args: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<string | null>;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signInWithDiscord: () => Promise<string | null>;
  signOut: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
};

const OnlineSessionContext = createContext<OnlineSessionContextValue | null>(null);

function mapProfileRow(row: {
  id?: string | null;
  user_id?: string | null;
  display_name: string | null;
  created_at?: string | null;
}, fallbackId: string): OnlineProfile {
  const id = row.id ?? row.user_id ?? fallbackId;

  return {
    id,
    displayName: row.display_name?.trim() || id,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function createFallbackProfile(user: User): OnlineProfile {
  return {
    id: user.id,
    displayName: getUserDisplayName(user),
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}

function getUserDisplayName(user: User | null, fallback = "Player"): string {
  if (!user) {
    return fallback;
  }

  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  return metadataName.trim() || user.email?.trim() || fallback;
}

export function OnlineSessionProvider({ children }: PropsWithChildren) {
  const client = useMemo(() => getSupabaseClient(), []);
  const [status, setStatus] = useState<OnlineAuthStatus>(
    isSupabaseConfigured ? "loading" : "unconfigured"
  );
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<OnlineProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  async function refreshProfileForUser(nextUser: User | null): Promise<void> {
    if (!client || !nextUser) {
      setProfile(null);
      return;
    }

    setAuthError(null);

    const { data: existingProfile, error: readError } = await client
      .from("profiles")
      .select("id, display_name, created_at")
      .eq("id", nextUser.id)
      .maybeSingle();

    if (!readError && existingProfile) {
      setProfile(mapProfileRow(existingProfile, nextUser.id));
      return;
    }

    if (readError) {
      const { data: legacyProfile, error: legacyReadError } = await client
        .from("profiles")
        .select("user_id, display_name, created_at")
        .eq("user_id", nextUser.id)
        .maybeSingle();

      if (!legacyReadError && legacyProfile) {
        setProfile(mapProfileRow(legacyProfile, nextUser.id));
        return;
      }
    }

    const displayName = getUserDisplayName(nextUser);
    const { data: insertedProfile, error: insertError } = await client
      .from("profiles")
      .insert({
        id: nextUser.id,
        display_name: displayName,
      })
      .select("id, display_name, created_at")
      .single();

    if (!insertError && insertedProfile) {
      setProfile(mapProfileRow(insertedProfile, nextUser.id));
      return;
    }

    const { data: insertedLegacyProfile, error: legacyInsertError } = await client
      .from("profiles")
      .insert({
        user_id: nextUser.id,
        display_name: displayName,
      })
      .select("user_id, display_name, created_at")
      .single();

    if (!legacyInsertError && insertedLegacyProfile) {
      setProfile(mapProfileRow(insertedLegacyProfile, nextUser.id));
      return;
    }

    setProfile(createFallbackProfile(nextUser));
  }

  useEffect(() => {
    if (!client) {
      return;
    }

    let isMounted = true;

    client.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "anonymous");
      void refreshProfileForUser(nextUser);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "anonymous");
      void refreshProfileForUser(nextUser);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [client]);

  async function signUpWithPassword(args: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<string | null> {
    if (!client) {
      return "Supabase is not configured.";
    }

    setAuthError(null);
    const { data, error } = await client.auth.signUp({
      email: args.email.trim(),
      password: args.password,
      options: {
        data: {
          full_name: args.displayName.trim(),
        },
      },
    });

    if (error) {
      setAuthError(error.message);
      return error.message;
    }

    await refreshProfileForUser(data.user);
    return null;
  }

  async function signInWithPassword(email: string, password: string): Promise<string | null> {
    if (!client) {
      return "Supabase is not configured.";
    }

    setAuthError(null);
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError(error.message);
      return error.message;
    }

    return null;
  }

  async function signInWithDiscord(): Promise<string | null> {
    if (!client) {
      return "Supabase is not configured.";
    }

    setAuthError(null);
    const { error } = await client.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthError(error.message);
      return error.message;
    }

    return null;
  }

  async function signOut(): Promise<string | null> {
    if (!client) {
      return "Supabase is not configured.";
    }

    setAuthError(null);
    const { error } = await client.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return error.message;
    }

    setUser(null);
    setProfile(null);
    setStatus("anonymous");
    return null;
  }

  async function refreshProfile(): Promise<void> {
    await refreshProfileForUser(user);
  }

  const value = useMemo<OnlineSessionContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      status,
      user,
      profile,
      authError,
      signUpWithPassword,
      signInWithPassword,
      signInWithDiscord,
      signOut,
      refreshProfile,
    }),
    [authError, profile, status, user]
  );

  return (
    <OnlineSessionContext.Provider value={value}>
      {children}
    </OnlineSessionContext.Provider>
  );
}

export function useOnlineSession(): OnlineSessionContextValue {
  const value = useContext(OnlineSessionContext);
  if (!value) {
    throw new Error("useOnlineSession must be used within OnlineSessionProvider.");
  }

  return value;
}
