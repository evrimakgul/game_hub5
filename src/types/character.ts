import type {
  CharacterId,
  CoreStatId,
  ISODateString,
  ProfileId,
  SkillId,
  StatusEffectId,
} from "./game";
import type { EquipmentLoadout } from "./items";
import type { EffectDefinition } from "./effects";
import type { KnownPower } from "./powers";

export type CoreStatLevels = Record<CoreStatId, number>;
export type SkillLevels = Record<SkillId, number>;

export interface TraitSelection {
  id: string;
  label: string;
  notes: string | null;
}

export interface StatusEffectState {
  statusEffectId: StatusEffectId;
  label: string;
  sourceType: "item" | "power" | "combat" | "environment" | "trait" | "other";
  sourceId: string | null;
  stacks: number;
  appliedAt: ISODateString | null;
  expiresAt: ISODateString | null;
  remainingRounds: number | null;
  effects: EffectDefinition[];
  payload: Record<string, unknown>;
}

export interface CharacterIdentity {
  characterId: CharacterId;
  profileId: ProfileId;
  displayName: string;
  isPlayerCharacter: boolean;
  age: number | null;
  biographyPrimary: string | null;
  biographySecondary: string | null;
}

export interface CharacterProgressionState {
  xpUsed: number;
  money: number;
  inspiration: number;
  positiveKarma: number;
  negativeKarma: number;
}

export interface CharacterBuildState {
  coreStats: CoreStatLevels;
  skillLevels: SkillLevels;
  knownPowers: KnownPower[];
  traits: TraitSelection[];
  merits: TraitSelection[];
  flaws: TraitSelection[];
}

export interface CharacterResourceState {
  currentHp: number;
  currentMana: number;
}

export interface CharacterEquipmentState {
  equippedItems: EquipmentLoadout;
}

export interface CharacterRuntimeState {
  statusEffects: StatusEffectState[];
}

export interface Character
  extends CharacterIdentity,
    CharacterProgressionState,
    CharacterBuildState,
    CharacterResourceState,
    CharacterEquipmentState,
    CharacterRuntimeState {}
