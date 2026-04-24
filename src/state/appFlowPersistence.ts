import {
  CHARACTER_DRAFT_SCHEMA_VERSION,
  PLAYER_CHARACTER_TEMPLATE,
  hydrateCharacterDraft,
} from "../config/characterTemplate.ts";
import {
  buildItemIndex,
  createEmptyBonusProfile,
  createDefaultItemBlueprints,
  createDefaultItemCategoryDefinitions,
  createDefaultItemSubcategoryDefinitions,
  createLegacyTierImportProperty,
  createSharedItemRecord,
  createStarterItemRecords,
  ensureStarterItems,
  hydrateItemCategoryDefinitionRecord,
  hydrateItemBlueprintRecord,
  hydrateItemSubcategoryDefinitionRecord,
  hydrateSharedItemRecord,
  inferItemBlueprintId,
  normalizeCharacterEquipmentAnchors,
} from "../lib/items.ts";
import {
  createDefaultAuctionHouseEntries,
  normalizeAuctionHouseEntry,
} from "../lib/auctionHouse.ts";
import type { AuctionHouseEntry } from "../types/auction.ts";
import { isCharacterOwnerRole, type CharacterRecord } from "../types/character.ts";
import type {
  ItemBlueprintRecord,
  ItemCategoryDefinition,
  ItemSubcategoryDefinition,
  SharedItemRecord,
} from "../types/items.ts";
import type { KnowledgeEntity, KnowledgeOwnership, KnowledgeRevision, KnowledgeState } from "../types/knowledge.ts";
import {
  createEmptyKnowledgeState,
  hydrateKnowledgeEntity,
  hydrateKnowledgeOwnership,
  hydrateKnowledgeRevision,
} from "../lib/knowledge.ts";
import {
  createEmptyAuthoringState,
  hydrateMobGroup,
  hydrateMobTemplate,
  hydratePortalTemplate,
} from "../lib/authoring.ts";
import type {
  EncounterOwnedMobInstance,
  MobGroup,
  MobTemplate,
  PortalTemplate,
} from "../types/authoring.ts";
import type {
  CombatEncounterParticipant,
  CombatEncounterParty,
  CombatEncounterState,
  EncounterActivityLogEntry,
  EncounterOngoingState,
  EncounterTransientCombatant,
} from "../types/combatEncounter.ts";

export const CHARACTER_STORAGE_KEY = "convergence.local.characters";
export const CHARACTER_STORAGE_BACKUP_KEY = "convergence.local.characters.backup";

type PersistedCharacterEnvelope = {
  version: number;
  characters: Array<{ id: string; ownerRole?: unknown; sheet: unknown }>;
  itemCategoryDefinitions?: unknown[];
  itemSubcategoryDefinitions?: unknown[];
  itemBlueprints?: unknown[];
  itemInstances?: unknown[];
  items?: unknown[];
  auctionEntries?: unknown[];
  knowledgeEntities?: unknown[];
  knowledgeRevisions?: unknown[];
  knowledgeOwnerships?: unknown[];
  mobTemplates?: unknown[];
  mobGroups?: unknown[];
  portalTemplates?: unknown[];
  activeCombatEncounter?: unknown;
  starterItemsInitialized?: boolean;
  activeCharacterId?: string | null;
  activePlayerCharacterId?: string | null;
  activeDmCharacterId?: string | null;
};

export type PersistedCharacterState = {
  characters: CharacterRecord[];
  itemCategoryDefinitions: ItemCategoryDefinition[];
  itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  itemBlueprints: ItemBlueprintRecord[];
  items: SharedItemRecord[];
  auctionEntries: AuctionHouseEntry[];
  knowledgeEntities: KnowledgeEntity[];
  knowledgeRevisions: KnowledgeRevision[];
  knowledgeOwnerships: KnowledgeOwnership[];
  mobTemplates: MobTemplate[];
  mobGroups: MobGroup[];
  portalTemplates: PortalTemplate[];
  activeCombatEncounter: CombatEncounterState | null;
  starterItemsInitialized: boolean;
  activePlayerCharacterId: string | null;
  activeDmCharacterId: string | null;
};

function mergeDefaultRecordsById<T extends { id: string }>(
  persistedRecords: T[],
  defaultRecords: T[]
): T[] {
  const mergedRecords = [...persistedRecords];
  const existingIds = new Set(persistedRecords.map((record) => record.id));

  defaultRecords.forEach((record) => {
    if (!existingIds.has(record.id)) {
      mergedRecords.push(record);
    }
  });

  return mergedRecords;
}

