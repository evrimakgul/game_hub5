export const KNOWLEDGE_ENTITY_TYPES = [
  "character",
  "item",
  "place",
  "faction",
  "story",
  "custom",
] as const;
export type KnowledgeEntityType = (typeof KNOWLEDGE_ENTITY_TYPES)[number];

export const KNOWLEDGE_SOURCE_TYPES = [
  "spell",
  "share",
  "manual_edit",
  "story_reward",
  "dm_grant",
] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const KNOWLEDGE_LINEAGE_MODES = [
  "observed",
  "copied",
  "edited_copy",
  "updated_scan",
] as const;
export type KnowledgeLineageMode = (typeof KNOWLEDGE_LINEAGE_MODES)[number];

export const KNOWLEDGE_SECTION_KINDS = [
  "summary",
  "biography",
  "resistances",
  "combat_summary",
  "stats",
  "skills",
  "powers",
  "specials",
  "notes",
  "custom",
] as const;
export type KnowledgeRevisionSectionKind = (typeof KNOWLEDGE_SECTION_KINDS)[number];

export type KnowledgeRevisionEntry = {
  id: string;
  label: string;
  value: string;
};

export type KnowledgeRevisionSection = {
  id: string;
  title: string;
  kind: KnowledgeRevisionSectionKind;
  entries: KnowledgeRevisionEntry[];
};

export type KnowledgeEntity = {
  id: string;
  type: KnowledgeEntityType;
  subjectKey: string | null;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeRevision = {
  id: string;
  entityId: string;
  revisionNumber: number;
  title: string;
  summary: string;
  content: KnowledgeRevisionSection[];
  tags: string[];
  createdAt: string;
  createdByCharacterId: string | null;
  sourceType: KnowledgeSourceType;
  sourceSpellName: string | null;
  sourceHistoryEntryId: string | null;
  parentRevisionId: string | null;
  lineageMode: KnowledgeLineageMode;
  isCanonical: boolean;
};

export type KnowledgeOwnership = {
  id: string;
  ownerCharacterId: string;
  revisionId: string;
  acquiredAt: string;
  acquiredFromCharacterId: string | null;
  localLabel: string;
  isArchived: boolean;
  isPinned: boolean;
};

export type KnowledgeHistoryLink = {
  knowledgeEntityId: string;
  knowledgeRevisionId: string;
  knowledgeLabel: string;
};

export type KnowledgeState = {
  knowledgeEntities: KnowledgeEntity[];
  knowledgeRevisions: KnowledgeRevision[];
  knowledgeOwnerships: KnowledgeOwnership[];
};

export function isKnowledgeEntityType(value: unknown): value is KnowledgeEntityType {
  return typeof value === "string" && KNOWLEDGE_ENTITY_TYPES.includes(value as KnowledgeEntityType);
}

export function isKnowledgeSourceType(value: unknown): value is KnowledgeSourceType {
  return typeof value === "string" && KNOWLEDGE_SOURCE_TYPES.includes(value as KnowledgeSourceType);
}

export function isKnowledgeLineageMode(value: unknown): value is KnowledgeLineageMode {
  return typeof value === "string" && KNOWLEDGE_LINEAGE_MODES.includes(value as KnowledgeLineageMode);
}

export function isKnowledgeRevisionSectionKind(value: unknown): value is KnowledgeRevisionSectionKind {
  return (
    typeof value === "string" &&
    KNOWLEDGE_SECTION_KINDS.includes(value as KnowledgeRevisionSectionKind)
  );
}
