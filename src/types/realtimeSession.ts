import type { CharacterRecord } from "./character.ts";

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

export type CampaignRecord = {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
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