function supplementSeededBlueprintCatalog(
  persistedBlueprints: ItemBlueprintRecord[],
  defaultBlueprints: ItemBlueprintRecord[]
): ItemBlueprintRecord[] {
  const defaultBlueprintIndex = new Map(
    defaultBlueprints.map((blueprint) => [blueprint.id, blueprint])
  );

  return persistedBlueprints.map((blueprint) => {
    const defaultBlueprint = defaultBlueprintIndex.get(blueprint.id);
    if (!defaultBlueprint) {
      return blueprint;
    }

    const visibleNotes = [...blueprint.visibleNotes];
    defaultBlueprint.visibleNotes.forEach((note) => {
      if (!visibleNotes.includes(note)) {
        visibleNotes.push(note);
      }
    });

    const requirements = [...blueprint.requirements];
    defaultBlueprint.requirements.forEach((requirement) => {
      if (!requirements.includes(requirement)) {
        requirements.push(requirement);
      }
    });

    return {
      ...blueprint,
      combatSpec:
        blueprint.combatSpec || defaultBlueprint.combatSpec
          ? {
              ...(defaultBlueprint.combatSpec ?? {}),
              ...Object.fromEntries(
                Object.entries(blueprint.combatSpec ?? {}).filter(([, value]) => value !== undefined)
              ),
            }
          : null,
      visibleNotes,
      requirements,
    };
  });
}

function getEmptyPersistedCharacterState(): PersistedCharacterState {
  const itemCategoryDefinitions = createDefaultItemCategoryDefinitions();
  const itemSubcategoryDefinitions = createDefaultItemSubcategoryDefinitions();
  const itemBlueprints = createDefaultItemBlueprints();
  return {
    characters: [],
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
    itemBlueprints,
    items: createStarterItemRecords(itemBlueprints),
    auctionEntries: createDefaultAuctionHouseEntries(),
    ...createEmptyKnowledgeState(),
    ...createEmptyAuthoringState(),
    activeCombatEncounter: null,
    starterItemsInitialized: true,
    activePlayerCharacterId: null,
    activeDmCharacterId: null,
  };
}

