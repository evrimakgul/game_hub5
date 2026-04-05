import {
  CHARACTER_DRAFT_SCHEMA_VERSION,
  hydrateCharacterDraft,
} from "../config/characterTemplate.ts";
import {
  createEmptyBonusProfile,
  createSharedItemRecord,
  hydrateSharedItemRecord,
  inferItemBlueprintId,
  inferItemLevelFromQualityTier,
} from "../lib/items.ts";
import { isCharacterOwnerRole, type CharacterRecord } from "../types/character.ts";
import type { SharedItemRecord } from "../types/items.ts";
import type { KnowledgeEntity, KnowledgeOwnership, KnowledgeRevision, KnowledgeState } from "../types/knowledge.ts";
import {
  createEmptyKnowledgeState,
  hydrateKnowledgeEntity,
  hydrateKnowledgeOwnership,
  hydrateKnowledgeRevision,
} from "../lib/knowledge.ts";

export const CHARACTER_STORAGE_KEY = "convergence.local.characters";

type PersistedCharacterEnvelope = {
  version: number;
  characters: Array<{ id: string; ownerRole?: unknown; sheet: unknown }>;
  items?: unknown[];
  knowledgeEntities?: unknown[];
  knowledgeRevisions?: unknown[];
  knowledgeOwnerships?: unknown[];
  activeCharacterId?: string | null;
  activePlayerCharacterId?: string | null;
  activeDmCharacterId?: string | null;
};

export type PersistedCharacterState = {
  characters: CharacterRecord[];
  items: SharedItemRecord[];
  knowledgeEntities: KnowledgeEntity[];
  knowledgeRevisions: KnowledgeRevision[];
  knowledgeOwnerships: KnowledgeOwnership[];
  activePlayerCharacterId: string | null;
  activeDmCharacterId: string | null;
};

function getEmptyPersistedCharacterState(): PersistedCharacterState {
  return {
    characters: [],
    items: [],
    ...createEmptyKnowledgeState(),
    activePlayerCharacterId: null,
    activeDmCharacterId: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOwnerRole(value: unknown): CharacterRecord["ownerRole"] {
  return isCharacterOwnerRole(value) ? value : "player";
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
  characterId: string
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

    migratedItems.push(
      createSharedItemRecord(
        inferItemBlueprintId(itemName, itemName, typeof entry.slot === "string" ? entry.slot : ""),
        {
          id: itemId,
          name: itemName,
          itemLevel: inferItemLevelFromQualityTier(qualityTier),
          qualityTier,
          baseDescription: typeof entry.effect === "string" ? entry.effect : "",
          bonusProfile: {
            ...createEmptyBonusProfile(),
            notes: bonusText.trim().length > 0 ? [bonusText.trim()] : [],
          },
          knowledge: buildLegacyItemKnowledge(entry.identified, characterId),
        }
      )
    );
    ownedItemIds.push(itemId);
    inventoryItemIds.push(itemId);
    activeItemIds.push(itemId);

    return {
      slot: typeof entry.slot === "string" ? entry.slot : "",
      itemId,
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

    migratedItems.push(
      createSharedItemRecord(inferItemBlueprintId(itemName, typeof entry.category === "string" ? entry.category : ""), {
        id: itemId,
        name: itemName,
        itemLevel: inferItemLevelFromQualityTier(qualityTier),
        qualityTier,
        baseDescription: typeof entry.note === "string" ? entry.note : "",
        bonusProfile: {
          ...createEmptyBonusProfile(),
          notes: bonusText.trim().length > 0 ? [bonusText.trim()] : [],
        },
        knowledge: buildLegacyItemKnowledge(entry.identified, characterId),
      })
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
    const persistedItems = Array.isArray(envelope.items)
      ? envelope.items
          .map((entry) => hydrateSharedItemRecord(entry))
          .filter((entry): entry is SharedItemRecord => entry !== null)
      : [];
    const knowledgeEntities = Array.isArray(envelope.knowledgeEntities)
      ? envelope.knowledgeEntities
          .map((entry) => hydrateKnowledgeEntity(entry))
          .filter((entry): entry is KnowledgeEntity => entry !== null)
      : [];
    const knowledgeRevisions = Array.isArray(envelope.knowledgeRevisions)
      ? envelope.knowledgeRevisions
          .map((entry) => hydrateKnowledgeRevision(entry))
          .filter((entry): entry is KnowledgeRevision => entry !== null)
      : [];
    const knowledgeOwnerships = Array.isArray(envelope.knowledgeOwnerships)
      ? envelope.knowledgeOwnerships
          .map((entry) => hydrateKnowledgeOwnership(entry))
          .filter((entry): entry is KnowledgeOwnership => entry !== null)
      : [];
    const migratedItems: SharedItemRecord[] = [];
    const characters = Array.isArray(envelope.characters)
      ? envelope.characters.flatMap((entry) => {
          if (!isRecord(entry) || typeof entry.id !== "string") {
            return [];
          }

          const migrated = migrateLegacySheetItems(entry.sheet, entry.id);
          migratedItems.push(...migrated.migratedItems);

          return [
            {
              id: entry.id,
              ownerRole: normalizeOwnerRole(entry.ownerRole),
              sheet: hydrateCharacterDraft(migrated.nextSheet),
            },
          ];
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

    return {
      characters,
      items: [...persistedItems, ...migratedItems],
      knowledgeEntities,
      knowledgeRevisions,
      knowledgeOwnerships,
      activePlayerCharacterId:
        persistedActivePlayerCharacterId &&
        characters.some(
          (character) =>
            character.id === persistedActivePlayerCharacterId && character.ownerRole === "player"
        )
          ? persistedActivePlayerCharacterId
          : legacyActiveCharacter?.ownerRole === "player"
            ? legacyActiveCharacter.id
            : null,
      activeDmCharacterId:
        persistedActiveDmCharacterId &&
        characters.some(
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

  return hydratePersistedCharacters(storage.getItem(CHARACTER_STORAGE_KEY));
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
    items: state.items,
    knowledgeEntities: state.knowledgeEntities,
    knowledgeRevisions: state.knowledgeRevisions,
    knowledgeOwnerships: state.knowledgeOwnerships,
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

  storage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(serializePersistedCharacters(state)));
}
