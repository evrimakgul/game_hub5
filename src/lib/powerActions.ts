import type { PowerId } from "../types";
import { getSupabaseBrowserClient } from "./supabase";

export type CastKnownPowerResult = {
  power_id: PowerId;
  power_level: number;
  mana_spent: number;
  current_mana: number;
  character_status_effect_id: string;
  status_effect_id: string;
  status_label: string;
  consumed_from: string | null;
  encounter_id: string | null;
  encounter_revision: number | null;
  available_standard: number | null;
  available_bonus: number | null;
  available_move: number | null;
  available_reaction: number | null;
};

export async function castKnownPower(
  characterId: string,
  powerId: PowerId,
  encounterId: string | null,
  expectedRevision: number | null
): Promise<CastKnownPowerResult> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.rpc("cast_known_power", {
    target_character_id: characterId,
    target_power_id: powerId,
    target_encounter_id: encounterId,
    expected_revision: expectedRevision,
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    throw new Error("No power cast result was returned.");
  }

  return result as CastKnownPowerResult;
}
