import { resolveHit, resolveMagicalDamage, resolvePhysicalDamage } from "./combat.ts";

export type CombatResolutionMode = "physical" | "magical";

export type CombatWorkflowInput = {
  attackerName: string;
  defenderName: string;
  attackSuccesses: number;
  targetArmorClass: number;
  attackerIsPlayer: boolean;
  defenderIsPlayer: boolean;
  damageInput: number;
  mitigation: number;
  damageMode: CombatResolutionMode;
};

export type CombatWorkflowResult = {
  hit: boolean;
  margin: number;
  damage: number;
  message: string;
  payload: Record<string, unknown>;
};

export function resolveCombatWorkflow(input: CombatWorkflowInput): CombatWorkflowResult {
  const hitResult = resolveHit(
    input.attackSuccesses,
    input.targetArmorClass,
    input.attackerIsPlayer,
    input.defenderIsPlayer
  );

  if (!hitResult.hit) {
    return {
      hit: false,
      margin: 0,
      damage: 0,
      message: `${input.attackerName} misses ${input.defenderName}.`,
      payload: {
        event: "attack_resolution",
        attacker_name: input.attackerName,
        defender_name: input.defenderName,
        attack_successes: input.attackSuccesses,
        target_armor_class: input.targetArmorClass,
        hit: false,
        margin: 0,
        damage: 0,
        damage_mode: input.damageMode,
      },
    };
  }

  const damage =
    input.damageMode === "physical"
      ? resolvePhysicalDamage(input.damageInput, input.mitigation)
      : resolveMagicalDamage(input.damageInput, input.mitigation);

  return {
    hit: true,
    margin: hitResult.margin,
    damage,
    message: `${input.attackerName} hits ${input.defenderName} for ${damage} ${input.damageMode} damage.`,
    payload: {
      event: "attack_resolution",
      attacker_name: input.attackerName,
      defender_name: input.defenderName,
      attack_successes: input.attackSuccesses,
      target_armor_class: input.targetArmorClass,
      hit: true,
      margin: hitResult.margin,
      damage,
      damage_input: input.damageInput,
      mitigation: input.mitigation,
      damage_mode: input.damageMode,
    },
  };
}
