import {
  PLAYER_CHARACTER_TEMPLATE,
  hydrateCharacterDraft,
  normalizeCharacterDraft,
  type CharacterDraft,
  type StatId,
} from "../config/characterTemplate.ts";
import { buildCharacterDerivedValues } from "../config/characterRuntime.ts";
import { getIsoTimestamp, createTimestampedId } from "./ids.ts";
import { buildEncounterParticipantInput } from "../rules/combatEncounter.ts";
import type { SharedItemRecord } from "../types/items.ts";
import {
  AUTHORING_SCHEMA_VERSION,
  type CodexImportPayload,
  type CodexRequestPacket,
  type CodexRequestPacketDifficulty,
  type ContentImportProvenance,
  type ContentSourceKind,
  type ContentStatus,
  type EncounterOwnedMobInstance,
  type MobGroup,
  type MobGroupMember,
  type MobGroupMemberSheetOverrides,
  type MobRole,
  type MobTemplate,
  type PortalStage,
  type PortalTemplate,
  type SupabaseReadyContentRow,
  isContentSourceKind,
  isContentStatus,
  isMobRole,
} from "../types/authoring.ts";
import { STAT_IDS, isStatId } from "../types/character.ts";

export type AuthoringContentState = {
  mobTemplates: MobTemplate[];
  mobGroups: MobGroup[];
  portalTemplates: PortalTemplate[];
};

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;
}

function asNullableInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : null;
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))];
}

function normalizePositiveInt(value: number, fallback = 1): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function normalizeNonNegativeInt(value: number, fallback = 0): number {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : fallback;
}

function normalizeNullableNonNegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null;
}

function normalizeStatus(value: unknown): ContentStatus {
  return isContentStatus(value) ? value : "draft";
}

function normalizeSourceKind(value: unknown): ContentSourceKind {
  return isContentSourceKind(value) ? value : "manual";
}

function normalizeRole(value: unknown): MobRole {
  return isMobRole(value) ? value : "brute";
}

function normalizeImportProvenance(value: unknown): ContentImportProvenance | null {
  if (!isRecord(value)) {
    return null;
  }

  const importedAt = asString(value.importedAt).trim();
  if (!importedAt) {
    return null;
  }

  return {
    importedAt,
    rawPayload: typeof value.rawPayload === "string" ? value.rawPayload : null,
  };
}

function buildBaseContentMetadata(
  prefix: string,
  name: string,
  status: ContentStatus = "draft",
  sourceKind: ContentSourceKind = "manual"
) {
  const iso = getIsoTimestamp();
  return {
    id: createTimestampedId(prefix),
    name,
    status,
    version: 1,
    sourceKind,
    createdAt: iso,
    updatedAt: iso,
    importProvenance: null as ContentImportProvenance | null,
  };
}

function buildBlankMobSheet(): CharacterDraft {
  const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
  sheet.name = "New Mob";
  sheet.currentMana = 0;
  sheet.manaInitialized = true;
  return normalizeMobTemplateSheet(sheet);
}

function buildBlankPortalStage(index: number, isBossStage = false): PortalStage {
  return {
    id: createTimestampedId("portal-stage"),
    index,
    title: `Stage ${index}`,
    sceneText: "",
    environmentTags: [],
    groupReferences: [],
    targetChallengeRating: null,
    traps: "",
    chest: "",
    objective: "",
    isBossStage,
  };
}

function normalizeMobGroupMemberSheetOverrides(
  value: unknown
): MobGroupMemberSheetOverrides | null {
  if (!isRecord(value)) {
    return null;
  }

  const statBaseOverrides = Object.fromEntries(
    STAT_IDS.flatMap((statId) => {
      const nextValue = asNullableInt(value.statBaseOverrides && isRecord(value.statBaseOverrides) ? value.statBaseOverrides[statId] : undefined);
      return nextValue === null ? [] : [[statId, nextValue]];
    })
  ) as Partial<Record<StatId, number>>;
  const skillBaseOverrides = isRecord(value.skillBaseOverrides)
    ? Object.fromEntries(
        Object.entries(value.skillBaseOverrides)
          .filter(([, entryValue]) => typeof entryValue === "number" && Number.isFinite(entryValue))
          .map(([skillId, entryValue]) => [skillId, Math.trunc(entryValue as number)])
      )
    : {};

  const currentHp = asNullableInt(value.currentHp);
  const currentMana = asNullableInt(value.currentMana);
  const hasValues =
    currentHp !== null ||
    currentMana !== null ||
    Object.keys(statBaseOverrides).length > 0 ||
    Object.keys(skillBaseOverrides).length > 0;

  return hasValues
    ? {
        ...(currentHp !== null ? { currentHp } : {}),
        ...(currentMana !== null ? { currentMana } : {}),
        ...(Object.keys(statBaseOverrides).length > 0 ? { statBaseOverrides } : {}),
        ...(Object.keys(skillBaseOverrides).length > 0 ? { skillBaseOverrides } : {}),
      }
    : null;
}

function hydrateMobGroupMember(value: unknown): MobGroupMember | null {
  if (!isRecord(value)) {
    return null;
  }

  const mobTemplateId = asString(value.mobTemplateId).trim();
  if (!mobTemplateId) {
    return null;
  }

  return {
    id: asString(value.id).trim() || createTimestampedId("mob-group-member"),
    mobTemplateId,
    quantity: normalizePositiveInt(asInt(value.quantity, 1)),
    displayNameOverride: asString(value.displayNameOverride).trim(),
    notes: asString(value.notes).trim(),
    sheetOverrides: normalizeMobGroupMemberSheetOverrides(value.sheetOverrides),
  };
}

