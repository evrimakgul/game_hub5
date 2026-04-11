import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CHARACTER_DRAFT_SCHEMA_VERSION,
  PLAYER_CHARACTER_TEMPLATE,
  type CharacterDraft,
  normalizeCharacterDraft,
} from "../config/characterTemplate";
import { createEmptyKnowledgeState } from "../lib/knowledge.ts";
import {
  createItemCategoryDefinitionRecord,
  createItemBlueprintRecord,
  createItemSubcategoryDefinitionRecord,
  createSharedItemRecord,
  syncItemsWithBlueprint,
  syncSharedItemRecordWithBlueprint,
  updateBlueprintOverrideList,
} from "../lib/items.ts";
import {
  CHARACTER_STORAGE_KEY,
  readPersistedCharactersFromStorage,
  type PersistedCharacterState,
  writePersistedCharactersToStorage,
} from "./appFlowPersistence";
import {
  isCharacterOwnerRole,
  type CharacterOwnerRole,
  type CharacterRecord,
} from "../types/character";
import type { CombatEncounterState } from "../types/combatEncounter";
import type {
  ItemBlueprintId,
  ItemBlueprintRecord,
  ItemCategoryDefinition,
  ItemSubcategoryDefinition,
  SharedItemRecord,
} from "../types/items.ts";
import type {
  KnowledgeEntity,
  KnowledgeOwnership,
  KnowledgeRevision,
  KnowledgeState,
} from "../types/knowledge.ts";

export type { CharacterOwnerRole, CharacterRecord } from "../types/character";

type AuthChoice = "login" | "signup" | null;
type RoleChoice = "player" | "dm" | null;

type AppFlowContextValue = {
  authChoice: AuthChoice;
  roleChoice: RoleChoice;
  characters: CharacterRecord[];
  itemCategoryDefinitions: ItemCategoryDefinition[];
  itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  itemBlueprints: ItemBlueprintRecord[];
  items: SharedItemRecord[];
  knowledgeEntities: KnowledgeEntity[];
  knowledgeRevisions: KnowledgeRevision[];
  knowledgeOwnerships: KnowledgeOwnership[];
  activePlayerCharacter: CharacterRecord | null;
  activeDmCharacter: CharacterRecord | null;
  activeCombatEncounter: CombatEncounterState | null;
  chooseAuth: (choice: Exclude<AuthChoice, null>) => void;
  chooseRole: (choice: Exclude<RoleChoice, null>) => void;
  createCharacter: (ownerRole?: CharacterOwnerRole) => string;
  createItem: (
    blueprintId: ItemBlueprintId,
    overrides?: Partial<
      Pick<
        SharedItemRecord,
        | "name"
        | "isArtifact"
        | "baseDescription"
        | "baseOverrides"
        | "bonusProfile"
        | "customProperties"
        | "knowledge"
        | "assignedCharacterId"
      >
    >
  ) => string;
  updateItem: (
    itemId: string,
    updater: SharedItemRecord | ((current: SharedItemRecord) => SharedItemRecord)
  ) => void;
  deleteItem: (itemId: string) => void;
  createItemCategoryDefinition: (overrides?: Partial<ItemCategoryDefinition>) => string;
  updateItemCategoryDefinition: (
    categoryDefinitionId: string,
    updater:
      | ItemCategoryDefinition
      | ((current: ItemCategoryDefinition) => ItemCategoryDefinition)
  ) => void;
  deleteItemCategoryDefinition: (categoryDefinitionId: string) => void;
  createItemSubcategoryDefinition: (
    overrides?: Partial<ItemSubcategoryDefinition>
  ) => string;
  updateItemSubcategoryDefinition: (
    subcategoryDefinitionId: string,
    updater:
      | ItemSubcategoryDefinition
      | ((current: ItemSubcategoryDefinition) => ItemSubcategoryDefinition)
  ) => void;
  deleteItemSubcategoryDefinition: (subcategoryDefinitionId: string) => void;
  createItemBlueprint: (overrides?: Partial<ItemBlueprintRecord>) => string;
  updateItemBlueprint: (
    blueprintId: string,
    updater: ItemBlueprintRecord | ((current: ItemBlueprintRecord) => ItemBlueprintRecord)
  ) => void;
  deleteItemBlueprint: (blueprintId: string) => void;
  assignItemToCharacter: (itemId: string, characterId: string | null) => void;
  selectCharacter: (characterId: string) => void;
  deleteCharacter: (characterId: string) => void;
  updateCharacter: (
    characterId: string,
    updater: CharacterDraft | ((current: CharacterDraft) => CharacterDraft)
  ) => void;
  replaceCharacters: (characters: CharacterRecord[]) => void;
  updateKnowledgeState: (
    updater: KnowledgeState | ((current: KnowledgeState) => KnowledgeState)
  ) => void;
  beginCombatEncounter: (encounter: CombatEncounterState) => void;
  updateCombatEncounter: (
    updater:
      | CombatEncounterState
      | ((current: CombatEncounterState) => CombatEncounterState)
  ) => void;
  clearCombatEncounter: () => void;
};