function getStarterItemIdSet(itemBlueprints: ItemBlueprintRecord[]): Set<string> {
  return new Set(createStarterItemRecords(itemBlueprints).map((item) => item.id));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeInteger(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isCombatEncounterPartyKind(
  value: unknown
): value is CombatEncounterParty["kind"] {
  return value === "players" || value === "npcs" || value === "custom";
}

function inferAssignedCharacterId(
  itemId: string,
  characters: CharacterRecord[]
): string | null {
  const owners = characters
    .filter((character) => {
      const sheet = character.sheet;
      return (
        sheet.ownedItemIds.includes(itemId) ||
        sheet.inventoryItemIds.includes(itemId) ||
        sheet.activeItemIds.includes(itemId) ||
        sheet.equipment.some((entry) => entry.itemId === itemId)
      );
    })
    .map((character) => character.id);

  return owners.length === 1 ? owners[0] : null;
}

function normalizeOwnerRole(value: unknown): CharacterRecord["ownerRole"] {
  return isCharacterOwnerRole(value) ? value : "player";
}

function safeHydrateEntry<T>(factory: () => T | null): T | null {
  try {
    return factory();
  } catch {
    return null;
  }
}

function hydrateCharacterRecordBestEffort(
  entry: Record<string, unknown>,
  itemBlueprints: ItemBlueprintRecord[],
  migratedItems: SharedItemRecord[]
): CharacterRecord | null {
  if (typeof entry.id !== "string") {
    return null;
  }

  try {
    const migrated = migrateLegacySheetItems(entry.sheet, entry.id, itemBlueprints);
    migratedItems.push(...migrated.migratedItems);

    return {
      id: entry.id,
      ownerRole: normalizeOwnerRole(entry.ownerRole),
      sheet: hydrateCharacterDraft(migrated.nextSheet),
    };
  } catch {
    const fallbackSheet = hydrateCharacterDraft(entry.sheet);
    if (isRecord(entry.sheet) && typeof entry.sheet.name === "string") {
      fallbackSheet.name = entry.sheet.name;
    } else if (!fallbackSheet.name.trim()) {
      fallbackSheet.name = PLAYER_CHARACTER_TEMPLATE.createInstance().name;
    }

    return {
      id: entry.id,
      ownerRole: normalizeOwnerRole(entry.ownerRole),
      sheet: fallbackSheet,
    };
  }
}

function hydrateItemRecordBestEffort(
  value: unknown,
  itemBlueprints: ItemBlueprintRecord[]
): SharedItemRecord | null {
  const hydrated = safeHydrateEntry(() => hydrateSharedItemRecord(value, itemBlueprints));
  if (hydrated) {
    return hydrated;
  }

  if (!isRecord(value)) {
    return null;
  }

  const name = typeof value.name === "string" && value.name.trim().length > 0 ? value.name : "Recovered Item";
  const categoryText = typeof value.category === "string" ? value.category : "";
  const slotText = typeof value.slot === "string" ? value.slot : "";
  const blueprintId =
    typeof value.blueprintId === "string"
      ? value.blueprintId
      : inferItemBlueprintId(name, categoryText, slotText);

  return createSharedItemRecord(
    blueprintId,
    {
      id: typeof value.id === "string" ? value.id : undefined,
      name,
      isArtifact: value.isArtifact === true,
      baseDescription: typeof value.baseDescription === "string" ? value.baseDescription : "",
      bonusProfile: isRecord(value.bonusProfile)
        ? (value.bonusProfile as SharedItemRecord["bonusProfile"])
        : undefined,
      customProperties: Array.isArray(value.customProperties)
        ? (value.customProperties as SharedItemRecord["customProperties"])
        : undefined,
      baseStrength:
        typeof value.baseStrength === "number" && Number.isFinite(value.baseStrength)
          ? Math.trunc(value.baseStrength)
          : undefined,
      anchorValueOverride:
        typeof value.anchorValueOverride === "number" && Number.isFinite(value.anchorValueOverride)
          ? Math.trunc(value.anchorValueOverride)
          : null,
      knowledge: isRecord(value.knowledge)
        ? (value.knowledge as SharedItemRecord["knowledge"])
        : undefined,
      auctionEntryId:
        typeof value.auctionEntryId === "string" && value.auctionEntryId.trim().length > 0
          ? value.auctionEntryId
          : null,
      assignedCharacterId:
        typeof value.assignedCharacterId === "string" && value.assignedCharacterId.trim().length > 0
          ? value.assignedCharacterId
          : null,
    },
    itemBlueprints
  );
}

function hasMeaningfulPersistedData(state: PersistedCharacterState): boolean {
  const starterItemIds = getStarterItemIdSet(state.itemBlueprints);

  return (
    state.characters.length > 0 ||
    state.items.some((item) => !starterItemIds.has(item.id)) ||
    state.knowledgeEntities.length > 0 ||
    state.knowledgeRevisions.length > 0 ||
    state.knowledgeOwnerships.length > 0 ||
    state.mobTemplates.length > 0 ||
    state.mobGroups.length > 0 ||
    state.portalTemplates.length > 0 ||
    state.activeCombatEncounter !== null
  );
}

function buildLegacyItemKnowledge(
  identified: unknown,
  characterId: string
): SharedItemRecord["knowledge"] {
  if (identified === true) {
    return {
      learnedCharacterIds: [characterId],
      visibleCharacterIds: [characterId],
    };
  }

  return {
    learnedCharacterIds: [],
    visibleCharacterIds: [],
  };
}

function migrateLegacySheetItems(
  rawSheet: unknown,
  characterId: string,
  itemBlueprints: ItemBlueprintRecord[]
): {
  nextSheet: unknown;
  migratedItems: SharedItemRecord[];
} {
  if (!isRecord(rawSheet)) {
    return {
      nextSheet: rawSheet,
      migratedItems: [],
    };
  }

  if (
    Array.isArray(rawSheet.ownedItemIds) ||
    Array.isArray(rawSheet.inventoryItemIds) ||
    Array.isArray(rawSheet.activeItemIds)
  ) {
    return {
      nextSheet: rawSheet,
      migratedItems: [],
    };
  }

  const legacyInventory = Array.isArray(rawSheet.inventory)
    ? rawSheet.inventory.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : [];
  const legacyEquipment = Array.isArray(rawSheet.equipment)
    ? rawSheet.equipment.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : [];

  if (legacyInventory.length === 0 && legacyEquipment.length === 0) {
    return {
      nextSheet: rawSheet,
      migratedItems: [],
    };
  }

  const migratedItems: SharedItemRecord[] = [];
  const ownedItemIds: string[] = [];
  const inventoryItemIds: string[] = [];
  const activeItemIds: string[] = [];
  const equipment = legacyEquipment.map((entry, index) => {
    const itemId = `item-${characterId}-legacy-equipment-${index}`;
    const itemName = typeof entry.item === "string" ? entry.item : `Legacy Equipment ${index + 1}`;
    const qualityTier = typeof entry.qualityTier === "string" ? entry.qualityTier : null;
    const bonusText =
      typeof entry.revealedSpec === "string"
        ? entry.revealedSpec
        : typeof entry.hiddenSpec === "string"
          ? entry.hiddenSpec
          : "";
    const legacyCustomProperty = createLegacyTierImportProperty(
      qualityTier,
      null,
      createEmptyBonusProfile()
    );

    migratedItems.push(
      createSharedItemRecord(
        inferItemBlueprintId(itemName, itemName, typeof entry.slot === "string" ? entry.slot : ""),
        {
          id: itemId,
          name: itemName,
          baseDescription: typeof entry.effect === "string" ? entry.effect : "",
          bonusProfile: {
            ...createEmptyBonusProfile(),
            notes: bonusText.trim().length > 0 ? [bonusText.trim()] : [],
          },
          customProperties: legacyCustomProperty ? [legacyCustomProperty] : [],
          isArtifact: (qualityTier?.trim().toLowerCase() ?? "").includes("artifact"),
          knowledge: buildLegacyItemKnowledge(entry.identified, characterId),
          assignedCharacterId: characterId,
        },
        itemBlueprints
      )
    );
    ownedItemIds.push(itemId);
    inventoryItemIds.push(itemId);
    activeItemIds.push(itemId);

    return {
      slot: typeof entry.slot === "string" ? entry.slot : "",
      itemId,
      anchorSlot: null,
    };
  });

  legacyInventory.forEach((entry, index) => {
    const itemId = `item-${characterId}-legacy-inventory-${index}`;
    const itemName = typeof entry.name === "string" ? entry.name : `Legacy Item ${index + 1}`;
    const qualityTier = typeof entry.qualityTier === "string" ? entry.qualityTier : null;
    const bonusText =
      typeof entry.revealedSpec === "string"
        ? entry.revealedSpec
        : typeof entry.hiddenSpec === "string"
          ? entry.hiddenSpec
          : "";
    const legacyCustomProperty = createLegacyTierImportProperty(
      qualityTier,
      null,
      createEmptyBonusProfile()
    );

    migratedItems.push(
      createSharedItemRecord(
        inferItemBlueprintId(itemName, typeof entry.category === "string" ? entry.category : ""),
        {
          id: itemId,
          name: itemName,
          baseDescription: typeof entry.note === "string" ? entry.note : "",
          bonusProfile: {
            ...createEmptyBonusProfile(),
            notes: bonusText.trim().length > 0 ? [bonusText.trim()] : [],
          },
          customProperties: legacyCustomProperty ? [legacyCustomProperty] : [],
          isArtifact: (qualityTier?.trim().toLowerCase() ?? "").includes("artifact"),
          knowledge: buildLegacyItemKnowledge(entry.identified, characterId),
          assignedCharacterId: characterId,
        },
        itemBlueprints
      )
    );
    ownedItemIds.push(itemId);
    inventoryItemIds.push(itemId);
  });

    return {
      nextSheet: {
        ...rawSheet,
        ownedItemIds: [...new Set(ownedItemIds)],
        inventoryItemIds: [...new Set(inventoryItemIds)],
        activeItemIds: [...new Set(activeItemIds)],
        equipment,
      },
      migratedItems,
  };
}

function hydrateAuctionEntryBestEffort(value: unknown): AuctionHouseEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  return normalizeAuctionHouseEntry({
    id: value.id,
    sourceRow: value.sourceRow,
    bid: value.bid,
    buyout: value.buyout,
    itemName: value.itemName,
    itemQuantity: value.itemQuantity,
    stockQuantity: value.stockQuantity,
    itemQuality: value.itemQuality,
    bodyPart: value.bodyPart,
    spec: value.spec,
    bonus: value.bonus,
    typeLabel: value.typeLabel,
    remarks: value.remarks,
    itemLabels: value.itemLabels,
  });
}

function hydrateCombatEncounterPartyBestEffort(
  value: unknown
): CombatEncounterParty | null {
  if (!isRecord(value) || typeof value.partyId !== "string") {
    return null;
  }

  return {
    partyId: value.partyId,
    label: normalizeString(value.label, value.partyId),
    kind: isCombatEncounterPartyKind(value.kind) ? value.kind : "custom",
  };
}

function hydrateCombatEncounterParticipantBestEffort(
  value: unknown
): CombatEncounterParticipant | null {
  if (
    !isRecord(value) ||
    typeof value.characterId !== "string" ||
    !isCharacterOwnerRole(value.ownerRole)
  ) {
    return null;
  }

  const initiativeFaces = Array.isArray(value.initiativeFaces)
    ? value.initiativeFaces
        .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
        .map((entry) => Math.trunc(entry))
    : [];

  return {
    characterId: value.characterId,
    ownerRole: value.ownerRole,
    displayName: normalizeString(value.displayName, value.characterId),
    initiativePool: normalizeInteger(value.initiativePool),
    initiativeFaces,
    initiativeSuccesses: normalizeInteger(value.initiativeSuccesses),
    dex: normalizeInteger(value.dex),
    wits: normalizeInteger(value.wits),
    partyId: normalizeStringOrNull(value.partyId),
    controllerCharacterId: normalizeStringOrNull(value.controllerCharacterId),
    summonTemplateId: normalizeStringOrNull(value.summonTemplateId),
    sourcePowerId: normalizeStringOrNull(value.sourcePowerId),
  };
}

function hydrateEncounterTransientCombatantBestEffort(
  value: unknown
): EncounterTransientCombatant | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isCharacterOwnerRole(value.ownerRole) ||
    typeof value.controllerCharacterId !== "string" ||
    typeof value.sourcePowerId !== "string" ||
    typeof value.summonTemplateId !== "string"
  ) {
    return null;
  }

  const rawBuffRules = isRecord(value.buffRules) ? value.buffRules : {};

  return {
    id: value.id,
    ownerRole: value.ownerRole,
    controllerCharacterId: value.controllerCharacterId,
    sourcePowerId: value.sourcePowerId,
    sourcePowerLevel: normalizeInteger(value.sourcePowerLevel, 1),
    summonTemplateId: value.summonTemplateId,
    buffRules: {
      canReceiveSingleBuffs: normalizeBoolean(rawBuffRules.canReceiveSingleBuffs),
      canReceiveGroupBuffs: normalizeBoolean(rawBuffRules.canReceiveGroupBuffs),
      canBeHealed: normalizeBoolean(rawBuffRules.canBeHealed),
    },
    sheet: hydrateCharacterDraft(value.sheet),
  };
}

