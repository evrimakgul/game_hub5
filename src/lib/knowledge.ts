import type {
  CharacterDraft,
  GameHistoryEntry,
  GameHistoryIntelSnapshotEntry,
} from "../config/characterTemplate.ts";
import { formatActualDateTime } from "./dateTime.ts";
import { createTimestampedId, getIsoTimestamp } from "./ids.ts";
import type { SharedItemRecord } from "../types/items.ts";
import type { CharacterRecord } from "../types/character.ts";
import type {
  ItemBlueprintRecord,
  ItemCategoryDefinition,
  ItemSubcategoryDefinition,
} from "../types/items.ts";
import type {
  KnowledgeEntity,
  KnowledgeHistoryLink,
  KnowledgeLineageMode,
  KnowledgeOwnership,
  KnowledgeRevision,
  KnowledgeRevisionEntry,
  KnowledgeRevisionSection,
  KnowledgeRevisionSectionKind,
  KnowledgeSourceType,
  KnowledgeState,
} from "../types/knowledge.ts";
import {
  isKnowledgeEntityType,
  isKnowledgeLineageMode,
  isKnowledgeRevisionSectionKind,
  isKnowledgeSourceType,
} from "../types/knowledge.ts";
import { buildAssessCharacterHistoryEntry } from "../powers/runtimeSupport.ts";
import { buildCharacterDerivedValues } from "../config/characterRuntime.ts";
import { buildCharacterEncounterSnapshot } from "../rules/combatEncounter.ts";
import { getCrAndRankFromXpUsed } from "../rules/xpTables.ts";
import {
  getItemBaseVisibleStats,
  getItemBlueprintLabel,
  getItemCompactBonusSummary,
  getItemCompactHeaderSummary,
  getItemPropertyPoints,
  getItemTierLabel,
  identifyItemForCharacter,
} from "./items.ts";

type KnowledgeIndexes = {
  entityById: Map<string, KnowledgeEntity>;
  revisionById: Map<string, KnowledgeRevision>;
  revisionsByEntityId: Map<string, KnowledgeRevision[]>;
  ownershipsByOwnerId: Map<string, KnowledgeOwnership[]>;
  ownershipByOwnerAndRevisionId: Map<string, KnowledgeOwnership>;
};

type CreateKnowledgeRevisionArgs = {
  entityId: string;
  revisionNumber: number;
  title: string;
  summary: string;
  content: KnowledgeRevisionSection[];
  tags?: string[];
  createdAt?: string;
  createdByCharacterId: string | null;
  sourceType: KnowledgeSourceType;
  sourceSpellName?: string | null;
  sourceHistoryEntryId?: string | null;
  parentRevisionId?: string | null;
  lineageMode: KnowledgeLineageMode;
  isCanonical: boolean;
  id?: string;
};

type CreateKnowledgeOwnershipArgs = {
  ownerCharacterId: string;
  revisionId: string;
  acquiredAt?: string;
  acquiredFromCharacterId?: string | null;
  localLabel?: string;
  isArchived?: boolean;
  isPinned?: boolean;
  id?: string;
};

type CreateCharacterKnowledgeRevisionArgs = {
  targetCharacter: CharacterRecord;
  createdByCharacterId: string | null;
  historyEntryId: string | null;
  sourceType: KnowledgeSourceType;
  sourceSpellName?: string | null;
  lineageMode: KnowledgeLineageMode;
  isCanonical: boolean;
  revisionId?: string;
  parentRevisionId?: string | null;
  itemsById?: Record<string, SharedItemRecord>;
  now?: Date;
};

type ItemKnowledgeContext = {
  itemBlueprints?: ItemBlueprintRecord[];
  itemCategoryDefinitions?: ItemCategoryDefinition[];
  itemSubcategoryDefinitions?: ItemSubcategoryDefinition[];
};

type KnowledgeBatch = {
  entities: KnowledgeEntity[];
  revisions: KnowledgeRevision[];
  ownerships: KnowledgeOwnership[];
};

export type ResolvedKnowledgeOwnership = {
  entity: KnowledgeEntity;
  revision: KnowledgeRevision;
  ownership: KnowledgeOwnership;
  displayLabel: string;
};

