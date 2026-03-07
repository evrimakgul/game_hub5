import type {
  ActionType,
  CoreStatId,
  ParticipantId,
  PowerId,
} from "./game";
import type { EffectDefinition } from "./effects";
import type { DamageTypeId, ResistanceLevel } from "../config/resistances";

export type PowerActionType = ActionType | "bonus_or_standard" | "bonus_plus_standard";

export type FormulaRound = "up" | "down" | "nearest";

export interface PowerValueFormula {
  base?: number;
  base_stat?: CoreStatId;
  base_stat_multiplier?: number;
  base_stat_divisor?: number;
  base_stat_round?: FormulaRound | null;
  power_level_multiplier?: number;
}

export interface PowerSummonAttackPool {
  base_stat: CoreStatId;
  skill_source?: string;
  flat_bonus?: number;
}

export interface PowerSummonDamageValue {
  base_stat?: CoreStatId;
  flat_bonus?: number;
  power_level_multiplier?: number;
}

export interface PowerSummonAttackDefinition {
  name: string;
  attack_pool?: PowerSummonAttackPool;
  damage_value?: PowerSummonDamageValue;
  attacks_per_action?: number;
  damage_types?: DamageTypeId[];
}

export interface PowerSummonDefenseProfile {
  resistance_levels?: Partial<Record<DamageTypeId, ResistanceLevel>>;
  [key: string]: unknown;
}

export interface PowerLevelDefinition {
  level: number;
  actionType?: PowerActionType | null;
  manaCost?: number | null;
  manaCostVariants?: Record<string, number>;
  effects: EffectDefinition[];
  mechanics: Record<string, unknown>;
  adjudication?: Record<string, unknown>;
  description?: string;
}

export interface PowerCantripLevelDefinition {
  powerLevel: number;
  actionType?: PowerActionType | null;
  manaCost?: number | null;
  effects: EffectDefinition[];
  mechanics: Record<string, unknown>;
  description?: string;
}

export interface PowerCantripDefinition {
  introducedAtLevel: number;
  levels: PowerCantripLevelDefinition[];
  description?: string;
}

export interface PowerSummonTemplate {
  combatSummary?: Record<string, number | PowerValueFormula | string | boolean>;
  stats?: Record<string, number | PowerValueFormula>;
  attacks?: PowerSummonAttackDefinition[];
  defenses?: PowerSummonDefenseProfile;
  initiative?: Record<string, unknown>;
  buffRules?: Record<string, unknown>;
  equipmentRules?: Record<string, unknown>;
  summoningRules?: Record<string, unknown>;
}

export interface PowerDefinition {
  id: PowerId;
  name: string;
  abbreviation?: string;
  governingStat: CoreStatId;
  levels: PowerLevelDefinition[];
  cantrip?: PowerCantripDefinition;
  notes?: string[];
  summonTemplates?: Record<string, PowerSummonTemplate>;
}

export interface KnownPower {
  powerId: PowerId;
  level: number;
  learnedFrom: "xp" | "item" | "npc" | "other";
  unlockedAtXp: number | null;
}

export interface CastCommand {
  actorParticipantId: ParticipantId;
  powerId: PowerId;
  requestedAction: ActionType;
  targetParticipantId?: ParticipantId | null;
  selectedStat?: CoreStatId | null;
  useCantrip?: boolean;
}