function hydratePortalStage(value: unknown, fallbackIndex = 1): PortalStage | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawGroupReferences = Array.isArray(value.groupReferences)
    ? value.groupReferences
    : Array.isArray(value.mobGroupIds)
      ? value.mobGroupIds.map((mobGroupId) => ({ mobGroupId, quantityMultiplier: 1, notes: "" }))
      : [];

  return {
    id: asString(value.id).trim() || createTimestampedId("portal-stage"),
    index: normalizePositiveInt(asInt(value.index, fallbackIndex), fallbackIndex),
    title: asString(value.title).trim() || `Stage ${fallbackIndex}`,
    sceneText: asString(value.sceneText),
    environmentTags: normalizeStringList(value.environmentTags),
    groupReferences: rawGroupReferences
      .map((entry) => {
        if (!isRecord(entry)) {
          return null;
        }

        const mobGroupId = asString(entry.mobGroupId || entry.groupId).trim();
        if (!mobGroupId) {
          return null;
        }

        return {
          id: asString(entry.id).trim() || createTimestampedId("portal-stage-group"),
          mobGroupId,
          quantityMultiplier: normalizePositiveInt(asInt(entry.quantityMultiplier, 1), 1),
          notes: asString(entry.notes).trim(),
        };
      })
      .filter((entry): entry is PortalStage["groupReferences"][number] => entry !== null),
    targetChallengeRating: normalizeNullableNonNegativeInt(value.targetChallengeRating),
    traps: asString(value.traps),
    chest: asString(value.chest),
    objective: asString(value.objective),
    isBossStage: value.isBossStage === true,
  };
}

function syncMobTemplateName(template: MobTemplate): MobTemplate {
  const nextName = template.name.trim() || template.sheet.name.trim() || "Unnamed Mob";
  return {
    ...template,
    name: nextName,
    sheet: normalizeMobTemplateSheet({
      ...template.sheet,
      name: nextName,
    }),
  };
}

export function normalizeMobTemplateSheet(sheet: CharacterDraft): CharacterDraft {
  const normalizedSheet = normalizeCharacterDraft(sheet);
  const derived = buildCharacterDerivedValues(normalizedSheet);

  return normalizeCharacterDraft({
    ...normalizedSheet,
    currentHp: Math.min(normalizedSheet.currentHp, derived.maxHp),
    currentMana: Math.min(normalizedSheet.currentMana, derived.maxMana),
  });
}

export function createEmptyMobTemplate(overrides: Partial<MobTemplate> = {}): MobTemplate {
  const base = {
    ...buildBaseContentMetadata("mob-template", "New Mob"),
    challengeRating: 1,
    themeTags: [] as string[],
    role: "brute" as MobRole,
    behaviorTags: [] as string[],
    loot: "",
    designerNotes: "",
    sheet: buildBlankMobSheet(),
  };

  return syncMobTemplateName({
    ...base,
    ...overrides,
    challengeRating: normalizeNonNegativeInt(
      asInt(overrides.challengeRating, base.challengeRating),
      base.challengeRating
    ),
    themeTags: normalizeStringList(overrides.themeTags ?? base.themeTags),
    behaviorTags: normalizeStringList(overrides.behaviorTags ?? base.behaviorTags),
    role: normalizeRole(overrides.role ?? base.role),
    status: normalizeStatus(overrides.status ?? base.status),
    sourceKind: normalizeSourceKind(overrides.sourceKind ?? base.sourceKind),
    version: normalizePositiveInt(asInt(overrides.version, base.version), 1),
    sheet: normalizeMobTemplateSheet(overrides.sheet ?? base.sheet),
    importProvenance: normalizeImportProvenance(overrides.importProvenance),
  });
}

export function hydrateMobTemplate(value: unknown): MobTemplate | null {
  if (!isRecord(value)) {
    return null;
  }

  return createEmptyMobTemplate({
    id: asString(value.id).trim() || createTimestampedId("mob-template"),
    name: asString(value.name).trim() || asString(isRecord(value.sheet) ? value.sheet.name : ""),
    themeTags: normalizeStringList(value.themeTags),
    status: normalizeStatus(value.status),
    version: normalizePositiveInt(asInt(value.version, 1), 1),
    sourceKind: normalizeSourceKind(value.sourceKind),
    createdAt: asString(value.createdAt).trim() || getIsoTimestamp(),
    updatedAt: asString(value.updatedAt).trim() || getIsoTimestamp(),
    challengeRating: normalizeNonNegativeInt(asInt(value.challengeRating, 1), 1),
    role: normalizeRole(value.role),
    behaviorTags: normalizeStringList(value.behaviorTags),
    loot: asString(value.loot),
    designerNotes: asString(value.designerNotes),
    sheet: hydrateCharacterDraft(value.sheet),
    importProvenance: normalizeImportProvenance(value.importProvenance),
  });
}

export function validateMobTemplate(template: MobTemplate): string[] {
  const errors: string[] = [];

  if (!template.name.trim()) {
    errors.push("Mob name is required.");
  }
  if (!template.sheet.name.trim()) {
    errors.push("Mob sheet name is required.");
  }
  if (template.version < 1) {
    errors.push("Mob version must be at least 1.");
  }
  if (template.challengeRating < 0) {
    errors.push("Mob challenge rating cannot be negative.");
  }

  return errors;
}