export type KnowledgeOwnerGroup = {
  entity: KnowledgeEntity;
  revisions: ResolvedKnowledgeOwnership[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeEntries(
  kind: KnowledgeRevisionSectionKind,
  values: Array<{ label?: string; value: string }>
): KnowledgeRevisionEntry[] {
  return values
    .filter((entry) => entry.value.trim().length > 0)
    .map((entry, index) => ({
      id: createTimestampedId(`knowledge-entry-${kind}`, {
        timestamp: index + 1,
        randomSuffix: `${index + 1}`.padStart(2, "0"),
      }),
      label: entry.label?.trim() ?? "",
      value: entry.value.trim(),
    }));
}

function createSection(
  title: string,
  kind: KnowledgeRevisionSectionKind,
  values: Array<{ label?: string; value: string }>
): KnowledgeRevisionSection | null {
  const entries = normalizeEntries(kind, values);
  if (entries.length === 0) {
    return null;
  }

  return {
    id: createTimestampedId(`knowledge-section-${kind}`),
    title,
    kind,
    entries,
  };
}

export function createEmptyKnowledgeState(): KnowledgeState {
  return {
    knowledgeEntities: [],
    knowledgeRevisions: [],
    knowledgeOwnerships: [],
  };
}

export function hydrateKnowledgeEntity(value: unknown): KnowledgeEntity | null {
  if (!isRecord(value) || !isKnowledgeEntityType(value.type)) {
    return null;
  }

  const id = coerceString(value.id, "");
  const displayName = coerceString(value.displayName, "");
  const createdAt = coerceString(value.createdAt, "");
  const updatedAt = coerceString(value.updatedAt, "");

  if (!id || !displayName || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    type: value.type,
    subjectKey: typeof value.subjectKey === "string" ? value.subjectKey : null,
    displayName,
    createdAt,
    updatedAt,
  };
}

export function hydrateKnowledgeRevision(value: unknown): KnowledgeRevision | null {
  if (!isRecord(value) || !isKnowledgeSourceType(value.sourceType) || !isKnowledgeLineageMode(value.lineageMode)) {
    return null;
  }

  const id = coerceString(value.id, "");
  const entityId = coerceString(value.entityId, "");
  const title = coerceString(value.title, "");
  const summary = coerceString(value.summary, "");
  const createdAt = coerceString(value.createdAt, "");
  const revisionNumber = Number.isFinite(value.revisionNumber)
    ? Math.max(1, Math.trunc(Number(value.revisionNumber)))
    : 1;

  if (!id || !entityId || !title || !createdAt) {
    return null;
  }

  const content = Array.isArray(value.content)
    ? value.content.reduce<KnowledgeRevisionSection[]>((sections, section) => {
        if (!isRecord(section) || !isKnowledgeRevisionSectionKind(section.kind)) {
          return sections;
        }

        const sectionId = coerceString(section.id, "");
        const sectionTitle = coerceString(section.title, "");
        const entries = Array.isArray(section.entries)
          ? section.entries.reduce<KnowledgeRevisionEntry[]>((result, entry) => {
              if (!isRecord(entry)) {
                return result;
              }

              const entryId = coerceString(entry.id, "");
              const entryValue = coerceString(entry.value, "");
              if (!entryId || !entryValue) {
                return result;
              }

              result.push({
                id: entryId,
                label: coerceString(entry.label, ""),
                value: entryValue,
              });
              return result;
            }, [])
          : [];

        if (!sectionId || !sectionTitle || entries.length === 0) {
          return sections;
        }

        sections.push({
          id: sectionId,
          title: sectionTitle,
          kind: section.kind,
          entries,
        });
        return sections;
      }, [])
    : [];

  return {
    id,
    entityId,
    revisionNumber,
    title,
    summary,
    content,
    tags: Array.isArray(value.tags)
      ? value.tags.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
    createdAt,
    createdByCharacterId: typeof value.createdByCharacterId === "string" ? value.createdByCharacterId : null,
    sourceType: value.sourceType,
    sourceSpellName: typeof value.sourceSpellName === "string" ? value.sourceSpellName : null,
    sourceHistoryEntryId: typeof value.sourceHistoryEntryId === "string" ? value.sourceHistoryEntryId : null,
    parentRevisionId: typeof value.parentRevisionId === "string" ? value.parentRevisionId : null,
    lineageMode: value.lineageMode,
    isCanonical: value.isCanonical === true,
  };
}

export function hydrateKnowledgeOwnership(value: unknown): KnowledgeOwnership | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = coerceString(value.id, "");
  const ownerCharacterId = coerceString(value.ownerCharacterId, "");
  const revisionId = coerceString(value.revisionId, "");
  const acquiredAt = coerceString(value.acquiredAt, "");

  if (!id || !ownerCharacterId || !revisionId || !acquiredAt) {
    return null;
  }

  return {
    id,
    ownerCharacterId,
    revisionId,
    acquiredAt,
    acquiredFromCharacterId:
      typeof value.acquiredFromCharacterId === "string" ? value.acquiredFromCharacterId : null,
    localLabel: coerceString(value.localLabel, ""),
    isArchived: value.isArchived === true,
    isPinned: value.isPinned === true,
  };
}

export function buildKnowledgeIndexes(state: KnowledgeState): KnowledgeIndexes {
  const entityById = new Map(state.knowledgeEntities.map((entity) => [entity.id, entity]));
  const revisionById = new Map(state.knowledgeRevisions.map((revision) => [revision.id, revision]));
  const revisionsByEntityId = new Map<string, KnowledgeRevision[]>();
  state.knowledgeRevisions.forEach((revision) => {
    const current = revisionsByEntityId.get(revision.entityId) ?? [];
    current.push(revision);
    revisionsByEntityId.set(revision.entityId, current);
  });
  revisionsByEntityId.forEach((revisions) =>
    revisions.sort((left, right) => right.revisionNumber - left.revisionNumber)
  );

  const ownershipsByOwnerId = new Map<string, KnowledgeOwnership[]>();
  const ownershipByOwnerAndRevisionId = new Map<string, KnowledgeOwnership>();
  state.knowledgeOwnerships.forEach((ownership) => {
    const current = ownershipsByOwnerId.get(ownership.ownerCharacterId) ?? [];
    current.push(ownership);
    ownershipsByOwnerId.set(ownership.ownerCharacterId, current);
    ownershipByOwnerAndRevisionId.set(
      `${ownership.ownerCharacterId}:${ownership.revisionId}`,
      ownership
    );
  });

  return {
    entityById,
    revisionById,
    revisionsByEntityId,
    ownershipsByOwnerId,
    ownershipByOwnerAndRevisionId,
  };
}

export function getKnowledgeEntityById(
  state: KnowledgeState,
  entityId: string
): KnowledgeEntity | null {
  return state.knowledgeEntities.find((entity) => entity.id === entityId) ?? null;
}

export function getKnowledgeRevisionById(
  state: KnowledgeState,
  revisionId: string
): KnowledgeRevision | null {
  return state.knowledgeRevisions.find((revision) => revision.id === revisionId) ?? null;
}

export function getKnowledgeOwnershipById(
  state: KnowledgeState,
  ownershipId: string
): KnowledgeOwnership | null {
  return state.knowledgeOwnerships.find((ownership) => ownership.id === ownershipId) ?? null;
}

export function applyKnowledgeBatch(currentState: KnowledgeState, batch: KnowledgeBatch): KnowledgeState {
  const nextEntities = new Map(currentState.knowledgeEntities.map((entity) => [entity.id, entity]));
  const nextRevisions = new Map(currentState.knowledgeRevisions.map((revision) => [revision.id, revision]));
  const nextOwnerships = new Map(
    currentState.knowledgeOwnerships.map((ownership) => [ownership.id, ownership])
  );

  batch.entities.forEach((entity) => nextEntities.set(entity.id, entity));
  batch.revisions.forEach((revision) => nextRevisions.set(revision.id, revision));
  batch.ownerships.forEach((ownership) => nextOwnerships.set(ownership.id, ownership));

  return {
    knowledgeEntities: [...nextEntities.values()],
    knowledgeRevisions: [...nextRevisions.values()],
    knowledgeOwnerships: [...nextOwnerships.values()],
  };
}

export function findKnowledgeEntityBySubjectKey(
  state: KnowledgeState,
  type: KnowledgeEntity["type"],
  subjectKey: string
): KnowledgeEntity | null {
  return (
    state.knowledgeEntities.find(
      (entity) => entity.type === type && entity.subjectKey === subjectKey
    ) ?? null
  );
}

export function getNextKnowledgeRevisionNumber(
  state: KnowledgeState,
  entityId: string
): number {
  const revisions = state.knowledgeRevisions.filter((revision) => revision.entityId === entityId);
  return revisions.length === 0
    ? 1
    : Math.max(...revisions.map((revision) => revision.revisionNumber)) + 1;
}

export function buildKnowledgeRevisionLabel(revision: KnowledgeRevision): string {
  const base = `v${revision.revisionNumber}`;
  if (revision.lineageMode === "edited_copy") {
    return `${base} - edited copy`;
  }
  if (revision.lineageMode === "updated_scan") {
    return `${base} - updated scan`;
  }
  if (revision.lineageMode === "copied") {
    return `${base} - copied`;
  }
  return base;
}

export function buildKnowledgeHistoryLink(
  entity: KnowledgeEntity,
  revision: KnowledgeRevision
): KnowledgeHistoryLink {
  return {
    knowledgeEntityId: entity.id,
    knowledgeRevisionId: revision.id,
    knowledgeLabel: `${entity.displayName} ${buildKnowledgeRevisionLabel(revision)}`,
  };
}

export function getKnowledgeOwnershipDisplayLabel(
  ownership: KnowledgeOwnership,
  entity: KnowledgeEntity,
  revision: KnowledgeRevision
): string {
  if (ownership.localLabel.trim().length > 0) {
    return ownership.localLabel.trim();
  }

  return `${entity.displayName} ${buildKnowledgeRevisionLabel(revision)}`;
}

export function createKnowledgeEntity(args: {
  type: KnowledgeEntity["type"];
  subjectKey: string | null;
  displayName: string;
  now?: Date;
  id?: string;
}): KnowledgeEntity {
  const now = args.now ?? new Date();
  const iso = getIsoTimestamp(now);
  return {
    id: args.id ?? createTimestampedId("knowledge-entity"),
    type: args.type,
    subjectKey: args.subjectKey,
    displayName: args.displayName.trim(),
    createdAt: iso,
    updatedAt: iso,
  };
}

export function createKnowledgeRevision(args: CreateKnowledgeRevisionArgs): KnowledgeRevision {
  return {
    id: args.id ?? createTimestampedId("knowledge-revision"),
    entityId: args.entityId,
    revisionNumber: Math.max(1, Math.trunc(args.revisionNumber)),
    title: args.title.trim(),
    summary: args.summary.trim(),
    content: args.content,
    tags: [...new Set((args.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0))],
    createdAt: args.createdAt ?? getIsoTimestamp(),
    createdByCharacterId: args.createdByCharacterId,
    sourceType: args.sourceType,
    sourceSpellName: args.sourceSpellName ?? null,
    sourceHistoryEntryId: args.sourceHistoryEntryId ?? null,
    parentRevisionId: args.parentRevisionId ?? null,
    lineageMode: args.lineageMode,
    isCanonical: args.isCanonical,
  };
}

export function createKnowledgeOwnership(args: CreateKnowledgeOwnershipArgs): KnowledgeOwnership {
  return {
    id: args.id ?? createTimestampedId("knowledge-ownership"),
    ownerCharacterId: args.ownerCharacterId,
    revisionId: args.revisionId,
    acquiredAt: args.acquiredAt ?? getIsoTimestamp(),
    acquiredFromCharacterId: args.acquiredFromCharacterId ?? null,
    localLabel: args.localLabel?.trim() ?? "",
    isArchived: args.isArchived === true,
    isPinned: args.isPinned === true,
  };
}

function buildCharacterKnowledgeSectionsFromIntelEntry(
  entry: GameHistoryIntelSnapshotEntry
): KnowledgeRevisionSection[] {
  const sections = [
    createSection("Summary", "summary", [
      { label: "Rank", value: entry.snapshot.rank },
      { label: "CR", value: `${entry.snapshot.cr}` },
      { label: "Age", value: entry.snapshot.age === null ? "" : `${entry.snapshot.age}` },
      { label: "Karma", value: entry.snapshot.karma },
    ]),
    createSection("Biography", "biography", [
      { value: entry.snapshot.biographyPrimary },
    ]),
    createSection(
      "Resistances",
      "resistances",
      entry.snapshot.resistances.map((value) => ({ value }))
    ),
    createSection(
      "Combat Summary",
      "combat_summary",
      entry.snapshot.combatSummary.map((field) => ({
        label: field.label,
        value: `${field.value}`,
      }))
    ),
    createSection(
      "Stats",
      "stats",
      entry.snapshot.stats.map((field) => ({
        label: field.label,
        value: `${field.value}`,
      }))
    ),
    createSection(
      "Skills",
      "skills",
      entry.snapshot.skills.map((field) => ({
        label: field.label,
        value: `${field.value}`,
      }))
    ),
    createSection("Powers", "powers", entry.snapshot.powers.map((value) => ({ value }))),
    createSection("Specials", "specials", entry.snapshot.specials.map((value) => ({ value }))),
    createSection("Notes", "notes", entry.snapshot.notes.map((value) => ({ value }))),
  ];

  return sections.filter((section): section is KnowledgeRevisionSection => section !== null);
}

function ensureCharacterKnowledgeEntity(args: {
  state: KnowledgeState;
  targetCharacter: CharacterRecord;
  now?: Date;
}): { entity: KnowledgeEntity } {
  const now = args.now ?? new Date();
  const existingEntity = findKnowledgeEntityBySubjectKey(
    args.state,
    "character",
    args.targetCharacter.id
  );

  if (!existingEntity) {
    return {
      entity: createKnowledgeEntity({
        type: "character",
        subjectKey: args.targetCharacter.id,
        displayName: args.targetCharacter.sheet.name.trim() || args.targetCharacter.id,
        now,
      }),
    };
  }

  return {
    entity: {
      ...existingEntity,
      displayName: args.targetCharacter.sheet.name.trim() || args.targetCharacter.id,
      updatedAt: getIsoTimestamp(now),
    },
  };
}

function ensureItemKnowledgeEntity(args: {
  state: KnowledgeState;
  item: SharedItemRecord;
  now?: Date;
}): { entity: KnowledgeEntity; existed: boolean } {
  const now = args.now ?? new Date();
  const existingEntity = findKnowledgeEntityBySubjectKey(args.state, "item", args.item.id);

  if (!existingEntity) {
    return {
      entity: createKnowledgeEntity({
        type: "item",
        subjectKey: args.item.id,
        displayName: args.item.name.trim() || args.item.id,
        now,
      }),
      existed: false,
    };
  }

  return {
    entity: {
      ...existingEntity,
      displayName: args.item.name.trim() || args.item.id,
      updatedAt: getIsoTimestamp(now),
    },
    existed: true,
  };
}

export function createKnowledgeRevisionBatch(args: {
  state: KnowledgeState;
  entity:
    | KnowledgeEntity
    | {
        type: KnowledgeEntity["type"];
        subjectKey: string | null;
        displayName: string;
      };
  ownerCharacterId: string;
  createdByCharacterId: string | null;
  title: string;
  summary: string;
  content: KnowledgeRevisionSection[];
  tags: string[];
  sourceType: KnowledgeSourceType;
  sourceSpellName?: string | null;
  sourceHistoryEntryId?: string | null;
  parentRevisionId?: string | null;
  lineageMode: KnowledgeLineageMode;
  isCanonical: boolean;
  acquiredFromCharacterId?: string | null;
  now?: Date;
}): {
  entity: KnowledgeEntity;
  revision: KnowledgeRevision;
  ownership: KnowledgeOwnership;
  batch: KnowledgeBatch;
} {
  const now = args.now ?? new Date();
  const nextEntity =
    "id" in args.entity
      ? {
          ...args.entity,
          displayName: args.entity.displayName.trim(),
          updatedAt: getIsoTimestamp(now),
        }
      : createKnowledgeEntity({
          type: args.entity.type,
          subjectKey: args.entity.subjectKey,
          displayName: args.entity.displayName.trim(),
          now,
        });
  const revision = createKnowledgeRevision({
    entityId: nextEntity.id,
    revisionNumber: getNextKnowledgeRevisionNumber(args.state, nextEntity.id),
    title: args.title,
    summary: args.summary,
    content: args.content,
    tags: args.tags,
    createdAt: getIsoTimestamp(now),
    createdByCharacterId: args.createdByCharacterId,
    sourceType: args.sourceType,
    sourceSpellName: args.sourceSpellName ?? null,
    sourceHistoryEntryId: args.sourceHistoryEntryId ?? null,
    parentRevisionId: args.parentRevisionId ?? null,
    lineageMode: args.lineageMode,
    isCanonical: args.isCanonical,
  });
  const ownership = createKnowledgeOwnership({
    ownerCharacterId: args.ownerCharacterId,
    revisionId: revision.id,
    acquiredAt: getIsoTimestamp(now),
    acquiredFromCharacterId: args.acquiredFromCharacterId ?? null,
  });

  return {
    entity: nextEntity,
    revision,
    ownership,
    batch: {
      entities: [nextEntity],
      revisions: [revision],
      ownerships: [ownership],
    },
  };
}

export function buildCharacterKnowledgeDraftFromSheet(
  character: CharacterRecord,
  itemsById: Record<string, SharedItemRecord> = {}
): Pick<KnowledgeRevision, "title" | "summary" | "content" | "tags"> {
  const derived = buildCharacterDerivedValues(character.sheet, itemsById);
  const snapshot = buildCharacterEncounterSnapshot(character.sheet, itemsById);
  const progression = getCrAndRankFromXpUsed(character.sheet.xpUsed);
  const sections = [
    createSection("Summary", "summary", [
      { label: "Rank", value: progression.rank },
      { label: "CR", value: `${progression.cr}` },
      { label: "Concept", value: character.sheet.concept },
      { label: "Faction", value: character.sheet.faction },
      { label: "Age", value: character.sheet.age === null ? "" : `${character.sheet.age}` },
      {
        label: "Karma",
        value: `-${character.sheet.negativeKarma} / +${character.sheet.positiveKarma}`,
      },
    ]),
    createSection("Biography", "biography", [
      { value: character.sheet.biographyPrimary },
      { value: character.sheet.biographySecondary },
    ]),
    createSection(
      "Resistances",
      "resistances",
      snapshot.visibleResistances.map((resistance) => ({
        value: `${resistance.label}: ${resistance.levelLabel} ${resistance.multiplierLabel}`,
      }))
    ),
    createSection(
      "Combat Summary",
      "combat_summary",
      snapshot.combatSummary.map((field) => ({
        label: field.label,
        value: `${field.value}`,
      }))
    ),
    createSection(
      "Stats",
      "stats",
      snapshot.stats.map((field) => ({
        label: field.label,
        value: `${field.value}`,
      }))
    ),
    createSection(
      "Skills",
      "skills",
      character.sheet.skills.map((skill) => ({
        label: skill.label,
        value: `${skill.base}`,
      }))
    ),
    createSection(
      "Powers",
      "powers",
      character.sheet.powers.map((power) => ({ value: `${power.name} Lv ${power.level}` }))
    ),
    createSection(
      "Specials",
      "specials",
      character.sheet.statusTags.map((tag) => ({ value: tag.label }))
    ),
    createSection("Notes", "notes", [
      { value: `HP ${character.sheet.currentHp} / ${derived.maxHp}` },
      { value: `Mana ${derived.currentMana} / ${derived.maxMana}` },
      { value: `Inspiration ${derived.totalInspiration}` },
    ]),
  ].filter((section): section is KnowledgeRevisionSection => section !== null);

  return {
    title: `${character.sheet.name.trim() || character.id} Card`,
    summary: `CR ${progression.cr}, Rank ${progression.rank}`,
    content: sections,
    tags: ["character"],
  };
}

export function buildItemKnowledgeDraftFromItem(
  item: SharedItemRecord,
  context: ItemKnowledgeContext = {}
): Pick<KnowledgeRevision, "title" | "summary" | "content" | "tags"> {
  const sections = [
    createSection("Summary", "summary", [
      { label: "Blueprint", value: getItemBlueprintLabel(item, context.itemBlueprints) },
      { label: "Tier", value: getItemTierLabel(item) },
      { label: "Property Points", value: `${getItemPropertyPoints(item)}` },
    ]),
    createSection(
      "Visible Properties",
      "combat_summary",
      getItemBaseVisibleStats(item, context).map((value) => ({ value }))
    ),
    createSection(
      "Identified Bonuses",
      "specials",
      getItemCompactBonusSummary(item).map((value) => ({ value }))
    ),
    createSection(
      "Requirements",
      "custom",
      item.requirements.map((value) => ({ value }))
    ),
    createSection(
      "Visible Notes",
      "notes",
      item.visibleNotes.map((value) => ({ value }))
    ),
    createSection("Description", "biography", [{ value: item.baseDescription }]),
  ].filter((section): section is KnowledgeRevisionSection => section !== null);

  return {
    title: `${item.name.trim() || item.id} Card`,
    summary: getItemCompactHeaderSummary(item, { ...context, includeBonus: false }),
    content: sections,
    tags: ["item", item.blueprintId],
  };
}

export function createCharacterKnowledgeRevision(args: CreateCharacterKnowledgeRevisionArgs & {
  state: KnowledgeState;
}): { entity: KnowledgeEntity; revision: KnowledgeRevision; batch: KnowledgeBatch } {
  const now = args.now ?? new Date();
  const { entity } = ensureCharacterKnowledgeEntity({
    state: args.state,
    targetCharacter: args.targetCharacter,
    now,
  });
  const draft = buildCharacterKnowledgeDraftFromSheet(args.targetCharacter, args.itemsById ?? {});
  const revision = createKnowledgeRevision({
    entityId: entity.id,
    revisionNumber: getNextKnowledgeRevisionNumber(args.state, entity.id),
    title: draft.title,
    summary: draft.summary,
    content: draft.content,
    tags: draft.tags,
    createdAt: getIsoTimestamp(now),
    createdByCharacterId: args.createdByCharacterId,
    sourceType: args.sourceType,
    sourceSpellName: args.sourceSpellName ?? null,
    sourceHistoryEntryId: args.historyEntryId,
    parentRevisionId: args.parentRevisionId ?? null,
    lineageMode: args.lineageMode,
    isCanonical: args.isCanonical,
    id: args.revisionId,
  });

  return {
    entity,
    revision,
    batch: {
      entities: [entity],
      revisions: [revision],
      ownerships: [],
    },
  };
}

export function createItemKnowledgeRevision(args: {
  state: KnowledgeState;
  item: SharedItemRecord;
  createdByCharacterId: string | null;
  sourceType: KnowledgeSourceType;
  sourceSpellName?: string | null;
  parentRevisionId?: string | null;
  lineageMode?: KnowledgeLineageMode;
  isCanonical?: boolean;
  context?: ItemKnowledgeContext;
  now?: Date;
}): { entity: KnowledgeEntity; revision: KnowledgeRevision; batch: KnowledgeBatch } {
  const now = args.now ?? new Date();
  const { entity, existed } = ensureItemKnowledgeEntity({
    state: args.state,
    item: args.item,
    now,
  });
  const draft = buildItemKnowledgeDraftFromItem(args.item, args.context);
  const revision = createKnowledgeRevision({
    entityId: entity.id,
    revisionNumber: getNextKnowledgeRevisionNumber(args.state, entity.id),
    title: draft.title,
    summary: draft.summary,
    content: draft.content,
    tags: draft.tags,
    createdAt: getIsoTimestamp(now),
    createdByCharacterId: args.createdByCharacterId,
    sourceType: args.sourceType,
    sourceSpellName: args.sourceSpellName ?? null,
    sourceHistoryEntryId: null,
    parentRevisionId: args.parentRevisionId ?? null,
    lineageMode: args.lineageMode ?? (existed ? "updated_scan" : "observed"),
    isCanonical: args.isCanonical !== false,
  });

  return {
    entity,
    revision,
    batch: {
      entities: [entity],
      revisions: [revision],
      ownerships: [],
    },
  };
}

export function buildLinkedCharacterKnowledgeBatchFromIntelEntry(args: {
  state: KnowledgeState;
  casterCharacter: CharacterRecord;
  targetCharacter: CharacterRecord;
  entry: GameHistoryIntelSnapshotEntry;
  now?: Date;
}): { batch: KnowledgeBatch; entry: GameHistoryEntry } {
  const now = args.now ?? new Date();
  const { entity } = ensureCharacterKnowledgeEntity({
    state: args.state,
    targetCharacter: args.targetCharacter,
    now,
  });
  const revision = createKnowledgeRevision({
    entityId: entity.id,
    revisionNumber: getNextKnowledgeRevisionNumber(args.state, entity.id),
    title: `${entity.displayName} Card`,
    summary: args.entry.summary,
    content: buildCharacterKnowledgeSectionsFromIntelEntry(args.entry),
    tags: ["character", "assess_character"],
    createdAt: getIsoTimestamp(now),
    createdByCharacterId: args.casterCharacter.id,
    sourceType: "spell",
    sourceSpellName: args.entry.sourcePower,
    sourceHistoryEntryId: args.entry.id,
    parentRevisionId: null,
    lineageMode:
      findKnowledgeEntityBySubjectKey(args.state, "character", args.targetCharacter.id) === null
        ? "observed"
        : "updated_scan",
    isCanonical: true,
  });
  const ownership = createKnowledgeOwnership({
    ownerCharacterId: args.casterCharacter.id,
    revisionId: revision.id,
    acquiredAt: getIsoTimestamp(now),
    acquiredFromCharacterId: null,
  });
  const knowledgeLink = buildKnowledgeHistoryLink(entity, revision);

  return {
    batch: {
      entities: [entity],
      revisions: [revision],
      ownerships: [ownership],
    },
    entry: {
      ...args.entry,
      knowledgeLink,
    },
  };
}

export function buildCharacterKnowledgeBatchFromAssessCharacter(args: {
  casterCharacter: CharacterRecord;
  targetCharacter: CharacterRecord;
  state: KnowledgeState;
  itemsById?: Record<string, SharedItemRecord>;
  now?: Date;
}): { batch: KnowledgeBatch; historyEntry: GameHistoryEntry } {
  const now = args.now ?? new Date();
  const baseHistoryEntry = buildAssessCharacterHistoryEntry(
    args.casterCharacter.sheet,
    args.targetCharacter,
    formatActualDateTime(now),
    args.itemsById ?? {}
  );

  if (baseHistoryEntry.type !== "intel_snapshot") {
    return {
      batch: { entities: [], revisions: [], ownerships: [] },
      historyEntry: baseHistoryEntry,
    };
  }

  const existingEntity = findKnowledgeEntityBySubjectKey(
    args.state,
    "character",
    args.targetCharacter.id
  );
  const entity =
    existingEntity === null
      ? createKnowledgeEntity({
          type: "character",
          subjectKey: args.targetCharacter.id,
          displayName: args.targetCharacter.sheet.name.trim() || args.targetCharacter.id,
          now,
        })
      : {
          ...existingEntity,
          displayName: args.targetCharacter.sheet.name.trim() || args.targetCharacter.id,
          updatedAt: getIsoTimestamp(now),
        };
  const revision = createKnowledgeRevision({
    entityId: entity.id,
    revisionNumber: getNextKnowledgeRevisionNumber(args.state, entity.id),
    title: `${entity.displayName} Card`,
    summary: baseHistoryEntry.summary,
    content: buildCharacterKnowledgeSectionsFromIntelEntry(baseHistoryEntry),
    tags: ["character", "assess_character"],
    createdAt: getIsoTimestamp(now),
    createdByCharacterId: args.casterCharacter.id,
    sourceType: "spell",
    sourceSpellName: baseHistoryEntry.sourcePower,
    sourceHistoryEntryId: baseHistoryEntry.id,
    lineageMode: existingEntity === null ? "observed" : "updated_scan",
    isCanonical: true,
  });
  const ownership = createKnowledgeOwnership({
    ownerCharacterId: args.casterCharacter.id,
    revisionId: revision.id,
    acquiredAt: getIsoTimestamp(now),
    acquiredFromCharacterId: null,
  });
  const knowledgeLink = buildKnowledgeHistoryLink(entity, revision);

  return {
    batch: {
      entities: [entity],
      revisions: [revision],
      ownerships: [ownership],
    },
    historyEntry: {
      ...baseHistoryEntry,
      knowledgeLink,
    },
  };
}

export function getKnowledgeGroupsForOwner(
  state: KnowledgeState,
  ownerCharacterId: string
): KnowledgeOwnerGroup[] {
  const indexes = buildKnowledgeIndexes(state);
  const ownerships = indexes.ownershipsByOwnerId.get(ownerCharacterId) ?? [];
  const groups = new Map<string, KnowledgeOwnerGroup>();

  ownerships.forEach((ownership) => {
    const revision = indexes.revisionById.get(ownership.revisionId);
    if (!revision) {
      return;
    }

    const entity = indexes.entityById.get(revision.entityId);
    if (!entity) {
      return;
    }

    const currentGroup = groups.get(entity.id) ?? {
      entity,
      revisions: [],
    };
    currentGroup.revisions.push({
      entity,
      revision,
      ownership,
      displayLabel: getKnowledgeOwnershipDisplayLabel(ownership, entity, revision),
    });
    groups.set(entity.id, currentGroup);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      revisions: [...group.revisions].sort((left, right) => {
        if (left.ownership.isPinned !== right.ownership.isPinned) {
          return left.ownership.isPinned ? -1 : 1;
        }

        return right.revision.revisionNumber - left.revision.revisionNumber;
      }),
    }))
    .sort((left, right) => {
      const leftPinned = left.revisions.some((entry) => entry.ownership.isPinned);
      const rightPinned = right.revisions.some((entry) => entry.ownership.isPinned);
      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }

      return left.entity.displayName.localeCompare(right.entity.displayName);
    });
}

