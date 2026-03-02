import type { RequestedAction } from "../config/actions";
import type { EquipmentSlot } from "../types";
import { getSupabaseBrowserClient } from "./supabase";

type SpendCombatActionResult = {
  encounter_id: string;
  revision: number;
  round_number: number;
  active_participant_id: string | null;
  active_index: number | null;
  consumed_from: string;
  movement_meters: number;
  prepared_reaction: boolean;
  available_standard: number;
  available_bonus: number;
  available_move: number;
  available_reaction: number;
  available_free: number | null;
  spent_standard: number;
  spent_bonus: number;
  spent_move: number;
  spent_reaction: number;
  spent_free: number;
  turn_started_at: string | null;
  updated_at: string | null;
};

export async function setCharacterResources(
  characterId: string,
  nextCurrentHp: number,
  nextCurrentMana: number
): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { error } = await client.rpc("set_character_resources", {
    target_character_id: characterId,
    next_current_hp: nextCurrentHp,
    next_current_mana: nextCurrentMana,
  });

  if (error) {
    throw error;
  }
}

export async function setInventoryItemSlot(
  itemInstanceId: string,
  targetEquippedSlot: EquipmentSlot | null
): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { error } = await client.rpc("set_inventory_item_slot", {
    target_item_instance_id: itemInstanceId,
    target_equipped_slot: targetEquippedSlot,
  });

  if (error) {
    throw error;
  }
}

export async function spendCombatAction(
  encounterId: string,
  requestedAction: RequestedAction,
  expectedRevision: number
): Promise<SpendCombatActionResult> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.rpc("consume_combat_action", {
    target_encounter_id: encounterId,
    requested_action: requestedAction,
    expected_revision: expectedRevision,
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    throw new Error("No combat action result was returned.");
  }

  return result as SpendCombatActionResult;
}
