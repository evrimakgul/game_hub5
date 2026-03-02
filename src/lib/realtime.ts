import { getSupabaseBrowserClient } from "./supabase";

function subscribeToTables(
  channelName: string,
  tables: string[],
  onChange: () => void
): () => void {
  const client = getSupabaseBrowserClient();
  const channel = client.channel(channelName);

  for (const table of tables) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
      },
      () => {
        onChange();
      }
    );
  }

  channel.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToPlayerSheetState(profileId: string, onChange: () => void): () => void {
  return subscribeToTables(
    `player-sheet-${profileId}`,
    [
      "characters",
      "character_core_stats",
      "character_skill_levels",
      "character_known_powers",
      "inventory_items",
      "character_status_effects",
      "combat_participants",
      "combat_tracker",
    ],
    onChange
  );
}

export function subscribeToDmDashboardState(onChange: () => void): () => void {
  return subscribeToTables(
    "dm-dashboard",
    [
      "characters",
      "combat_encounters",
      "combat_participants",
      "combat_tracker",
      "combat_logs",
      "character_status_effects",
      "inventory_items",
    ],
    onChange
  );
}