export function buildKnowledgeAcquiredHistoryEntry(args: {
  note: string;
  knowledgeLink: KnowledgeHistoryLink;
  gameDateTime: string;
  now?: Date;
}): GameHistoryEntry {
  return {
    id: createTimestampedId("history-note"),
    type: "note",
    actualDateTime: formatActualDateTime(args.now ?? new Date()),
    gameDateTime: args.gameDateTime,
    note: args.note.trim(),
    knowledgeLink: args.knowledgeLink,
  };
}

export function createDuplicateKnowledgeBatch(args: {
  state: KnowledgeState;
  entity: KnowledgeEntity;
  revision: KnowledgeRevision;
  ownerCharacterId: string;
  acquiredFromCharacterId?: string | null;
  now?: Date;
}): KnowledgeBatch {
  const now = args.now ?? new Date();
  const nextRevision = createKnowledgeRevision({
    entityId: args.entity.id,
    revisionNumber: getNextKnowledgeRevisionNumber(args.state, args.entity.id),
    title: args.revision.title,
    summary: args.revision.summary,
    content: args.revision.content,
    tags: args.revision.tags,
    createdAt: getIsoTimestamp(now),
    createdByCharacterId: args.ownerCharacterId,
    sourceType: "manual_edit",
    sourceSpellName: null,
    sourceHistoryEntryId: null,
    parentRevisionId: args.revision.id,
    lineageMode: "copied",
    isCanonical: false,
  });
  const ownership = createKnowledgeOwnership({
    ownerCharacterId: args.ownerCharacterId,
    revisionId: nextRevision.id,
    acquiredAt: getIsoTimestamp(now),
    acquiredFromCharacterId: args.acquiredFromCharacterId ?? null,
  });

  return {
    entities: [],
    revisions: [nextRevision],
    ownerships: [ownership],
  };
}