export function duplicateMobTemplate(template: MobTemplate): MobTemplate {
  return createEmptyMobTemplate({
    ...template,
    id: createTimestampedId("mob-template"),
    name: `${template.name} Copy`,
    version: 1,
    status: "draft",
    createdAt: getIsoTimestamp(),
    updatedAt: getIsoTimestamp(),
  });
}

export function createEmptyMobGroup(overrides: Partial<MobGroup> = {}): MobGroup {
  const base = {
    ...buildBaseContentMetadata("mob-group", "New Group"),
    themeTags: [] as string[],
    targetChallengeRating: null as number | null,
    partyMeanChallengeRating: null as number | null,
    tactics: "",
    encounterNotes: "",
    members: [] as MobGroupMember[],
  };

  return {
    ...base,
    ...overrides,
    themeTags: normalizeStringList(overrides.themeTags ?? base.themeTags),
    targetChallengeRating: normalizeNullableNonNegativeInt(overrides.targetChallengeRating),
    partyMeanChallengeRating: normalizeNullableNonNegativeInt(
      overrides.partyMeanChallengeRating
    ),
    status: normalizeStatus(overrides.status ?? base.status),
    sourceKind: normalizeSourceKind(overrides.sourceKind ?? base.sourceKind),
    version: normalizePositiveInt(asInt(overrides.version, base.version), 1),
    members: Array.isArray(overrides.members)
      ? overrides.members
          .map((entry) => hydrateMobGroupMember(entry))
          .filter((entry): entry is MobGroupMember => entry !== null)
      : base.members,
    importProvenance: normalizeImportProvenance(overrides.importProvenance),
  };
}

export function hydrateMobGroup(value: unknown): MobGroup | null {
  if (!isRecord(value)) {
    return null;
  }

  return createEmptyMobGroup({
    id: asString(value.id).trim() || createTimestampedId("mob-group"),
    name: asString(value.name).trim() || "New Group",
    themeTags: normalizeStringList(value.themeTags),
    status: normalizeStatus(value.status),
    version: normalizePositiveInt(asInt(value.version, 1), 1),
    sourceKind: normalizeSourceKind(value.sourceKind),
    createdAt: asString(value.createdAt).trim() || getIsoTimestamp(),
    updatedAt: asString(value.updatedAt).trim() || getIsoTimestamp(),
    targetChallengeRating: normalizeNullableNonNegativeInt(value.targetChallengeRating),
    partyMeanChallengeRating: normalizeNullableNonNegativeInt(value.partyMeanChallengeRating),
    tactics: asString(value.tactics),
    encounterNotes: asString(value.encounterNotes),
    members: Array.isArray(value.members) ? value.members : [],
    importProvenance: normalizeImportProvenance(value.importProvenance),
  });
}

export function validateMobGroup(
  group: MobGroup,
  mobTemplatesById: Map<string, MobTemplate> = new Map()
): string[] {
  const errors: string[] = [];

  if (!group.name.trim()) {
    errors.push("Group name is required.");
  }
  if (group.members.length === 0) {
    errors.push("Group must contain at least one member.");
  }

  group.members.forEach((member, index) => {
    if (member.quantity < 1) {
      errors.push(`Member ${index + 1} quantity must be at least 1.`);
    }
    if (mobTemplatesById.size > 0 && !mobTemplatesById.has(member.mobTemplateId)) {
      errors.push(`Member ${index + 1} references a missing mob template.`);
    }
  });

  return errors;
}

export function duplicateMobGroup(group: MobGroup): MobGroup {
  return createEmptyMobGroup({
    ...group,
    id: createTimestampedId("mob-group"),
    name: `${group.name} Copy`,
    members: group.members.map((member) => ({
      ...member,
      id: createTimestampedId("mob-group-member"),
    })),
    version: 1,
    status: "draft",
    createdAt: getIsoTimestamp(),
    updatedAt: getIsoTimestamp(),
  });
}

export function mergeMobGroups(
  targetGroup: MobGroup,
  sourceGroup: MobGroup
): MobGroup {
  return createEmptyMobGroup({
    ...targetGroup,
    members: [
      ...targetGroup.members,
      ...sourceGroup.members.map((member) => ({
        ...member,
        id: createTimestampedId("mob-group-member"),
      })),
    ],
    updatedAt: getIsoTimestamp(),
  });
}

export function createEmptyPortalTemplate(
  overrides: Partial<PortalTemplate> = {}
): PortalTemplate {
  const base = {
    ...buildBaseContentMetadata("portal-template", "New Portal"),
    theme: "",
    depth: 1,
    intro: "",
    partyMeanChallengeRating: null as number | null,
    closingReward: "",
    exitSummary: "",
    stages: [buildBlankPortalStage(1, false), buildBlankPortalStage(2, true)],
  };

  return {
    ...base,
    ...overrides,
    theme: asString(overrides.theme ?? base.theme),
    status: normalizeStatus(overrides.status ?? base.status),
    sourceKind: normalizeSourceKind(overrides.sourceKind ?? base.sourceKind),
    version: normalizePositiveInt(asInt(overrides.version, base.version), 1),
    depth: normalizePositiveInt(asInt(overrides.depth, base.depth), 1),
    partyMeanChallengeRating: normalizeNullableNonNegativeInt(
      overrides.partyMeanChallengeRating
    ),
    stages: Array.isArray(overrides.stages)
      ? overrides.stages
          .map((stage, index) => hydratePortalStage(stage, index + 1))
          .filter((stage): stage is PortalStage => stage !== null)
          .slice(0, 5)
      : base.stages,
    importProvenance: normalizeImportProvenance(overrides.importProvenance),
  };
}

