import type {
  ActionType,
  CoreStatId,
  NumericFormula,
  PowerId,
  SkillId,
  StatCategoryId,
} from "./game";

export const EFFECT_EVENT_TIMINGS = [
  "passive",
  "on_equip",
  "on_unequip",
  "on_activate",
  "on_turn_start",
  "on_turn_end",
  "on_hit",
  "on_damage_taken",
  "on_status_applied",
  "on_expire",
] as const;

export type EffectEventTiming = (typeof EFFECT_EVENT_TIMINGS)[number];

export const EFFECT_DURATION_KINDS = [
  "instant",
  "passive",
  "rounds",
  "minutes",
  "hours",
  "until_end_of_turn",
  "until_end_of_encounter",
  "while_concentrating",
  "until_removed",
] as const;

export type EffectDurationKind = (typeof EFFECT_DURATION_KINDS)[number];

export interface EffectDuration {
  kind: EffectDurationKind;
  amount?: number;
  concentrationActionType?: ActionType | null;
  notes?: string | null;
}

export const EFFECT_TARGET_SCOPES = [
  "self",
  "selected_target",
  "ally",
  "enemy",
  "all_allies_in_range",
  "all_enemies_in_range",
  "equipped_owner",
  "controlled_target",
  "summon",
  "aura_targets",
] as const;

export type EffectTargetScope = (typeof EFFECT_TARGET_SCOPES)[number];

export const RESOURCE_TARGETS = ["current_hp", "current_mana", "inspiration"] as const;

export type ResourceTarget = (typeof RESOURCE_TARGETS)[number];

export const DERIVED_STAT_TARGETS = [
  "max_hp",
  "max_mana",
  "initiative",
  "armor_class",
  "damage_reduction",
  "soak",
  "melee_attack",
  "ranged_attack",
  "melee_damage",
  "ranged_damage",
  "cantrip_damage",
  "spell_damage_single",
  "healing",
  "cantrip_healing",
  "necrotic_touch",
  "attack_dice_pool_hit_bonus",
  "damage_dice_pool_bonus",
  "attack_resolution_hit_bonus",
  "damage_resolution_bonus",
  "successes_to_any_roll",
] as const;

export type DerivedStatTarget = (typeof DERIVED_STAT_TARGETS)[number];

export type EffectAttributeTarget =
  | CoreStatId
  | StatCategoryId
  | SkillId
  | PowerId
  | ResourceTarget
  | DerivedStatTarget;

export interface EffectTargetReference {
  scope: EffectTargetScope;
  attribute?: EffectAttributeTarget;
  maxTargets?: number | null;
  filters?: string[];
}

export interface EffectCondition {
  expression?: string;
  description?: string;
  targetMustMatch?: string[];
}

export interface EffectBase {
  id: string;
  label?: string;
  timing: EffectEventTiming;
  target: EffectTargetReference;
  duration: EffectDuration;
  condition?: EffectCondition;
  notes?: string | null;
}

export type EffectMagnitude = number | NumericFormula;

export interface ModifierEffect extends EffectBase {
  kind: "modifier";
  modifierType: "flat" | "multiplier" | "set" | "cap" | "bonus_dice";
  value: EffectMagnitude;
  stacking: "stack" | "highest_only" | "replace" | "refresh";
}

export interface ResourceEffect extends EffectBase {
  kind: "resource";
  operation: "restore" | "spend" | "drain" | "set";
  value: EffectMagnitude;
  resource: ResourceTarget;
}

export interface DamageEffect extends EffectBase {
  kind: "damage";
  value: EffectMagnitude;
  damageType: string;
  soakStat?: CoreStatId;
  damageMultiplierAgainst?: Record<string, number>;
  splitAmongTargets?: boolean;
}

export interface HealingEffect extends EffectBase {
  kind: "healing";
  value: EffectMagnitude;
  canOverheal?: boolean;
  overhealCapAttribute?: CoreStatId | null;
  removesStatuses?: string[];
}

export interface StatusEffectApplication extends EffectBase {
  kind: "status";
  statusId: string;
  stacks?: number;
  payload?: Record<string, unknown>;
}

export interface SummonEffect extends EffectBase {
  kind: "summon";
  templateId: string;
  quantity: number;
  maxActive?: number | null;
}

export interface ActionEffect extends EffectBase {
  kind: "action";
  action: ActionType;
  operation: "grant" | "consume" | "restore" | "lock";
  amount: number;
}

export interface CustomEffect extends EffectBase {
  kind: "custom";
  key: string;
  data: Record<string, unknown>;
}

export type EffectDefinition =
  | ModifierEffect
  | ResourceEffect
  | DamageEffect
  | HealingEffect
  | StatusEffectApplication
  | SummonEffect
  | ActionEffect
  | CustomEffect;