export function createEditedKnowledgeBatch(args: {
  state: KnowledgeState;
  entity: KnowledgeEntity;
  parentRevision: KnowledgeRevision | null;
  ownerCharacterId: string;
  title: string;
  summary: string;
  content: KnowledgeRevisionSection[];
  tags: string[];
  sourceType: KnowledgeSourceType;
  isCanonical: boolean;
  now?: Date;
}): KnowledgeBatch {
  const now = args.now ?? new Date();
  const nextRevision = createKnowledgeRevision({
    entityId: args.entity.id,
    revisionNumber: getNextKnowledgeRevisionNumber(args.state, args.entity.id),
    title: args.title,
    summary: args.summary,
    content: args.content,
    tags: args.tags,
    createdAt: getIsoTimestamp(now),
    createdByCharacterId: args.ownerCharacterId,
    sourceType: args.sourceType,
    sourceSpellName: null,
    sourceHistoryEntryId: null,
    parentRevisionId: args.parentRevision?.id ?? null,
    lineageMode: args.parentRevision ? "edited_copy" : "observed",
    isCanonical: args.isCanonical,
  });
  const ownership = createKnowledgeOwnership({
    ownerCharacterId: args.ownerCharacterId,
    revisionId: nextRevision.id,
    acquiredAt: getIsoTimestamp(now),
    acquiredFromCharacterId: null,
  });

  return {
    entities: [],
    revisions: [nextRevision],
    ownerships: [ownership],
  };
}

