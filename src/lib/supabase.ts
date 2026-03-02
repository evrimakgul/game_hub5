import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseEnv } from "./env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const env = requireSupabaseEnv();
  browserClient = createClient(env.url, env.anonKey);
  return browserClient;
}