function hydrateEncounterOwnedMobInstanceBestEffort(
  value: unknown
): EncounterOwnedMobInstance | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isCharacterOwnerRole(value.ownerRole) ||
    typeof value.sourceMobTemplateId !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    ownerRole: value.ownerRole,
    sourceMobTemplateId: value.sourceMobTemplateId,
    sourceGroupId: normalizeStringOrNull(value.sourceGroupId),
    sourcePortalId: normalizeStringOrNull(value.sourcePortalId),
    sourcePortalStageId: normalizeStringOrNull(value.sourcePortalStageId),
    displayName: normalizeString(value.displayName, value.id),
    role:
      value.role === "brute" ||
      value.role === "skirmisher" ||
      value.role === "ranged" ||
      value.role === "support" ||
      value.role === "controller" ||
      value.role === "boss" ||
      value.role === "custom"
        ? value.role
        : "custom",
    themeTags: Array.isArray(value.themeTags)
      ? value.themeTags.filter((entry): entry is string => typeof entry === "string")
      : [],
    behaviorTags: Array.isArray(value.behaviorTags)
      ? value.behaviorTags.filter((entry): entry is string => typeof entry === "string")
      : [],
    loot: normalizeString(value.loot),
    notes: normalizeString(value.notes),
    sheet: hydrateCharacterDraft(value.sheet),
  };
}

