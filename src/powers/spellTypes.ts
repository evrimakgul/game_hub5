import type { DamageTypeId } from "../rules/resistances.ts";

export type CastPowerTargetMode = "self" | "single" | "multiple";
export type CastPowerMode = "self" | "aura";
export type DamageMitigationChannel = "dr" | "soak";
export type CastPowerVariantId =
  | "default"
  | "assess_character"
  | "crowd_control"
  | "release_control"
  | "elemental_bolt"
  | "elemental_cantrip"
  | "cure"
  | "wound_mend"
  | "mana_restore"
  | "expose_darkness"
  | "summon_undead"
  | "dismiss_summon"
  | "shadow_cloak"
  | "shadow_walk"
  | "shadow_manipulation"
  | "necrotic_touch"
  | "resurrection"
  | "shadow_soldier";

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