export function hydratePortalTemplate(value: unknown): PortalTemplate | null {
  if (!isRecord(value)) {
    return null;
  }

  return createEmptyPortalTemplate({
    id: asString(value.id).trim() || createTimestampedId("portal-template"),
    name: asString(value.name).trim() || "New Portal",
    theme: asString(value.theme),
    depth: normalizePositiveInt(asInt(value.depth, 1), 1),
    status: normalizeStatus(value.status),
    version: normalizePositiveInt(asInt(value.version, 1), 1),
    sourceKind: normalizeSourceKind(value.sourceKind),
    createdAt: asString(value.createdAt).trim() || getIsoTimestamp(),
    updatedAt: asString(value.updatedAt).trim() || getIsoTimestamp(),
    intro: asString(value.intro),
    partyMeanChallengeRating: normalizeNullableNonNegativeInt(value.partyMeanChallengeRating),
    closingReward: asString(value.closingReward),
    exitSummary: asString(value.exitSummary),
    stages: Array.isArray(value.stages) ? value.stages : [],
    importProvenance: normalizeImportProvenance(value.importProvenance),
  });
}

export function validatePortalTemplate(
  portal: PortalTemplate,
  mobGroupsById: Map<string, MobGroup> = new Map()
): string[] {
  const errors: string[] = [];

  if (!portal.name.trim()) {
    errors.push("Portal name is required.");
  }
  if (!portal.theme.trim()) {
    errors.push("Portal theme is required.");
  }
  if (portal.stages.length < 2 || portal.stages.length > 5) {
    errors.push("Portal must contain between 2 and 5 stages.");
  }
  portal.stages.forEach((stage, index) => {
    if (stage.index !== index + 1) {
      errors.push(`Stage ${index + 1} index must match its order.`);
    }
    if (stage.groupReferences.some((reference) => !reference.mobGroupId.trim())) {
      errors.push(`Stage ${index + 1} contains an empty group reference.`);
    }
    if (
      mobGroupsById.size > 0 &&
      stage.groupReferences.some((reference) => !mobGroupsById.has(reference.mobGroupId))
    ) {
      errors.push(`Stage ${index + 1} references a missing mob group.`);
    }
    if (stage.groupReferences.some((reference) => reference.quantityMultiplier < 1)) {
      errors.push(`Stage ${index + 1} quantity multipliers must be at least 1.`);
    }
  });

  if (portal.stages.length > 0) {
    const finalStageIndex = portal.stages.length - 1;
    portal.stages.forEach((stage, index) => {
      if (index === finalStageIndex && !stage.isBossStage) {
        errors.push("The final portal stage must be marked as the boss stage.");
      }
      if (index !== finalStageIndex && stage.isBossStage) {
        errors.push("Only the final portal stage may be marked as the boss stage.");
      }
    });
  }

  if (portal.status === "published") {
    if (!portal.closingReward.trim()) {
      errors.push("Published portals must include a closing reward.");
    }
    if (!portal.exitSummary.trim()) {
      errors.push("Published portals must include an exit summary.");
    }
  }

  return errors;
}

export function duplicatePortalTemplate(portal: PortalTemplate): PortalTemplate {
  return createEmptyPortalTemplate({
    ...portal,
    id: createTimestampedId("portal-template"),
    name: `${portal.name} Copy`,
    stages: portal.stages.map((stage, index) => ({
      ...stage,
      id: createTimestampedId("portal-stage"),
      index: index + 1,
      groupReferences: stage.groupReferences.map((reference) => ({
        ...reference,
        id: createTimestampedId("portal-stage-group"),
      })),
    })),
    version: 1,
    status: "draft",
    createdAt: getIsoTimestamp(),
    updatedAt: getIsoTimestamp(),
  });
}

export function createEmptyAuthoringState(): AuthoringContentState {
  return {
    mobTemplates: [],
    mobGroups: [],
    portalTemplates: [],
  };
}

export function getMobTemplateChallengeRating(mobTemplate: MobTemplate): number {
  return normalizeNonNegativeInt(mobTemplate.challengeRating, 1);
}

export function getMobGroupComputedChallengeRating(
  group: MobGroup,
  mobTemplatesById: Map<string, MobTemplate> = new Map()
): number {
  return group.members.reduce((total, member) => {
    const mobTemplate = mobTemplatesById.get(member.mobTemplateId);
    if (!mobTemplate) {
      return total;
    }

    return total + getMobTemplateChallengeRating(mobTemplate) * normalizePositiveInt(member.quantity, 1);
  }, 0);
}

export function getPortalStageComputedChallengeRating(
  stage: PortalStage,
  mobGroupsById: Map<string, MobGroup> = new Map(),
  mobTemplatesById: Map<string, MobTemplate> = new Map()
): number {
  return stage.groupReferences.reduce((total, reference) => {
    const group = mobGroupsById.get(reference.mobGroupId);
    if (!group) {
      return total;
    }

    return (
      total +
      getMobGroupComputedChallengeRating(group, mobTemplatesById) *
        normalizePositiveInt(reference.quantityMultiplier, 1)
    );
  }, 0);
}