function hydrateEncounterActivityLogEntryBestEffort(
  value: unknown
): EncounterActivityLogEntry | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  return {
    id: value.id,
    createdAt: normalizeString(value.createdAt),
    summary: normalizeString(value.summary),
  };
}

function hydrateEncounterOngoingStateBestEffort(
  value: unknown
): EncounterOngoingState | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.kind !== "string") {
    return null;
  }

  switch (value.kind) {
    case "crowd_control":
      if (
        typeof value.casterCharacterId !== "string" ||
        typeof value.targetCharacterId !== "string"
      ) {
        return null;
      }

      return {
        id: value.id,
        kind: "crowd_control",
        casterCharacterId: value.casterCharacterId,
        targetCharacterId: value.targetCharacterId,
        powerLevel: normalizeInteger(value.powerLevel, 1),
        maintenanceManaCost: normalizeInteger(value.maintenanceManaCost),
        breaksOnDamageFromCaster: normalizeBoolean(value.breaksOnDamageFromCaster),
        breaksOnDamageFromOthers: normalizeBoolean(value.breaksOnDamageFromOthers),
        commandActionType:
          value.commandActionType === "bonus" ||
          value.commandActionType === "free" ||
          value.commandActionType === null
            ? value.commandActionType
            : null,
        summaryNote: normalizeStringOrNull(value.summaryNote),
      };
    case "body_reinforcement_revive":
      if (typeof value.characterId !== "string") {
        return null;
      }

      return {
        id: value.id,
        kind: "body_reinforcement_revive",
        characterId: value.characterId,
        reviveHp: normalizeInteger(value.reviveHp, 1),
        remainingTurnAdvances: normalizeInteger(value.remainingTurnAdvances, 1),
      };
    case "expose_darkness":
      if (
        typeof value.casterCharacterId !== "string" ||
        typeof value.targetCharacterId !== "string"
      ) {
        return null;
      }

      return {
        id: value.id,
        kind: "expose_darkness",
        casterCharacterId: value.casterCharacterId,
        targetCharacterId: value.targetCharacterId,
        summaryNote: normalizeStringOrNull(value.summaryNote),
      };
    default:
      return null;
  }
}