const AppFlowContext = createContext<AppFlowContextValue | null>(null);

export function AppFlowProvider({ children }: PropsWithChildren) {
  const persistedCharacters = useMemo<PersistedCharacterState>(
    () =>
      readPersistedCharactersFromStorage(
        typeof window === "undefined" ? null : window.localStorage
      ),
    []
  );
  const skipNextPersistRef = useRef(false);
  const [authChoice, setAuthChoice] = useState<AuthChoice>(null);
  const [roleChoice, setRoleChoice] = useState<RoleChoice>(null);
  const [characters, setCharacters] = useState<CharacterRecord[]>(persistedCharacters.characters);
  const [itemCategoryDefinitions, setItemCategoryDefinitions] = useState<ItemCategoryDefinition[]>(
    persistedCharacters.itemCategoryDefinitions
  );
  const [itemSubcategoryDefinitions, setItemSubcategoryDefinitions] = useState<ItemSubcategoryDefinition[]>(
    persistedCharacters.itemSubcategoryDefinitions
  );
  const [itemBlueprints, setItemBlueprints] = useState<ItemBlueprintRecord[]>(persistedCharacters.itemBlueprints);
  const [items, setItems] = useState<SharedItemRecord[]>(persistedCharacters.items);
  const [starterItemsInitialized] = useState<boolean>(persistedCharacters.starterItemsInitialized);
  const [knowledgeState, setKnowledgeState] = useState<KnowledgeState>({
    knowledgeEntities: persistedCharacters.knowledgeEntities,
    knowledgeRevisions: persistedCharacters.knowledgeRevisions,
    knowledgeOwnerships: persistedCharacters.knowledgeOwnerships,
  });
  const [activePlayerCharacterId, setActivePlayerCharacterId] = useState<string | null>(
    persistedCharacters.activePlayerCharacterId
  );
  const [activeDmCharacterId, setActiveDmCharacterId] = useState<string | null>(
    persistedCharacters.activeDmCharacterId
  );
  const [activeCombatEncounter, setActiveCombatEncounter] =
    useState<CombatEncounterState | null>(null);

  const activePlayerCharacter = useMemo(
    () => characters.find((character) => character.id === activePlayerCharacterId) ?? null,
    [activePlayerCharacterId, characters]
  );
  const activeDmCharacter = useMemo(
    () => characters.find((character) => character.id === activeDmCharacterId) ?? null,
    [activeDmCharacterId, characters]
  );

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    writePersistedCharactersToStorage(
      typeof window === "undefined" ? null : window.localStorage,
      {
        characters,
        itemCategoryDefinitions,
        itemSubcategoryDefinitions,
        itemBlueprints,
        items,
        ...knowledgeState,
        starterItemsInitialized,
        activePlayerCharacterId,
        activeDmCharacterId,
      }
    );
  }, [activeDmCharacterId, activePlayerCharacterId, characters, itemBlueprints, itemCategoryDefinitions, itemSubcategoryDefinitions, items, knowledgeState, starterItemsInitialized]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleStorage(event: StorageEvent): void {
      if (event.key !== CHARACTER_STORAGE_KEY) {
        return;
      }

      const nextState = readPersistedCharactersFromStorage(window.localStorage);
      skipNextPersistRef.current = true;
      setCharacters(nextState.characters);
      setItemCategoryDefinitions(nextState.itemCategoryDefinitions);
      setItemSubcategoryDefinitions(nextState.itemSubcategoryDefinitions);
      setItemBlueprints(nextState.itemBlueprints);
      setItems(nextState.items);
      setKnowledgeState({
        knowledgeEntities: nextState.knowledgeEntities,
        knowledgeRevisions: nextState.knowledgeRevisions,
        knowledgeOwnerships: nextState.knowledgeOwnerships,
      });
      setActivePlayerCharacterId((currentActiveCharacterId) =>
        currentActiveCharacterId &&
        nextState.characters.some(
          (character) =>
            character.id === currentActiveCharacterId && character.ownerRole === "player"
        )
          ? currentActiveCharacterId
          : null
      );
      setActiveDmCharacterId((currentActiveCharacterId) =>
        currentActiveCharacterId &&
        nextState.characters.some(
          (character) => character.id === currentActiveCharacterId && character.ownerRole === "dm"
        )
          ? currentActiveCharacterId
          : null
      );
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function createCharacter(ownerRole: CharacterOwnerRole = "player"): string {
    const characterId = `character-${Date.now()}-${characters.length + 1}`;

    setCharacters((currentCharacters) => [
      ...currentCharacters,
      {
        id: characterId,
        ownerRole,
        sheet: PLAYER_CHARACTER_TEMPLATE.createInstance(),
      },
    ]);
    if (ownerRole === "dm") {
      setActiveDmCharacterId(characterId);
      return characterId;
    }

    setActivePlayerCharacterId(characterId);

    return characterId;
  }

  function appendUnique(values: string[], nextValue: string): string[] {
    return values.includes(nextValue) ? values : [...values, nextValue];
  }

  function stripItemReferencesFromSheet(sheet: CharacterDraft, itemId: string): CharacterDraft {
    return normalizeCharacterDraft({
      ...sheet,
      ownedItemIds: sheet.ownedItemIds.filter((entry) => entry !== itemId),
      inventoryItemIds: sheet.inventoryItemIds.filter((entry) => entry !== itemId),
      activeItemIds: sheet.activeItemIds.filter((entry) => entry !== itemId),
      equipment: sheet.equipment.map((entry) =>
        entry.itemId === itemId ? { ...entry, itemId: null } : entry
      ),
    });
  }

  function assignItemReferencesToSheet(sheet: CharacterDraft, itemId: string): CharacterDraft {
    return normalizeCharacterDraft({
      ...sheet,
      ownedItemIds: appendUnique(sheet.ownedItemIds, itemId),
      inventoryItemIds: appendUnique(sheet.inventoryItemIds, itemId),
    });
  }

  function createItem(
    blueprintId: ItemBlueprintId,
    overrides: Partial<
      Pick<
        SharedItemRecord,
        | "name"
        | "isArtifact"
        | "baseDescription"
        | "baseOverrides"
        | "bonusProfile"
        | "customProperties"
        | "knowledge"
        | "assignedCharacterId"
      >
    > = {}
  ): string {
    const nextItem = createSharedItemRecord(blueprintId, overrides, itemBlueprints);
    setItems((currentItems) => [...currentItems, nextItem]);
    return nextItem.id;
  }

  function createItemCategoryDefinition(
    overrides: Partial<ItemCategoryDefinition> = {}
  ): string {
    const nextDefinition = createItemCategoryDefinitionRecord(overrides);
    setItemCategoryDefinitions((currentDefinitions) => [...currentDefinitions, nextDefinition]);
    return nextDefinition.id;
  }

  function updateItemCategoryDefinition(
    categoryDefinitionId: string,
    updater:
      | ItemCategoryDefinition
      | ((current: ItemCategoryDefinition) => ItemCategoryDefinition)
  ): void {
    setItemCategoryDefinitions((currentDefinitions) =>
      currentDefinitions.map((definition) => {
        if (definition.id !== categoryDefinitionId) {
          return definition;
        }

        const nextDefinition =
          typeof updater === "function" ? updater(definition) : updater;
        return {
          ...nextDefinition,
          id: definition.id,
        };
      })
    );
  }

  function deleteItemCategoryDefinition(categoryDefinitionId: string): void {
    if (
      itemSubcategoryDefinitions.some(
        (definition) => definition.categoryId === categoryDefinitionId
      ) ||
      itemBlueprints.some(
        (blueprint) => blueprint.categoryDefinitionId === categoryDefinitionId
      )
    ) {
      return;
    }

    setItemCategoryDefinitions((currentDefinitions) =>
      currentDefinitions.filter((definition) => definition.id !== categoryDefinitionId)
    );
  }

  function createItemSubcategoryDefinition(
    overrides: Partial<ItemSubcategoryDefinition> = {}
  ): string {
    const nextDefinition = createItemSubcategoryDefinitionRecord(overrides);
    setItemSubcategoryDefinitions((currentDefinitions) => [
      ...currentDefinitions,
      nextDefinition,
    ]);
    return nextDefinition.id;
  }

  function updateItemSubcategoryDefinition(
    subcategoryDefinitionId: string,
    updater:
      | ItemSubcategoryDefinition
      | ((current: ItemSubcategoryDefinition) => ItemSubcategoryDefinition)
  ): void {
    let nextDefinition: ItemSubcategoryDefinition | null = null;

    setItemSubcategoryDefinitions((currentDefinitions) =>
      currentDefinitions.map((definition) => {
        if (definition.id !== subcategoryDefinitionId) {
          return definition;
        }

        const updated =
          typeof updater === "function" ? updater(definition) : updater;
        nextDefinition = {
          ...updated,
          id: definition.id,
        };
        return nextDefinition;
      })
    );

    if (!nextDefinition) {
      return;
    }

    setItemBlueprints((currentBlueprints) => {
      const updatedBlueprints = currentBlueprints.map((blueprint) =>
        blueprint.subcategoryDefinitionId === subcategoryDefinitionId
          ? createItemBlueprintRecord({
              ...blueprint,
              categoryDefinitionId: nextDefinition!.categoryId,
              subcategoryDefinitionId: nextDefinition!.id,
            })
          : blueprint
      );

      setItems((currentItems) =>
        updatedBlueprints.reduce(
          (nextItems, blueprint) => syncItemsWithBlueprint(nextItems, blueprint),
          currentItems
        )
      );

      return updatedBlueprints;
    });
  }

  function deleteItemSubcategoryDefinition(subcategoryDefinitionId: string): void {
    if (
      itemBlueprints.some(
        (blueprint) => blueprint.subcategoryDefinitionId === subcategoryDefinitionId
      )
    ) {
      return;
    }

    setItemSubcategoryDefinitions((currentDefinitions) =>
      currentDefinitions.filter((definition) => definition.id !== subcategoryDefinitionId)
    );
  }

  function updateItem(
    itemId: string,
    updater: SharedItemRecord | ((current: SharedItemRecord) => SharedItemRecord)
  ): void {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextItem = typeof updater === "function" ? updater(item) : updater;
        const blueprint = itemBlueprints.find((entry) => entry.id === nextItem.blueprintId);
        return blueprint ? syncSharedItemRecordWithBlueprint(nextItem, blueprint) : nextItem;
      })
    );
  }

  function deleteItem(itemId: string): void {
    setItems((currentItems) => {
      const nextItems = currentItems.filter((item) => item.id !== itemId);
      setItemBlueprints((currentBlueprints) =>
        currentBlueprints.map((blueprint) => updateBlueprintOverrideList(blueprint, nextItems))
      );
      return nextItems;
    });
    setCharacters((currentCharacters) =>
      currentCharacters.map((character) => ({
        ...character,
        sheet: stripItemReferencesFromSheet(character.sheet, itemId),
      }))
    );
  }

  function createItemBlueprint(overrides: Partial<ItemBlueprintRecord> = {}): string {
    const nextBlueprint = createItemBlueprintRecord(overrides);
    setItemBlueprints((currentBlueprints) => [...currentBlueprints, nextBlueprint]);
    return nextBlueprint.id;
  }

  function updateItemBlueprint(
    blueprintId: string,
    updater: ItemBlueprintRecord | ((current: ItemBlueprintRecord) => ItemBlueprintRecord)
  ): void {
    let nextBlueprint: ItemBlueprintRecord | null = null;

    setItemBlueprints((currentBlueprints) =>
      currentBlueprints.map((blueprint) => {
        if (blueprint.id !== blueprintId) {
          return blueprint;
        }

        const updatedBlueprint =
          typeof updater === "function" ? updater(blueprint) : updater;
        nextBlueprint = createItemBlueprintRecord({
          ...updatedBlueprint,
          id: blueprint.id,
        });
        return nextBlueprint;
      })
    );

    if (!nextBlueprint) {
      return;
    }

    setItems((currentItems) => {
      const syncedItems = syncItemsWithBlueprint(currentItems, nextBlueprint!);
      const normalizedBlueprint = updateBlueprintOverrideList(nextBlueprint!, syncedItems);
      setItemBlueprints((currentBlueprints) =>
        currentBlueprints.map((blueprint) =>
          blueprint.id === blueprintId ? normalizedBlueprint : blueprint
        )
      );
      return syncedItems;
    });
  }

  function deleteItemBlueprint(blueprintId: string): void {
    if (items.some((item) => item.blueprintId === blueprintId)) {
      return;
    }

    setItemBlueprints((currentBlueprints) =>
      currentBlueprints.filter((blueprint) => blueprint.id !== blueprintId)
    );
  }

  function assignItemToCharacter(itemId: string, characterId: string | null): void {
    setCharacters((currentCharacters) =>
      currentCharacters.map((character) => {
        const strippedSheet = stripItemReferencesFromSheet(character.sheet, itemId);

        if (characterId && character.id === characterId) {
          return {
            ...character,
            sheet: assignItemReferencesToSheet(strippedSheet, itemId),
          };
        }

        return {
          ...character,
          sheet: strippedSheet,
        };
      })
    );
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              assignedCharacterId: characterId,
            }
          : item
      )
    );
  }

  function selectCharacter(characterId: string): void {
    const selectedCharacter = characters.find((character) => character.id === characterId);
    if (!selectedCharacter) {
      return;
    }

    if (selectedCharacter.ownerRole === "dm") {
      setActiveDmCharacterId(characterId);
      return;
    }

    setActivePlayerCharacterId(characterId);
  }

  function deleteCharacter(characterId: string): void {
    setCharacters((currentCharacters) =>
      currentCharacters.filter((character) => character.id !== characterId)
    );
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.assignedCharacterId === characterId
          ? {
              ...item,
              assignedCharacterId: null,
            }
          : item
      )
    );
    setActivePlayerCharacterId((currentActiveCharacterId) =>
      currentActiveCharacterId === characterId ? null : currentActiveCharacterId
    );
    setActiveDmCharacterId((currentActiveCharacterId) =>
      currentActiveCharacterId === characterId ? null : currentActiveCharacterId
    );
  }

  function updateCharacter(
    characterId: string,
    updater: CharacterDraft | ((current: CharacterDraft) => CharacterDraft)
  ): void {
    setCharacters((currentCharacters) =>
      currentCharacters.map((character) => {
        if (character.id !== characterId) {
          return character;
        }

        const nextSheet =
          typeof updater === "function" ? updater(character.sheet) : updater;

        return {
          ...character,
          sheet: normalizeCharacterDraft(nextSheet),
        };
      })
    );
  }

  function replaceCharacters(nextCharacters: CharacterRecord[]): void {
    setCharacters(
      nextCharacters.map((character) => ({
        ...character,
        sheet: normalizeCharacterDraft(character.sheet),
      }))
    );
  }

  function updateKnowledgeState(
    updater: KnowledgeState | ((current: KnowledgeState) => KnowledgeState)
  ): void {
    setKnowledgeState((currentState) =>
      typeof updater === "function" ? updater(currentState) : updater
    );
  }

  function beginCombatEncounter(encounter: CombatEncounterState): void {
    setActiveCombatEncounter(encounter);
  }

  function updateCombatEncounter(
    updater:
      | CombatEncounterState
      | ((current: CombatEncounterState) => CombatEncounterState)
  ): void {
    setActiveCombatEncounter((currentEncounter) => {
      if (!currentEncounter) {
        return currentEncounter;
      }

      return typeof updater === "function" ? updater(currentEncounter) : updater;
    });
  }

  function clearCombatEncounter(): void {
    setActiveCombatEncounter(null);
  }

  return (
    <AppFlowContext.Provider
      value={{
        authChoice,
        roleChoice,
        characters,
        itemCategoryDefinitions,
        itemSubcategoryDefinitions,
        itemBlueprints,
        items,
        knowledgeEntities: knowledgeState.knowledgeEntities,
        knowledgeRevisions: knowledgeState.knowledgeRevisions,
        knowledgeOwnerships: knowledgeState.knowledgeOwnerships,
        activePlayerCharacter,
        activeDmCharacter,
        activeCombatEncounter,
        chooseAuth: setAuthChoice,
        chooseRole: setRoleChoice,
        createCharacter,
        createItem,
        updateItem,
        deleteItem,
        createItemCategoryDefinition,
        updateItemCategoryDefinition,
        deleteItemCategoryDefinition,
        createItemSubcategoryDefinition,
        updateItemSubcategoryDefinition,
        deleteItemSubcategoryDefinition,
        createItemBlueprint,
        updateItemBlueprint,
        deleteItemBlueprint,
        assignItemToCharacter,
        selectCharacter,
        deleteCharacter,
        updateCharacter,
        replaceCharacters,
        updateKnowledgeState,
        beginCombatEncounter,
        updateCombatEncounter,
        clearCombatEncounter,
      }}
    >
      {children}
    </AppFlowContext.Provider>
  );
}

export function useAppFlow(): AppFlowContextValue {
  const context = useContext(AppFlowContext);

  if (!context) {
    throw new Error("useAppFlow must be used within an AppFlowProvider.");
  }

  return context;
}