function buildMobTemplatePromptSummary(template: MobTemplate) {
  return {
    id: template.id,
    name: template.name,
    challengeRating: getMobTemplateChallengeRating(template),
    status: template.status,
    themeTags: [...template.themeTags],
    role: template.role,
    behaviorTags: [...template.behaviorTags],
    loot: template.loot,
    designerNotes: template.designerNotes,
    sheet: {
      name: template.sheet.name,
      concept: template.sheet.concept,
      faction: template.sheet.faction,
      apparelMode: template.sheet.apparelMode,
      currentHp: template.sheet.currentHp,
      currentMana: template.sheet.currentMana,
      statBases: Object.fromEntries(
        STAT_IDS.map((statId) => [statId, template.sheet.statState[statId].base])
      ),
      skillBases: Object.fromEntries(
        template.sheet.skills.map((skill) => [skill.id, skill.base])
      ),
      powers: template.sheet.powers.map((power) => ({
        id: power.id,
        name: power.name,
        level: power.level,
        governingStat: power.governingStat,
      })),
      statusTags: template.sheet.statusTags.map((tag) => tag.label),
      effects: [...template.sheet.effects],
    },
  };
}

function buildMobGroupPromptSummary(
  group: MobGroup,
  mobTemplatesById: Map<string, MobTemplate> = new Map()
) {
  return {
    id: group.id,
    name: group.name,
    status: group.status,
    themeTags: [...group.themeTags],
    targetChallengeRating: group.targetChallengeRating,
    partyMeanChallengeRating: group.partyMeanChallengeRating,
    computedChallengeRating: getMobGroupComputedChallengeRating(group, mobTemplatesById),
    tactics: group.tactics,
    encounterNotes: group.encounterNotes,
    members: group.members.map((member) => {
      const mobTemplate = mobTemplatesById.get(member.mobTemplateId);
      return {
        mobTemplateId: member.mobTemplateId,
        mobName: mobTemplate?.name ?? "",
        mobChallengeRating: mobTemplate ? getMobTemplateChallengeRating(mobTemplate) : null,
        quantity: member.quantity,
        displayNameOverride: member.displayNameOverride,
        notes: member.notes,
        sheetOverrides: member.sheetOverrides,
      };
    }),
  };
}

function buildPortalTemplatePromptSummary(
  portal: PortalTemplate,
  mobGroupsById: Map<string, MobGroup> = new Map(),
  mobTemplatesById: Map<string, MobTemplate> = new Map()
) {
  return {
    id: portal.id,
    name: portal.name,
    theme: portal.theme,
    depth: portal.depth,
    status: portal.status,
    intro: portal.intro,
    partyMeanChallengeRating: portal.partyMeanChallengeRating,
    closingReward: portal.closingReward,
    exitSummary: portal.exitSummary,
    stages: portal.stages.map((stage) => ({
      id: stage.id,
      index: stage.index,
      title: stage.title,
      sceneText: stage.sceneText,
      environmentTags: [...stage.environmentTags],
      objective: stage.objective,
      targetChallengeRating: stage.targetChallengeRating,
      computedChallengeRating: getPortalStageComputedChallengeRating(
        stage,
        mobGroupsById,
        mobTemplatesById
      ),
      isBossStage: stage.isBossStage,
      groups: stage.groupReferences.map((reference) => {
        const group = mobGroupsById.get(reference.mobGroupId);
        return {
          mobGroupId: reference.mobGroupId,
          groupName: group?.name ?? "",
          groupChallengeRating: group
            ? getMobGroupComputedChallengeRating(group, mobTemplatesById)
            : null,
          quantityMultiplier: reference.quantityMultiplier,
          notes: reference.notes,
        };
      }),
      traps: stage.traps,
      chest: stage.chest,
    })),
  };
}

export function getMobTemplatePromptSummary(template: MobTemplate) {
  return buildMobTemplatePromptSummary(template);
}

export function getMobGroupPromptSummary(
  group: MobGroup,
  mobTemplatesById: Map<string, MobTemplate> = new Map()
) {
  return buildMobGroupPromptSummary(group, mobTemplatesById);
}

export function getPortalTemplatePromptSummary(
  portal: PortalTemplate,
  mobGroupsById: Map<string, MobGroup> = new Map(),
  mobTemplatesById: Map<string, MobTemplate> = new Map()
) {
  return buildPortalTemplatePromptSummary(portal, mobGroupsById, mobTemplatesById);
}