function hydrateCombatEncounterStateBestEffort(
  value: unknown
): CombatEncounterState | null {
  if (
    !isRecord(value) ||
    typeof value.encounterId !== "string" ||
    !Array.isArray(value.participants)
  ) {
    return null;
  }

  const parties = Array.isArray(value.parties)
    ? value.parties
        .map((entry) => hydrateCombatEncounterPartyBestEffort(entry))
        .filter((entry): entry is CombatEncounterParty => entry !== null)
    : [];
  const participants = value.participants
    .map((entry) => hydrateCombatEncounterParticipantBestEffort(entry))
    .filter((entry): entry is CombatEncounterParticipant => entry !== null);
  const rawTurnState = isRecord(value.turnState) ? value.turnState : {};

  if (participants.length === 0) {
    return null;
  }

  return {
    encounterId: value.encounterId,
    label: normalizeString(value.label, "Combat Encounter"),
    parties,
    participants,
    createdAt: normalizeString(value.createdAt),
    turnState: {
      round: Math.max(1, normalizeInteger(rawTurnState.round, 1)),
      activeParticipantIndex: Math.max(
        0,
        Math.min(
          participants.length - 1,
          normalizeInteger(rawTurnState.activeParticipantIndex, 0)
        )
      ),
      activeParticipantId: normalizeStringOrNull(rawTurnState.activeParticipantId),
    },
    encounterOwnedMobs: Array.isArray(value.encounterOwnedMobs)
      ? value.encounterOwnedMobs
          .map((entry) => hydrateEncounterOwnedMobInstanceBestEffort(entry))
          .filter((entry): entry is EncounterOwnedMobInstance => entry !== null)
      : [],
    transientCombatants: Array.isArray(value.transientCombatants)
      ? value.transientCombatants
          .map((entry) => hydrateEncounterTransientCombatantBestEffort(entry))
          .filter((entry): entry is EncounterTransientCombatant => entry !== null)
      : [],
    ongoingStates: Array.isArray(value.ongoingStates)
      ? value.ongoingStates
          .map((entry) => hydrateEncounterOngoingStateBestEffort(entry))
          .filter((entry): entry is EncounterOngoingState => entry !== null)
      : [],
    activityLog: Array.isArray(value.activityLog)
      ? value.activityLog
          .map((entry) => hydrateEncounterActivityLogEntryBestEffort(entry))
          .filter((entry): entry is EncounterActivityLogEntry => entry !== null)
      : [],
  };
}

