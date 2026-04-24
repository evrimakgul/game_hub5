import type { CharacterDraft, StatId } from "../config/characterTemplate.ts";
import type { CharacterOwnerRole } from "./character.ts";

export const AUTHORING_SCHEMA_VERSION = "authoring-workshop-v1" as const;

export const CONTENT_STATUSES = ["draft", "playtest_ready", "published"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_SOURCE_KINDS = ["manual", "codex_import"] as const;
export type ContentSourceKind = (typeof CONTENT_SOURCE_KINDS)[number];

export const MOB_ROLE_OPTIONS = [
  "brute",
  "skirmisher",
  "ranged",
  "support",
  "controller",
  "boss",
  "custom",
] as const;
export type MobRole = (typeof MOB_ROLE_OPTIONS)[number];

export type ContentImportProvenance = {
  importedAt: string;
  rawPayload: string | null;
};

export type MobTemplate = {
  id: string;
  name: string;
  themeTags: string[];
  status: ContentStatus;
  version: number;
  sourceKind: ContentSourceKind;
  createdAt: string;
  updatedAt: string;
  challengeRating: number;
  role: MobRole;
  behaviorTags: string[];
  loot: string;
  designerNotes: string;
  sheet: CharacterDraft;
  importProvenance: ContentImportProvenance | null;
};

export type MobGroupMemberSheetOverrides = {
  currentHp?: number | null;
  currentMana?: number | null;
  statBaseOverrides?: Partial<Record<StatId, number>>;
  skillBaseOverrides?: Record<string, number>;
};

export type MobGroupMember = {
  id: string;
  mobTemplateId: string;
  quantity: number;
  displayNameOverride: string;
  notes: string;
  sheetOverrides: MobGroupMemberSheetOverrides | null;
};

export type MobGroup = {
  id: string;
  name: string;
  themeTags: string[];
  status: ContentStatus;
  version: number;
  sourceKind: ContentSourceKind;
  createdAt: string;
  updatedAt: string;
  targetChallengeRating: number | null;
  partyMeanChallengeRating: number | null;
  tactics: string;
  encounterNotes: string;
  members: MobGroupMember[];
  importProvenance: ContentImportProvenance | null;
};

export type PortalStageGroupReference = {
  id: string;
  mobGroupId: string;
  quantityMultiplier: number;
  notes: string;
};

export type PortalStage = {
  id: string;
  index: number;
  title: string;
  sceneText: string;
  environmentTags: string[];
  groupReferences: PortalStageGroupReference[];
  targetChallengeRating: number | null;
  traps: string;
  chest: string;
  objective: string;
  isBossStage: boolean;
};

export type PortalTemplate = {
  id: string;
  name: string;
  theme: string;
  depth: number;
  status: ContentStatus;
  version: number;
  sourceKind: ContentSourceKind;
  createdAt: string;
  updatedAt: string;
  intro: string;
  partyMeanChallengeRating: number | null;
  closingReward: string;
  exitSummary: string;
  stages: PortalStage[];
  importProvenance: ContentImportProvenance | null;
};

export type EncounterOwnedMobInstance = {
  id: string;
  ownerRole: CharacterOwnerRole;
  sourceMobTemplateId: string;
  sourceGroupId: string | null;
  sourcePortalId: string | null;
  sourcePortalStageId: string | null;
  displayName: string;
  role: MobRole;
  themeTags: string[];
  behaviorTags: string[];
  loot: string;
  notes: string;
  sheet: CharacterDraft;
};

export type CodexImportKind =
  | "mob_template_batch"
  | "mob_group_batch"
  | "portal_template"
  | "portal_bundle";

export type ImportedMobTemplateBatchPayload = {
  kind: "mob_template_batch";
  schemaVersion: typeof AUTHORING_SCHEMA_VERSION;
  producedAt: string;
  requestIntent: string;
  theme: string;
  mobs: MobTemplate[];
};

export type ImportedMobGroupBatchPayload = {
  kind: "mob_group_batch";
  schemaVersion: typeof AUTHORING_SCHEMA_VERSION;
  producedAt: string;
  requestIntent: string;
  theme: string;
  groups: MobGroup[];
};

export type ImportedPortalTemplatePayload = {
  kind: "portal_template";
  schemaVersion: typeof AUTHORING_SCHEMA_VERSION;
  producedAt: string;
  requestIntent: string;
  theme: string;
  portal: PortalTemplate;
};

export type ImportedPortalBundlePayload = {
  kind: "portal_bundle";
  schemaVersion: typeof AUTHORING_SCHEMA_VERSION;
  producedAt: string;
  requestIntent: string;
  theme: string;
  mobs: MobTemplate[];
  groups: MobGroup[];
  portal: PortalTemplate;
};

export type CodexImportPayload =
  | ImportedMobTemplateBatchPayload
  | ImportedMobGroupBatchPayload
  | ImportedPortalTemplatePayload
  | ImportedPortalBundlePayload;

export type CodexRequestPacketDifficulty = {
  mobChallengeRating?: number | null;
  computedGroupChallengeRating?: number | null;
  targetGroupChallengeRating?: number | null;
  partyMeanChallengeRating?: number | null;
  stageChallengeRatings?: Array<{
    index: number;
    title: string;
    isBossStage: boolean;
    targetChallengeRating: number | null;
    computedChallengeRating?: number | null;
  }>;
};

export type CodexRequestPacket = {
  schemaVersion: typeof AUTHORING_SCHEMA_VERSION;
  requestKind?: CodexImportKind | "portal_bundle";
  requestIntent: string;
  theme: string;
  depth?: number | null;
  stageCount?: number | null;
  difficulty?: CodexRequestPacketDifficulty | null;
  currentObject: unknown | null;
  exampleObjects: unknown[];
};

export type SupabaseReadyContentRow<TPayload> = {
  id: string;
  owner_id: string;
  name: string;
  theme: string;
  status: ContentStatus;
  version: number;
  source_kind: ContentSourceKind;
  created_at: string;
  updated_at: string;
  payload: TPayload;
};

export function isContentStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && CONTENT_STATUSES.includes(value as ContentStatus);
}

export function isContentSourceKind(value: unknown): value is ContentSourceKind {
  return (
    typeof value === "string" &&
    CONTENT_SOURCE_KINDS.includes(value as ContentSourceKind)
  );
}

export function isMobRole(value: unknown): value is MobRole {
  return typeof value === "string" && MOB_ROLE_OPTIONS.includes(value as MobRole);
}