function applyMemberSheetOverrides(
  sheet: CharacterDraft,
  overrides: MobGroupMemberSheetOverrides | null
): CharacterDraft {
  if (!overrides) {
    return normalizeCharacterDraft(sheet);
  }

  let nextSheet = hydrateCharacterDraft(sheet);

  if (typeof overrides.currentHp === "number") {
    nextSheet = {
      ...nextSheet,
      currentHp: Math.trunc(overrides.currentHp),
    };
  }
  if (typeof overrides.currentMana === "number") {
    nextSheet = {
      ...nextSheet,
      currentMana: Math.max(0, Math.trunc(overrides.currentMana)),
      manaInitialized: true,
    };
  }
  if (overrides.statBaseOverrides) {
    nextSheet = {
      ...nextSheet,
      statState: {
        ...nextSheet.statState,
        ...Object.fromEntries(
          Object.entries(overrides.statBaseOverrides)
            .filter(([statId, value]) => isStatId(statId) && typeof value === "number")
            .map(([statId, value]) => [
              statId,
              {
                ...nextSheet.statState[statId as StatId],
                base: Math.trunc(value as number),
              },
            ])
        ),
      },
    };
  }
  if (overrides.skillBaseOverrides) {
    nextSheet = {
      ...nextSheet,
      skills: nextSheet.skills.map((skill) =>
        Object.prototype.hasOwnProperty.call(overrides.skillBaseOverrides, skill.id)
          ? {
              ...skill,
              base: Math.trunc(overrides.skillBaseOverrides?.[skill.id] ?? skill.base),
            }
          : skill
      ),
    };
  }

  return normalizeCharacterDraft(nextSheet);
}

function buildInstanceDisplayName(baseName: string, index: number, totalCount: number): string {
  return totalCount > 1 ? `${baseName} ${index}` : baseName;
}

export function createEncounterOwnedMobInstance(args: {
  mobTemplate: MobTemplate;
  sourceGroupId?: string | null;
  sourcePortalId?: string | null;
  sourcePortalStageId?: string | null;
  displayNameOverride?: string;
  notes?: string;
  sheetOverrides?: MobGroupMemberSheetOverrides | null;
  themeTags?: string[];
}): EncounterOwnedMobInstance {
  const baseName =
    args.displayNameOverride?.trim() ||
    args.mobTemplate.sheet.name.trim() ||
    args.mobTemplate.name.trim() ||
    "Unnamed Mob";
  const nextSheet = applyMemberSheetOverrides(args.mobTemplate.sheet, args.sheetOverrides ?? null);

  return {
    id: createTimestampedId("encounter-mob"),
    ownerRole: "dm",
    sourceMobTemplateId: args.mobTemplate.id,
    sourceGroupId: args.sourceGroupId ?? null,
    sourcePortalId: args.sourcePortalId ?? null,
    sourcePortalStageId: args.sourcePortalStageId ?? null,
    displayName: baseName,
    role: args.mobTemplate.role,
    themeTags: normalizeStringList([
      ...args.mobTemplate.themeTags,
      ...(args.themeTags ?? []),
    ]),
    behaviorTags: [...args.mobTemplate.behaviorTags],
    loot: args.mobTemplate.loot,
    notes: args.notes?.trim() ?? "",
    sheet: normalizeMobTemplateSheet({
      ...nextSheet,
      name: baseName,
    }),
  };
}

export function buildEncounterOwnedMobsFromGroup(args: {
  group: MobGroup;
  mobTemplatesById: Map<string, MobTemplate>;
  quantityMultiplier?: number;
  sourcePortalId?: string | null;
  sourcePortalStageId?: string | null;
}): EncounterOwnedMobInstance[] {
  const quantityMultiplier = normalizePositiveInt(args.quantityMultiplier ?? 1, 1);
  const instances: EncounterOwnedMobInstance[] = [];

  args.group.members.forEach((member) => {
    const mobTemplate = args.mobTemplatesById.get(member.mobTemplateId);
    if (!mobTemplate) {
      return;
    }

    const totalQuantity = normalizePositiveInt(member.quantity * quantityMultiplier, 1);
    const baseName =
      member.displayNameOverride.trim() ||
      mobTemplate.sheet.name.trim() ||
      mobTemplate.name.trim();

    for (let index = 1; index <= totalQuantity; index += 1) {
      instances.push(
        createEncounterOwnedMobInstance({
          mobTemplate,
          sourceGroupId: args.group.id,
          sourcePortalId: args.sourcePortalId ?? null,
          sourcePortalStageId: args.sourcePortalStageId ?? null,
          displayNameOverride: buildInstanceDisplayName(baseName, index, totalQuantity),
          notes: [member.notes, args.group.tactics, args.group.encounterNotes]
            .filter((entry) => entry.trim().length > 0)
            .join("\n"),
          sheetOverrides: member.sheetOverrides,
          themeTags: args.group.themeTags,
        })
      );
    }
  });

  return instances;
}

export function buildEncounterOwnedMobsFromPortalStage(args: {
  portal: PortalTemplate;
  stage: PortalStage;
  mobGroupsById: Map<string, MobGroup>;
  mobTemplatesById: Map<string, MobTemplate>;
}): EncounterOwnedMobInstance[] {
  return args.stage.groupReferences.flatMap((reference) => {
    const group = args.mobGroupsById.get(reference.mobGroupId);
    if (!group) {
      return [];
    }

    return buildEncounterOwnedMobsFromGroup({
      group,
      mobTemplatesById: args.mobTemplatesById,
      quantityMultiplier: reference.quantityMultiplier,
      sourcePortalId: args.portal.id,
      sourcePortalStageId: args.stage.id,
    }).map((instance) => ({
      ...instance,
      notes: [instance.notes, reference.notes, args.stage.sceneText].filter((entry) => entry.trim().length > 0).join("\n"),
      themeTags: normalizeStringList([...instance.themeTags, ...args.stage.environmentTags, args.portal.theme]),
    }));
  });
}

