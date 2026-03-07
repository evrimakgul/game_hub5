export type ActivePowerModifierTargetType = "stat" | "skill" | "derived";

export type ActivePowerEffectModifier = {
  targetType: ActivePowerModifierTargetType;
  targetId: string;
  value: number;
  sourceLabel: string;
};

export type ActivePowerEffect = {
  id: string;
  stackKey: string;
  powerId: string;
  powerName: string;
  sourceLevel: number;
  casterCharacterId: string;
  casterName: string;
  targetCharacterId: string;
  label: string;
  summary: string;
  actionType: string | null;
  manaCost: number | null;
  selectedStatId: string | null;
  modifiers: ActivePowerEffectModifier[];
  appliedAt: string;
};