export function hydratePersistedCharacters(rawValue: string | null): PersistedCharacterState {
  if (!rawValue) {
    return getEmptyPersistedCharacterState();
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsed)) {
      return getEmptyPersistedCharacterState();
    }

    const envelope = parsed as Partial<PersistedCharacterEnvelope>;
    const defaultItemCategoryDefinitions = createDefaultItemCategoryDefinitions();
    const defaultItemSubcategoryDefinitions = createDefaultItemSubcategoryDefinitions();
    const defaultItemBlueprints = createDefaultItemBlueprints();
    const itemCategoryDefinitions = Array.isArray(envelope.itemCategoryDefinitions)
      ? mergeDefaultRecordsById(
          envelope.itemCategoryDefinitions
            .map((entry) => safeHydrateEntry(() => hydrateItemCategoryDefinitionRecord(entry)))
            .filter((entry): entry is ItemCategoryDefinition => entry !== null),
          defaultItemCategoryDefinitions
        )
      : defaultItemCategoryDefinitions;
    const itemSubcategoryDefinitions = Array.isArray(envelope.itemSubcategoryDefinitions)
      ? mergeDefaultRecordsById(
          envelope.itemSubcategoryDefinitions
            .map((entry) => safeHydrateEntry(() => hydrateItemSubcategoryDefinitionRecord(entry)))
            .filter((entry): entry is ItemSubcategoryDefinition => entry !== null),
          defaultItemSubcategoryDefinitions
        )
      : defaultItemSubcategoryDefinitions;
    const itemBlueprints = Array.isArray(envelope.itemBlueprints)
      ? supplementSeededBlueprintCatalog(
          mergeDefaultRecordsById(
            envelope.itemBlueprints
              .map((entry) => safeHydrateEntry(() => hydrateItemBlueprintRecord(entry)))
              .filter((entry): entry is ItemBlueprintRecord => entry !== null),
            defaultItemBlueprints
          ),
          defaultItemBlueprints
        )
      : defaultItemBlueprints;
    const rawItemEntries = [
      ...(Array.isArray(envelope.items) ? envelope.items : []),
      ...(Array.isArray(envelope.itemInstances) ? envelope.itemInstances : []),
    ];
    const hydratedItems = [...new Map(
      rawItemEntries
        .map((entry) => hydrateItemRecordBestEffort(entry, itemBlueprints))
        .filter((entry): entry is SharedItemRecord => entry !== null)
        .map((entry) => [entry.id, entry])
    ).values()];
    const auctionEntries = Array.isArray(envelope.auctionEntries)
      ? envelope.auctionEntries
          .map((entry) => hydrateAuctionEntryBestEffort(entry))
          .filter((entry): entry is AuctionHouseEntry => entry !== null)
      : createDefaultAuctionHouseEntries();
    const knowledgeEntities = Array.isArray(envelope.knowledgeEntities)
      ? envelope.knowledgeEntities
          .map((entry) => safeHydrateEntry(() => hydrateKnowledgeEntity(entry)))
          .filter((entry): entry is KnowledgeEntity => entry !== null)
      : [];
    const knowledgeRevisions = Array.isArray(envelope.knowledgeRevisions)
      ? envelope.knowledgeRevisions
          .map((entry) => safeHydrateEntry(() => hydrateKnowledgeRevision(entry)))
          .filter((entry): entry is KnowledgeRevision => entry !== null)
      : [];
    const knowledgeOwnerships = Array.isArray(envelope.knowledgeOwnerships)
      ? envelope.knowledgeOwnerships
          .map((entry) => safeHydrateEntry(() => hydrateKnowledgeOwnership(entry)))
          .filter((entry): entry is KnowledgeOwnership => entry !== null)
      : [];
    const mobTemplates = Array.isArray(envelope.mobTemplates)
      ? envelope.mobTemplates
          .map((entry) => safeHydrateEntry(() => hydrateMobTemplate(entry)))
          .filter((entry): entry is MobTemplate => entry !== null)
      : [];
    const mobGroups = Array.isArray(envelope.mobGroups)
      ? envelope.mobGroups
          .map((entry) => safeHydrateEntry(() => hydrateMobGroup(entry)))
          .filter((entry): entry is MobGroup => entry !== null)
      : [];
    const portalTemplates = Array.isArray(envelope.portalTemplates)
      ? envelope.portalTemplates
          .map((entry) => safeHydrateEntry(() => hydratePortalTemplate(entry)))
          .filter((entry): entry is PortalTemplate => entry !== null)
      : [];
    const activeCombatEncounter = hydrateCombatEncounterStateBestEffort(
      envelope.activeCombatEncounter
    );
    const migratedItems: SharedItemRecord[] = [];
    const characters = Array.isArray(envelope.characters)
      ? envelope.characters.flatMap((entry) => {
          if (!isRecord(entry) || typeof entry.id !== "string") {
            return [];
          }

          const hydratedCharacter = hydrateCharacterRecordBestEffort(
            entry,
            itemBlueprints,
            migratedItems
          );

          return hydratedCharacter ? [hydratedCharacter] : [];
        })
      : [];
    const persistedActivePlayerCharacterId =
      typeof envelope.activePlayerCharacterId === "string"
        ? envelope.activePlayerCharacterId
        : null;
    const persistedActiveDmCharacterId =
      typeof envelope.activeDmCharacterId === "string" ? envelope.activeDmCharacterId : null;
    const legacyActiveCharacterId =
      typeof envelope.activeCharacterId === "string" ? envelope.activeCharacterId : null;
    const legacyActiveCharacter =
      legacyActiveCharacterId
        ? characters.find((character) => character.id === legacyActiveCharacterId) ?? null
        : null;

    const persistedStarterItemsInitialized = envelope.starterItemsInitialized === true;
    const items = persistedStarterItemsInitialized
      ? hydratedItems
      : ensureStarterItems([...hydratedItems, ...migratedItems], itemBlueprints);
    const normalizedItems = items.map((item) =>
      item.assignedCharacterId
        ? item
        : {
            ...item,
            assignedCharacterId: inferAssignedCharacterId(item.id, characters),
          }
    );
    const itemsById = buildItemIndex(normalizedItems);
    const normalizedCharacters = characters.map((character) => ({
      ...character,
      sheet: normalizeCharacterEquipmentAnchors(character.sheet, itemsById, {
        itemBlueprints,
        itemCategoryDefinitions,
        itemSubcategoryDefinitions,
      }),
    }));

    return {
      characters: normalizedCharacters,
      itemCategoryDefinitions:
        itemCategoryDefinitions.length > 0
          ? itemCategoryDefinitions
          : createDefaultItemCategoryDefinitions(),
      itemSubcategoryDefinitions:
        itemSubcategoryDefinitions.length > 0
          ? itemSubcategoryDefinitions
          : createDefaultItemSubcategoryDefinitions(),
      itemBlueprints,
      items: normalizedItems,
      auctionEntries,
      knowledgeEntities,
      knowledgeRevisions,
      knowledgeOwnerships,
      mobTemplates,
      mobGroups,
      portalTemplates,
      activeCombatEncounter,
      starterItemsInitialized: true,
      activePlayerCharacterId:
        persistedActivePlayerCharacterId &&
        normalizedCharacters.some(
          (character) =>
            character.id === persistedActivePlayerCharacterId && character.ownerRole === "player"
        )
          ? persistedActivePlayerCharacterId
          : legacyActiveCharacter?.ownerRole === "player"
            ? legacyActiveCharacter.id
            : null,
      activeDmCharacterId:
        persistedActiveDmCharacterId &&
        normalizedCharacters.some(
          (character) =>
            character.id === persistedActiveDmCharacterId && character.ownerRole === "dm"
        )
          ? persistedActiveDmCharacterId
          : legacyActiveCharacter?.ownerRole === "dm"
            ? legacyActiveCharacter.id
            : null,
    };
  } catch {
    return getEmptyPersistedCharacterState();
  }
}

