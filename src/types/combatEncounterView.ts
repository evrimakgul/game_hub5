import type { PowerEntry } from "../config/characterTemplate";
import type {
  CastPowerMode,
  CastPowerVariantId,
  DamageMitigationChannel,
} from "../powers/spellTypes";
import type { DamageTypeId } from "../rules/resistances";
import type { ActivePowerEffect } from "./activePowerEffects";
import type { CharacterRecord, StatId } from "./character";
import type {
  CharacterEncounterSnapshot,
  EncounterActivityLogEntry,
  CombatEncounterParticipant,
  EncounterOngoingState,
  EncounterTransientCombatant,
} from "./combatEncounter";
import type { SharedItemRecord } from "./items";
import type { PowerUsageResetScope } from "./powerUsage";

export type EncounterParticipantView = {
  participant: CombatEncounterParticipant;
  character: CharacterRecord | null;
  transientCombatant: EncounterTransientCombatant | null;
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
  activityLogEntries: EncounterActivityLogEntry[];
  healingApplications: Array<{
    targetCharacterId: string;
    amount: number;
    temporaryHpCap: number | null;
  }>;
  damageApplications: Array<{
    targetCharacterId: string;
    rawAmount: number;
    damageType: DamageTypeId;
    mitigationChannel: DamageMitigationChannel;
    sourceCharacterId: string;
    sourceLabel: string;
    sourceSummary: string;
  }>;
  resourceChanges: Array<{
    characterId: string;
    field: "currentHp" | "currentMana" | "temporaryHp";
    operation: "set" | "adjust";
    value: number;
  }>;
  statusTagChanges: Array<{
    characterId: string;
    operation: "add" | "remove";
    tag: {
      id: string;
      label: string;
    };
  }>;
  usageCounterChanges: Array<{
    characterId: string;
  } & (
    | {
        operation: "increment";
        scope: PowerUsageResetScope | "perTargetDaily";
        key: string;
        targetCharacterId: string | null;
        amount: number;
      }
    | {
        operation: "setSelection";
        key: string;
        value: string | null;
      }
  )>;
  summonChanges: Array<
    | {
        operation: "spawn";
        summon: EncounterTransientCombatant;
        participant: CombatEncounterParticipant;
      }
    | {
        operation: "dismiss";
        summonId: string;
      }
  >;
  ongoingStateChanges: Array<
    | {
        operation: "add";
        state: EncounterOngoingState;
      }
    | {
        operation: "remove";
        ongoingStateId: string;
      }
    | {
        operation: "releaseCrowdControl";
        casterCharacterId: string;
        targetCharacterId: string;
      }
  >;
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
  selectedDamageType: DamageTypeId | null;
  bonusManaSpend: number;
  selectedSummonOptionId: string | null;
  encounterParticipants: EncounterParticipantView[];
  itemsById?: Record<string, SharedItemRecord>;
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


