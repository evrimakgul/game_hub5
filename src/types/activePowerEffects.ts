import type { StatId } from "./character";

export type ActivePowerModifierTargetType = "stat" | "skill" | "derived";
export type ActivePowerEffectKind = "direct" | "aura_source" | "aura_shared";
export type ActivePowerShareMode = "self" | "aura" | null;

export type ActivePowerEffectModifier = {
  targetType: ActivePowerModifierTargetType;
  targetId: string;
  value: number;
  sourceLabel: string;
};

export type ActivePowerEffect = {
  id: string;
  stackKey: string;
  effectKind: ActivePowerEffectKind;
  powerId: string;
  powerName: string;
  sourceLevel: number;
  casterCharacterId: string;
  casterName: string;
  targetCharacterId: string;
  sourceEffectId: string | null;
  shareMode: ActivePowerShareMode;
  sharedTargetCharacterIds: string[] | null;
  label: string;
  summary: string;
  actionType: string | null;
  manaCost: number | null;
  selectedStatId: StatId | null;
  modifiers: ActivePowerEffectModifier[];
  appliedAt: string;
};
