import type { PowerEntry } from "../config/characterTemplate";
import type {
  CastPowerMode,
  CastPowerVariantId,
  DamageMitigationChannel,
} from "../rules/powerEffects";
import type { DamageTypeId } from "../rules/resistances";
import type { ActivePowerEffect } from "./activePowerEffects";
import type { CharacterRecord, StatId } from "./character";
import type {
  CharacterEncounterSnapshot,
  CombatEncounterParticipant,
} from "./combatEncounter";

export type EncounterParticipantView = {
  participant: CombatEncounterParticipant;
  character: CharacterRecord | null;
  snapshot: CharacterEncounterSnapshot | null;
};

export type CharacterSheetUpdater =
  | CharacterRecord["sheet"]
  | ((current: CharacterRecord["sheet"]) => CharacterRecord["sheet"]);

export type CastOutcomeState = "unresolved" | "hit" | "miss";

export type PreparedCastRequest = {
  casterCharacterId: string;
  targetCharacterIds: string[];
  manaCost: number;
  effects: ActivePowerEffect[];
  historyEntries: Array<{
    characterId: string;
    entry: CharacterRecord["sheet"]["gameHistory"][number];
  }>;
  healingApplications: Array<{
    targetCharacterId: string;
    amount: number;
  }>;
  damageApplications: Array<{
    targetCharacterId: string;
    rawAmount: number;
    damageType: DamageTypeId;
    mitigationChannel: DamageMitigationChannel;
    sourceLabel: string;
    sourceSummary: string;
  }>;
};

export type CastRequestPayload = {
  casterCharacter: CharacterRecord;
  casterDisplayName: string;
  selectedPower: PowerEntry;
  selectedVariantId: CastPowerVariantId;
  attackOutcome: CastOutcomeState;
  selectedTargetIds: string[];
  fallbackTargetIds: string[];
  healingAllocations: Record<string, number>;
  selectedStatId: StatId | null;
  castMode: CastPowerMode;
  encounterParticipants: EncounterParticipantView[];
};

export type EncounterPartyMemberView = {
  participant: CombatEncounterParticipant;
  character: CharacterRecord;
  currentHp: number;
  maxHp: number;
  hpPercent: number;
  statusSummary: string | null;
};

export type EncounterRollTarget = {
  id: string;
  label: string;
  value: number;
  category: "summary" | "stat" | "skill";
};