export function buildEncounterOwnedMobParticipantInputs(
  instances: EncounterOwnedMobInstance[],
  partyId: string | null,
  itemsById: Record<string, SharedItemRecord> = {}
) {
  return instances.map((instance) =>
    buildEncounterParticipantInput(
      instance.id,
      instance.ownerRole,
      instance.sheet,
      partyId,
      itemsById
    )
  );
}

export function buildCodexRequestPacket(args: {
  requestKind?: CodexRequestPacket["requestKind"];
  requestIntent: string;
  theme: string;
  depth?: number | null;
  stageCount?: number | null;
  difficulty?: CodexRequestPacketDifficulty | null;
  currentObject?: unknown | null;
  exampleObjects?: unknown[];
}): CodexRequestPacket {
  return {
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    requestKind: args.requestKind,
    requestIntent: args.requestIntent.trim(),
    theme: args.theme.trim(),
    depth: args.depth ?? null,
    stageCount: args.stageCount ?? null,
    difficulty: args.difficulty ?? null,
    currentObject: args.currentObject ?? null,
    exampleObjects: Array.isArray(args.exampleObjects) ? args.exampleObjects : [],
  };
}

export function buildCodexRequestPacketText(args: {
  requestKind?: CodexRequestPacket["requestKind"];
  requestIntent: string;
  theme: string;
  depth?: number | null;
  stageCount?: number | null;
  difficulty?: CodexRequestPacketDifficulty | null;
  currentObject?: unknown | null;
  exampleObjects?: unknown[];
}): string {
  return JSON.stringify(buildCodexRequestPacket(args), null, 2);
}

function rekeyImportedMobTemplates(mobs: MobTemplate[]): {
  mobs: MobTemplate[];
  idMap: Map<string, string>;
} {
  const idMap = new Map<string, string>();
  const nextMobs = mobs.map((mob) => {
    const nextId = createTimestampedId("mob-template");
    idMap.set(mob.id, nextId);
    return {
      ...mob,
      id: nextId,
    };
  });

  return { mobs: nextMobs, idMap };
}

function rekeyImportedMobGroups(
  groups: MobGroup[],
  mobIdMap: Map<string, string> = new Map()
): {
  groups: MobGroup[];
  idMap: Map<string, string>;
} {
  const idMap = new Map<string, string>();
  const nextGroups = groups.map((group) => {
    const nextId = createTimestampedId("mob-group");
    idMap.set(group.id, nextId);
    return {
      ...group,
      id: nextId,
      members: group.members.map((member) => ({
        ...member,
        id: createTimestampedId("mob-group-member"),
        mobTemplateId: mobIdMap.get(member.mobTemplateId) ?? member.mobTemplateId,
      })),
    };
  });

  return { groups: nextGroups, idMap };
}

function rekeyImportedPortal(
  portal: PortalTemplate,
  groupIdMap: Map<string, string> = new Map()
): PortalTemplate {
  return {
    ...portal,
    id: createTimestampedId("portal-template"),
    stages: portal.stages.map((stage, index) => ({
      ...stage,
      id: createTimestampedId("portal-stage"),
      index: index + 1,
      isBossStage: index === portal.stages.length - 1,
      groupReferences: stage.groupReferences.map((reference) => ({
        ...reference,
        id: createTimestampedId("portal-stage-group"),
        mobGroupId: groupIdMap.get(reference.mobGroupId) ?? reference.mobGroupId,
      })),
    })),
  };
}

export function parseCodexImportPayload(rawPayload: string): CodexImportPayload | { error: string } {
  try {
    const parsed = JSON.parse(rawPayload) as unknown;
    if (!isRecord(parsed)) {
      return { error: "Import payload must be a JSON object." };
    }

    const kind = asString(parsed.kind).trim();
    const schemaVersion = asString(parsed.schemaVersion).trim();
    if (schemaVersion !== AUTHORING_SCHEMA_VERSION) {
      return { error: `Unsupported schema version: ${schemaVersion || "missing"}.` };
    }

    const producedAt = asString(parsed.producedAt).trim() || getIsoTimestamp();
    const requestIntent = asString(parsed.requestIntent);
    const theme = asString(parsed.theme);

    if (kind === "mob_template_batch") {
      const hydratedMobs = Array.isArray(parsed.mobs)
        ? parsed.mobs
            .map((entry) => hydrateMobTemplate(entry))
            .filter((entry): entry is MobTemplate => entry !== null)
        : [];
      if (hydratedMobs.length === 0) {
        return { error: "Mob import payload did not include any valid mobs." };
      }
      const { mobs } = rekeyImportedMobTemplates(hydratedMobs);
      return {
        kind,
        schemaVersion: AUTHORING_SCHEMA_VERSION,
        producedAt,
        requestIntent,
        theme,
        mobs,
      };
    }

    if (kind === "mob_group_batch") {
      const hydratedGroups = Array.isArray(parsed.groups)
        ? parsed.groups
            .map((entry) => hydrateMobGroup(entry))
            .filter((entry): entry is MobGroup => entry !== null)
        : [];
      if (hydratedGroups.length === 0) {
        return { error: "Group import payload did not include any valid groups." };
      }
      const { groups } = rekeyImportedMobGroups(hydratedGroups);
      return {
        kind,
        schemaVersion: AUTHORING_SCHEMA_VERSION,
        producedAt,
        requestIntent,
        theme,
        groups,
      };
    }

    if (kind === "portal_template") {
      const hydratedPortal = hydratePortalTemplate(parsed.portal);
      const portal = hydratedPortal ? rekeyImportedPortal(hydratedPortal) : null;
      if (!portal) {
        return { error: "Portal import payload did not include a valid portal." };
      }
      return {
        kind,
        schemaVersion: AUTHORING_SCHEMA_VERSION,
        producedAt,
        requestIntent,
        theme,
        portal,
      };
    }

    if (kind === "portal_bundle") {
      const hydratedMobs = Array.isArray(parsed.mobs)
        ? parsed.mobs
            .map((entry) => hydrateMobTemplate(entry))
            .filter((entry): entry is MobTemplate => entry !== null)
        : [];
      const hydratedGroups = Array.isArray(parsed.groups)
        ? parsed.groups
            .map((entry) => hydrateMobGroup(entry))
            .filter((entry): entry is MobGroup => entry !== null)
        : [];
      const hydratedPortal = hydratePortalTemplate(parsed.portal);
      if (!hydratedPortal) {
        return { error: "Portal bundle payload did not include a valid portal." };
      }

      const { mobs, idMap: mobIdMap } = rekeyImportedMobTemplates(hydratedMobs);
      const { groups, idMap: groupIdMap } = rekeyImportedMobGroups(hydratedGroups, mobIdMap);
      const portal = rekeyImportedPortal(hydratedPortal, groupIdMap);

      return {
        kind,
        schemaVersion: AUTHORING_SCHEMA_VERSION,
        producedAt,
        requestIntent,
        theme,
        mobs,
        groups,
        portal,
      };
    }

    return { error: `Unsupported import kind: ${kind || "missing"}.` };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Import payload could not be parsed as JSON.",
    };
  }
}

