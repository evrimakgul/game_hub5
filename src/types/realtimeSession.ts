import type { CharacterRecord } from "./character.ts";
import type { EncounterActivityLogEntry } from "./combatEncounter.ts";

export type OnlineSessionRole = "dm" | "player";

export type SessionEventKind = "message" | "roll" | "share" | "reward" | "note" | "pin";

export type SessionEventVisibility = "public" | "limited" | "dm_only" | "dm_and_actor";

export type SessionViewer = {
  userId: string | null;
  role: OnlineSessionRole;
  characterId?: string | null;
};

export type SessionEvent = {
  id: string;
  sessionId: string;
  kind: SessionEventKind;
  visibility: SessionEventVisibility;
  actorUserId: string | null;
  actorCharacterId: string | null;
  actorDisplayName: string;
  targetUserIds: string[];
  targetCharacterIds: string[];
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type RollEventVisibilityMode = "public" | "dm_private" | "player_hidden";

export type CreateRollEventInput = {
  id?: string;
  sessionId: string;
  actorUserId: string | null;
  actorCharacterId: string | null;
  actorDisplayName: string;
  labels: string[];
  poolSize: number;
  faces: number[];
  mode: RollEventVisibilityMode;
  targetUserIds?: string[];
  targetCharacterIds?: string[];
  createdAt?: string;
};

export type ShareEventInput = {
  id?: string;
  sessionId: string;
  actorUserId: string | null;
  actorCharacterId: string | null;
  actorDisplayName: string;
  summary: string;
  visibility: Extract<SessionEventVisibility, "public" | "limited">;
  targetUserIds?: string[];
  targetCharacterIds?: string[];
  cardRevisionId?: string | null;
  cardEntityId?: string | null;
  text?: string;
  createdAt?: string;
};

export type RewardPacket = {
  characterIds: string[];
  xpEarnedDelta: number;
  inspirationDelta: number;
  temporaryInspirationDelta: number;
  moneyDelta: number;
  positiveKarmaDelta: number;
  negativeKarmaDelta: number;
  note: string;
  cardRevisionIds: string[];
};

export type ApplyRewardPacketInput = {
  id?: string;
  sessionId: string;
  characters: CharacterRecord[];
  packet: RewardPacket;
  actorUserId: string | null;
  actorDisplayName: string;
  createdAt?: string;
};

export type ApplyRewardPacketResult = {
  characters: CharacterRecord[];
  event: SessionEvent;
};

export type OnlineProfile = {
  id: string;
  displayName: string;
  createdAt: string;
};

export type GameRecord = {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
};

export type CampaignRecord = {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  gameId?: string | null;
  gameName?: string | null;
};

export type CampaignMemberRecord = {
  campaignId: string;
  userId: string;
  role: OnlineSessionRole;
  displayName: string;
  selectedCharacterId: string | null;
  joinedAt: string;
};

export type GameSessionRecord = {
  id: string;
  campaignId: string;
  label: string;
  status: "active" | "closed";
  createdBy: string;
  startedAt: string;
  endedAt: string | null;
  sessionNotes: string;
  sessionNumber: number | null;
};

export type SessionAttendeeRecord = {
  sessionId: string;
  userId: string;
  role: OnlineSessionRole;
  displayName: string;
  selectedCharacterId: string | null;
  joinedAt: string;
  addedByUserId: string | null;
};

export type SessionCharacterRecord = {
  id: string;
  sessionId: string;
  characterId: string;
  ownerUserId: string | null;
  ownerRole: OnlineSessionRole;
  displayName: string;
  sheetPayload: unknown;
  updatedAt: string;
};

export type CampaignCharacterRecord = {
  id: string;
  campaignId: string;
  characterId: string;
  ownerUserId: string;
  displayName: string;
  sheetPayload: unknown;
  updatedAt: string;
};

export type SessionCombatParticipant = {
  characterId: string;
  label: string;
  partyLabel: string;
  hpPercent: number;
  isViewer: boolean;
  isAllied: boolean;
  isOpponent: boolean;
  isActive: boolean;
  canInspect: boolean;
};

export type SessionCombatViewPayload = {
  schemaVersion: 1;
  encounterId: string;
  encounterLabel: string;
  viewerCharacterId: string;
  round: number;
  activeParticipantId: string | null;
  activeCombatantLabel: string | null;
  generatedAt: string;
  combatants: SessionCombatParticipant[];
  activityLog: EncounterActivityLogEntry[];
};

export type SessionCombatStateRecord = {
  sessionId: string;
  encounterId: string;
  encounterLabel: string;
  encounterPayload: unknown;
  updatedByUserId: string | null;
  updatedAt: string;
};

export type SessionCombatViewRecord = {
  sessionId: string;
  viewerCharacterId: string;
  encounterId: string;
  encounterLabel: string;
  viewPayload: SessionCombatViewPayload;
  updatedByUserId: string | null;
  updatedAt: string;
};
