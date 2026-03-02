import { getSupabaseBrowserClient } from "./supabase";

export type AdvanceCombatTurnResult = {
  encounter_id: string;
  round_number: number;
  active_participant_id: string | null;
  active_index: number | null;
  revision: number;
  available_standard: number;
  available_bonus: number;
  available_move: number;
  available_reaction: number;
};

export async function advanceCombatTurn(
  encounterId: string,
  expectedRevision: number
): Promise<AdvanceCombatTurnResult> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.rpc("advance_combat_turn", {
    target_encounter_id: encounterId,
    expected_revision: expectedRevision,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No turn-advance result was returned.");
  }

  return data as AdvanceCombatTurnResult;
}