function stampImportProvenance<T extends { sourceKind: ContentSourceKind; importProvenance: ContentImportProvenance | null; updatedAt: string }>(
  record: T,
  rawPayload: string
): T {
  return {
    ...record,
    sourceKind: "codex_import",
    updatedAt: getIsoTimestamp(),
    importProvenance: {
      importedAt: getIsoTimestamp(),
      rawPayload,
    },
  };
}

export function applyCodexImportPayload(args: {
  payload: CodexImportPayload;
  rawPayload: string;
  currentState: AuthoringContentState;
}): AuthoringContentState {
  if (args.payload.kind === "mob_template_batch") {
    return {
      ...args.currentState,
      mobTemplates: [
        ...args.currentState.mobTemplates,
        ...args.payload.mobs.map((mob) => stampImportProvenance(mob, args.rawPayload)),
      ],
    };
  }

  if (args.payload.kind === "mob_group_batch") {
    return {
      ...args.currentState,
      mobGroups: [
        ...args.currentState.mobGroups,
        ...args.payload.groups.map((group) => stampImportProvenance(group, args.rawPayload)),
      ],
    };
  }

  if (args.payload.kind === "portal_bundle") {
    return {
      mobTemplates: [
        ...args.currentState.mobTemplates,
        ...args.payload.mobs.map((mob) => stampImportProvenance(mob, args.rawPayload)),
      ],
      mobGroups: [
        ...args.currentState.mobGroups,
        ...args.payload.groups.map((group) => stampImportProvenance(group, args.rawPayload)),
      ],
      portalTemplates: [
        ...args.currentState.portalTemplates,
        stampImportProvenance(args.payload.portal, args.rawPayload),
      ],
    };
  }

  return {
    ...args.currentState,
    portalTemplates: [
      ...args.currentState.portalTemplates,
      stampImportProvenance(args.payload.portal, args.rawPayload),
    ],
  };
}

export function buildMobTemplateSupabaseRow(
  mobTemplate: MobTemplate,
  ownerId: string
): SupabaseReadyContentRow<Omit<MobTemplate, "id" | "name" | "status" | "version" | "sourceKind" | "createdAt" | "updatedAt">> {
  const { id, name, status, version, sourceKind, createdAt, updatedAt, ...payload } = mobTemplate;

  return {
    id,
    owner_id: ownerId,
    name,
    theme: mobTemplate.themeTags[0] ?? "",
    status,
    version,
    source_kind: sourceKind,
    created_at: createdAt,
    updated_at: updatedAt,
    payload,
  };
}

export function buildMobGroupSupabaseRow(
  mobGroup: MobGroup,
  ownerId: string
): SupabaseReadyContentRow<Omit<MobGroup, "id" | "name" | "status" | "version" | "sourceKind" | "createdAt" | "updatedAt">> {
  const { id, name, status, version, sourceKind, createdAt, updatedAt, ...payload } = mobGroup;

  return {
    id,
    owner_id: ownerId,
    name,
    theme: mobGroup.themeTags[0] ?? "",
    status,
    version,
    source_kind: sourceKind,
    created_at: createdAt,
    updated_at: updatedAt,
    payload,
  };
}

export function buildPortalTemplateSupabaseRow(
  portalTemplate: PortalTemplate,
  ownerId: string
): SupabaseReadyContentRow<Omit<PortalTemplate, "id" | "name" | "status" | "version" | "sourceKind" | "createdAt" | "updatedAt">> {
  const { id, name, status, version, sourceKind, createdAt, updatedAt, ...payload } = portalTemplate;

  return {
    id,
    owner_id: ownerId,
    name,
    theme: portalTemplate.theme,
    status,
    version,
    source_kind: sourceKind,
    created_at: createdAt,
    updated_at: updatedAt,
    payload,
  };
}
