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
};

export type CombatEncounterState = {
  encounterId: string;
  label: string;
  parties: CombatEncounterParty[];
  participants: CombatEncounterParticipant[];
  createdAt: string;
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
  activePowerEffects: EncounterActivePowerEffect[];
};
