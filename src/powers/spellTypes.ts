import type { DamageTypeId } from "../rules/resistances.ts";

export type CastPowerTargetMode = "self" | "single" | "multiple";
export type CastPowerMode = "self" | "aura";
export type DamageMitigationChannel = "dr" | "soak";
export type CastPowerVariantId =
  | "default"
  | "assess_entity"
  | "assess_character"
  | "crowd_control"
  | "release_control"
  | "elemental_bolt"
  | "elemental_cantrip"
  | "elemental_split"
  | "cure"
  | "wound_mend"
  | "heal_living"
  | "holy_purge"
  | "healing_touch"
  | "mana_restore"
  | "let_there_be_light"
  | "lessen_darkness"
  | "luminous_restoration"
  | "expose_darkness"
  | "summon_undead"
  | "dismiss_summon"
  | "non_living_skeleton"
  | "non_living_skeleton_king"
  | "non_living_zombie"
  | "shadow_cloak"
  | "smoldering_shadow"
  | "shadow_walk"
  | "shadow_walk_attack"
  | "shadow_manipulation"
  | "necrotic_touch"
  | "resurrection"
  | "necromancers_bless"
  | "shadow_soldier"
  | "shadow_fighter";

export type CastPowerVariantOption = {
  id: CastPowerVariantId;
  label: string;
};

export type CastPowerDamageTypeOption = {
  id: DamageTypeId;
  label: string;
};

export type HealingCastApplication = {
  targetCharacterId: string;
  amount: number;
  temporaryHpCap: number | null;
};

export type DirectDamageCastApplication = {
  targetCharacterId: string;
  rawAmount: number;
  damageType: DamageTypeId;
  mitigationChannel: DamageMitigationChannel;
  sourceLabel: string;
  sourceSummary: string;
};