export function createKnowledgeShareResult(args: {
  state: KnowledgeState;
  entity: KnowledgeEntity;
  revision: KnowledgeRevision;
  sourceOwnerCharacterId?: string | null;
  sourceOwnerName: string;
  recipientCharacters: CharacterRecord[];
  cardLabel?: string;
  now?: Date;
}): {
  batch: KnowledgeBatch;
  historyEntries: Array<{ characterId: string; entry: GameHistoryEntry }>;
} {
  const now = args.now ?? new Date();
  const indexes = buildKnowledgeIndexes(args.state);
  const knowledgeLink = buildKnowledgeHistoryLink(args.entity, args.revision);
  const ownerships = args.recipientCharacters.flatMap((character) => {
    const existingOwnership = indexes.ownershipByOwnerAndRevisionId.get(
      `${character.id}:${args.revision.id}`
    );

    if (existingOwnership) {
      return [];
    }

    return [
      createKnowledgeOwnership({
        ownerCharacterId: character.id,
        revisionId: args.revision.id,
        acquiredAt: getIsoTimestamp(now),
        acquiredFromCharacterId: args.sourceOwnerCharacterId ?? null,
      }),
    ];
  });

  return {
    batch: {
      entities: [],
      revisions: [],
      ownerships,
    },
    historyEntries: ownerships.map((ownership) => {
      const recipient = args.recipientCharacters.find(
        (character) => character.id === ownership.ownerCharacterId
      );
      return {
        characterId: ownership.ownerCharacterId,
        entry: buildKnowledgeAcquiredHistoryEntry({
          note: `Acquired ${args.cardLabel ?? "character card"} ${args.entity.displayName} from ${args.sourceOwnerName}.`,
          knowledgeLink,
          gameDateTime: recipient?.sheet.gameDateTime ?? "",
          now,
        }),
      };
    }),
  };
}