export function readPersistedCharactersFromStorage(
  storage: Pick<Storage, "getItem"> | null
): PersistedCharacterState {
  if (!storage) {
    return getEmptyPersistedCharacterState();
  }

  const primaryState = hydratePersistedCharacters(storage.getItem(CHARACTER_STORAGE_KEY));
  const backupState = hydratePersistedCharacters(storage.getItem(CHARACTER_STORAGE_BACKUP_KEY));

  return !hasMeaningfulPersistedData(primaryState) && hasMeaningfulPersistedData(backupState)
    ? backupState
    : primaryState;
}

export function serializePersistedCharacters(
  state: PersistedCharacterState
): PersistedCharacterEnvelope {
  return {
    version: CHARACTER_DRAFT_SCHEMA_VERSION,
    characters: state.characters.map((character) => ({
      id: character.id,
      ownerRole: character.ownerRole,
      sheet: character.sheet,
    })),
    itemCategoryDefinitions: state.itemCategoryDefinitions,
    itemSubcategoryDefinitions: state.itemSubcategoryDefinitions,
    itemBlueprints: state.itemBlueprints,
    itemInstances: state.items,
    auctionEntries: state.auctionEntries,
    knowledgeEntities: state.knowledgeEntities,
    knowledgeRevisions: state.knowledgeRevisions,
    knowledgeOwnerships: state.knowledgeOwnerships,
    mobTemplates: state.mobTemplates,
    mobGroups: state.mobGroups,
    portalTemplates: state.portalTemplates,
    activeCombatEncounter: state.activeCombatEncounter,
    starterItemsInitialized: state.starterItemsInitialized,
    activePlayerCharacterId: state.activePlayerCharacterId,
    activeDmCharacterId: state.activeDmCharacterId,
  };
}

export function writePersistedCharactersToStorage(
  storage: Pick<Storage, "setItem"> | null,
  state: PersistedCharacterState
): void {
  if (!storage) {
    return;
  }

  const serialized = JSON.stringify(serializePersistedCharacters(state));
  storage.setItem(CHARACTER_STORAGE_KEY, serialized);

  if (hasMeaningfulPersistedData(state)) {
    storage.setItem(CHARACTER_STORAGE_BACKUP_KEY, serialized);
  }
}
