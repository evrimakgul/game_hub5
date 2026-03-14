import type { CharacterOwnerRole } from "./character";

export type CombatEncounterOwnerRole = CharacterOwnerRole;
export type CombatEncounterPartyKind = "players" | "npcs" | "custom";

export type CombatEncounterParty = {
  partyId: string;
  label: string;
  kind: CombatEncounterPartyKind;
};

export type CombatEncounterParticipantInput = {
  characterId: string;
  ownerRole: CombatEncounterOwnerRole;
  displayName: string;
  dex: number;
  wits: number;
  partyId?: string | null;
  initiativeFaces?: number[];
  controllerCharacterId?: string | null;
  summonTemplateId?: string | null;
  sourcePowerId?: string | null;
};

export type CombatEncounterParticipant = {
  characterId: string;
  ownerRole: CombatEncounterOwnerRole;
  displayName: string;
  initiativePool: number;
  initiativeFaces: number[];
  initiativeSuccesses: number;
  dex: number;
  wits: number;
  partyId: string | null;
  controllerCharacterId: string | null;
  summonTemplateId: string | null;
  sourcePowerId: string | null;
};

export type EncounterTransientCombatant = {
  id: string;
  ownerRole: CombatEncounterOwnerRole;
  controllerCharacterId: string;
  sourcePowerId: string;
  sourcePowerLevel: number;
  summonTemplateId: string;
  buffRules: {
    canReceiveSingleBuffs: boolean;
    canReceiveGroupBuffs: boolean;
    canBeHealed: boolean;
  };
  sheet: import("../config/characterTemplate").CharacterDraft;
};

export type CombatEncounterTurnState = {
  round: number;
  activeParticipantIndex: number;
  activeParticipantId: string | null;
};

export type EncounterOngoingState =
  | {
      id: string;
      kind: "crowd_control";
      casterCharacterId: string;
      targetCharacterId: string;
      powerLevel: number;
      maintenanceManaCost: number;
      breaksOnDamageFromCaster: boolean;
      breaksOnDamageFromOthers: boolean;
      commandActionType: "bonus" | "free" | null;
      summaryNote: string | null;
    }
  | {
      id: string;
      kind: "body_reinforcement_revive";
      characterId: string;
      reviveHp: number;
      remainingTurnAdvances: number;
    }
  | {
      id: string;
      kind: "expose_darkness";
      casterCharacterId: string;
      targetCharacterId: string;
      summaryNote: string | null;
    };

export type CombatEncounterState = {
  encounterId: string;
  label: string;
  parties: CombatEncounterParty[];
  participants: CombatEncounterParticipant[];
  createdAt: string;
  turnState: CombatEncounterTurnState;
  transientCombatants: EncounterTransientCombatant[];
  ongoingStates: EncounterOngoingState[];
};

export type EncounterBreakdownField = {
  id: string;
  label: string;
  value: number | string;
  summary: string;
  detail: string;
};

export type EncounterCombatSummaryField = {
  id: string;
  label: string;
  value: number | string;
  selectableValue: number | null;
};

export type EncounterVisibleResistance = {
  id: string;
  label: string;
  levelLabel: string;
  multiplierLabel: string;
};

export type EncounterActivePowerEffect = {
  id: string;
  label: string;
  summary: string;
  source: string;
};

export type CharacterEncounterSnapshot = {
  combatSummary: EncounterCombatSummaryField[];
  stats: EncounterBreakdownField[];
  highlightedSkills: EncounterBreakdownField[];
  visibleResistances: EncounterVisibleResistance[];
  inspiration: number;
  inspirationDetail: string;
  statusTags: string[];
  utilityTraits: string[];
  activePowerEffects: EncounterActivePowerEffect[];
};