export function createItemKnowledgeShareResult(args: {
  state: KnowledgeState;
  item: SharedItemRecord;
  entity: KnowledgeEntity;
  revision: KnowledgeRevision;
  sourceOwnerCharacterId?: string | null;
  sourceOwnerName: string;
  recipientCharacters: CharacterRecord[];
  now?: Date;
}): {
  batch: KnowledgeBatch;
  historyEntries: Array<{ characterId: string; entry: GameHistoryEntry }>;
  item: SharedItemRecord;
} {
  const shareResult = createKnowledgeShareResult({
    state: args.state,
    entity: args.entity,
    revision: args.revision,
    sourceOwnerCharacterId: args.sourceOwnerCharacterId ?? null,
    sourceOwnerName: args.sourceOwnerName,
    recipientCharacters: args.recipientCharacters,
    cardLabel: "item card",
    now: args.now,
  });

  return {
    ...shareResult,
    item: args.recipientCharacters.reduce(
      (currentItem, character) => identifyItemForCharacter(currentItem, character.id),
      args.item
    ),
  };
}

export function toggleKnowledgeOwnershipPinned(
  ownership: KnowledgeOwnership
): KnowledgeOwnership {
  return {
    ...ownership,
    isPinned: !ownership.isPinned,
  };
}

export function toggleKnowledgeOwnershipArchived(
  ownership: KnowledgeOwnership
): KnowledgeOwnership {
  return {
    ...ownership,
    isArchived: !ownership.isArchived,
  };
}

export function renameKnowledgeOwnership(
  ownership: KnowledgeOwnership,
  localLabel: string
): KnowledgeOwnership {
  return {
    ...ownership,
    localLabel: localLabel.trim(),
  };
}
