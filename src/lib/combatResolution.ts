import {
  type CombatResolutionMode,
  resolveCombatWorkflow,
} from "../config/combatWorkflow";
import { getSupabaseBrowserClient } from "./supabase";

export type ResolveAndLogCombatInput = {
  encounterId: string;
  attackerParticipantId: string | null;
  attackerName: string;
  attackerIsPlayer: boolean;
  defenderParticipantId: string | null;
  defenderName: string;
  defenderIsPlayer: boolean;
  attackSuccesses: number;
  targetArmorClass: number;
  damageInput: number;
  mitigation: number;
  damageMode: CombatResolutionMode;
};

export async function resolveAndLogCombat(input: ResolveAndLogCombatInput) {
  const resolution = resolveCombatWorkflow({
    attackerName: input.attackerName,
    defenderName: input.defenderName,
    attackSuccesses: input.attackSuccesses,
    targetArmorClass: input.targetArmorClass,
    attackerIsPlayer: input.attackerIsPlayer,
    defenderIsPlayer: input.defenderIsPlayer,
    damageInput: input.damageInput,
    mitigation: input.mitigation,
    damageMode: input.damageMode,
  });

  const client = getSupabaseBrowserClient();
  const { error } = await client.rpc("append_combat_log_entry", {
    target_encounter_id: input.encounterId,
    target_participant_id: input.attackerParticipantId,
    log_message: resolution.message,
    log_payload: resolution.payload,
  });

  if (error) {
    throw error;
  }

  return resolution;
}
