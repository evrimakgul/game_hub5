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
  completeAuctionTransaction as resolveCompletedAuctionTransaction,
  createDefaultAuctionHouseEntries,
  normalizeAuctionHouseEntry,
} from "../lib/auctionHouse.ts";
import {
  buildItemIndex,
  createItemCategoryDefinitionRecord,
  createItemBlueprintRecord,
  createItemSubcategoryDefinitionRecord,
  createSharedItemRecord,
  normalizeCharacterEquipmentAnchors,
  syncItemsWithBlueprint,
  syncSharedItemRecordWithBlueprint,
  updateBlueprintOverrideList,
} from "../lib/items.ts";
import type { AuctionHouseEntry, AuctionTransactionMode } from "../types/auction.ts";
import {
  createEmptyMobGroup,
  createEmptyMobTemplate,
  normalizeMobTemplateSheet,
  createEmptyPortalTemplate,
  type AuthoringContentState,
} from "../lib/authoring.ts";
import {
  CHARACTER_STORAGE_KEY,
  readPersistedCharactersFromStorage,
  type PersistedCharacterState,
  writePersistedCharactersToStorage,
} from "./appFlowPersistence";
import { WorldExecutionEngine } from "../engine/worldExecutionEngine.ts";
import { setCharacterSupplementarySlotEnabled as setCharacterSupplementarySlotEnabledOnSheet } from "../mutations/characterItemMutations.ts";
import {
  executeArtifactAppraisalWorldCast,
  prepareWorldCastRequest,
} from "../lib/worldCasting.ts";
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
  SupplementaryEquipmentSlotId,
} from "../types/items.ts";
import type { WorldCastRequestPayload } from "../lib/powerCasting.ts";
import type {
  KnowledgeEntity,
  KnowledgeOwnership,
  KnowledgeRevision,
  KnowledgeState,
} from "../types/knowledge.ts";
import type { MobGroup, MobTemplate, PortalTemplate } from "../types/authoring.ts";
import { getIsoTimestamp } from "../lib/ids.ts";

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
  auctionEntries: AuctionHouseEntry[];
  knowledgeEntities: KnowledgeEntity[];
  knowledgeRevisions: KnowledgeRevision[];
  knowledgeOwnerships: KnowledgeOwnership[];
  mobTemplates: MobTemplate[];
  mobGroups: MobGroup[];
  portalTemplates: PortalTemplate[];
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
        | "auctionEntryId"
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
  duplicateItem: (itemId: string) => string | null;
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
  replaceAuctionEntries: (entries: AuctionHouseEntry[]) => void;
  resetAuctionEntries: () => void;
  completeAuctionTransaction: (args: {
    entryId: string;
    characterId: string;
    mode: AuctionTransactionMode;
  }) => { itemId: string; message: string } | { error: string };
  selectCharacter: (characterId: string) => void;
  deleteCharacter: (characterId: string) => void;
  updateCharacter: (
    characterId: string,
    updater: CharacterDraft | ((current: CharacterDraft) => CharacterDraft)
  ) => void;
  setCharacterSupplementarySlotEnabled: (
    characterId: string,
    slotId: SupplementaryEquipmentSlotId,
    isEnabled: boolean
  ) => void;
  replaceCharacters: (characters: CharacterRecord[]) => void;
  updateKnowledgeState: (
    updater: KnowledgeState | ((current: KnowledgeState) => KnowledgeState)
  ) => void;
  createMobTemplate: (overrides?: Partial<MobTemplate>) => string;
  updateMobTemplate: (
    mobTemplateId: string,
    updater: MobTemplate | ((current: MobTemplate) => MobTemplate)
  ) => void;
  deleteMobTemplate: (mobTemplateId: string) => void;
  createMobGroup: (overrides?: Partial<MobGroup>) => string;
  updateMobGroup: (
    mobGroupId: string,
    updater: MobGroup | ((current: MobGroup) => MobGroup)
  ) => void;
  deleteMobGroup: (mobGroupId: string) => void;
  createPortalTemplate: (overrides?: Partial<PortalTemplate>) => string;
  updatePortalTemplate: (
    portalTemplateId: string,
    updater: PortalTemplate | ((current: PortalTemplate) => PortalTemplate)
  ) => void;
  deletePortalTemplate: (portalTemplateId: string) => void;
  updateAuthoringState: (
    updater:
      | AuthoringContentState
      | ((current: AuthoringContentState) => AuthoringContentState)
  ) => void;
  executeWorldCast: (payload: WorldCastRequestPayload) => string | null;
  executeArtifactAppraisal: (args: {
    casterCharacterId: string;
    itemId: string;
    artifactAppraisalLevel: number;
  }) => string | null;
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
  const [auctionEntries, setAuctionEntries] = useState<AuctionHouseEntry[]>(persistedCharacters.auctionEntries);
  const [starterItemsInitialized] = useState<boolean>(persistedCharacters.starterItemsInitialized);
  const [knowledgeState, setKnowledgeState] = useState<KnowledgeState>({
    knowledgeEntities: persistedCharacters.knowledgeEntities,
    knowledgeRevisions: persistedCharacters.knowledgeRevisions,
    knowledgeOwnerships: persistedCharacters.knowledgeOwnerships,
  });
  const [authoringState, setAuthoringState] = useState<AuthoringContentState>({
    mobTemplates: persistedCharacters.mobTemplates,
    mobGroups: persistedCharacters.mobGroups,
    portalTemplates: persistedCharacters.portalTemplates,
  });
  const [activePlayerCharacterId, setActivePlayerCharacterId] = useState<string | null>(
    persistedCharacters.activePlayerCharacterId
  );
  const [activeDmCharacterId, setActiveDmCharacterId] = useState<string | null>(
    persistedCharacters.activeDmCharacterId
  );
  const [activeCombatEncounter, setActiveCombatEncounter] =
    useState<CombatEncounterState | null>(persistedCharacters.activeCombatEncounter);

  const activePlayerCharacter = useMemo(
    () => characters.find((character) => character.id === activePlayerCharacterId) ?? null,
    [activePlayerCharacterId, characters]
  );
  const activeDmCharacter = useMemo(
    () => characters.find((character) => character.id === activeDmCharacterId) ?? null,
    [activeDmCharacterId, characters]
  );

  useEffect(() => {
    setCharacters((currentCharacters) => {
      let didChange = false;
      const normalizedCharacters = currentCharacters.map((character) => {
        const normalizedSheet = normalizeSheetEquipment(character.sheet);
        const equipmentChanged =
          normalizedSheet.equipment.length !== character.sheet.equipment.length ||
          normalizedSheet.equipment.some((entry, index) => {
            const previousEntry = character.sheet.equipment[index];
            return (
              !previousEntry ||
              previousEntry.slot !== entry.slot ||
              previousEntry.itemId !== entry.itemId ||
              previousEntry.anchorSlot !== entry.anchorSlot
            );
          });

        if (!equipmentChanged) {
          return character;
        }

        didChange = true;
        return {
          ...character,
          sheet: normalizedSheet,
        };
      });

      return didChange ? normalizedCharacters : currentCharacters;
    });
  }, [itemBlueprints, itemCategoryDefinitions, itemSubcategoryDefinitions, items]);

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
        auctionEntries,
        ...knowledgeState,
        ...authoringState,
        activeCombatEncounter,
        starterItemsInitialized,
        activePlayerCharacterId,
        activeDmCharacterId,
      }
    );
  }, [activeCombatEncounter, activeDmCharacterId, activePlayerCharacterId, auctionEntries, authoringState, characters, itemBlueprints, itemCategoryDefinitions, itemSubcategoryDefinitions, items, knowledgeState, starterItemsInitialized]);

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
      setAuctionEntries(nextState.auctionEntries);
      setKnowledgeState({
        knowledgeEntities: nextState.knowledgeEntities,
        knowledgeRevisions: nextState.knowledgeRevisions,
        knowledgeOwnerships: nextState.knowledgeOwnerships,
      });
      setAuthoringState({
        mobTemplates: nextState.mobTemplates,
        mobGroups: nextState.mobGroups,
        portalTemplates: nextState.portalTemplates,
      });
      setActiveCombatEncounter(nextState.activeCombatEncounter);
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

  function normalizeSheetEquipment(sheet: CharacterDraft): CharacterDraft {
    return normalizeCharacterEquipmentAnchors(
      normalizeCharacterDraft(sheet),
      buildItemIndex(items),
      {
        itemBlueprints,
        itemCategoryDefinitions,
        itemSubcategoryDefinitions,
      }
    );
  }

  function createMobTemplate(overrides: Partial<MobTemplate> = {}): string {
    const nextTemplate = createEmptyMobTemplate(overrides);
    setAuthoringState((currentState) => ({
      ...currentState,
      mobTemplates: [...currentState.mobTemplates, nextTemplate],
    }));
    return nextTemplate.id;
  }

  function updateMobTemplate(
    mobTemplateId: string,
    updater: MobTemplate | ((current: MobTemplate) => MobTemplate)
  ): void {
    setAuthoringState((currentState) => ({
      ...currentState,
      mobTemplates: currentState.mobTemplates.map((template) => {
        if (template.id !== mobTemplateId) {
          return template;
        }

        const nextTemplate =
          typeof updater === "function" ? updater(template) : updater;
        return {
          ...nextTemplate,
          id: template.id,
          name: nextTemplate.name.trim() || nextTemplate.sheet.name.trim() || template.name,
          sheet: normalizeMobTemplateSheet({
            ...nextTemplate.sheet,
            name:
              nextTemplate.name.trim() ||
              nextTemplate.sheet.name.trim() ||
              template.sheet.name,
          }),
          updatedAt: getIsoTimestamp(),
        };
      }),
    }));
  }

  function deleteMobTemplate(mobTemplateId: string): void {
    setAuthoringState((currentState) => ({
      ...currentState,
      mobTemplates: currentState.mobGroups.some((group) =>
        group.members.some((member) => member.mobTemplateId === mobTemplateId)
      )
        ? currentState.mobTemplates
        : currentState.mobTemplates.filter((template) => template.id !== mobTemplateId),
    }));
  }

  function createMobGroup(overrides: Partial<MobGroup> = {}): string {
    const nextGroup = createEmptyMobGroup(overrides);
    setAuthoringState((currentState) => ({
      ...currentState,
      mobGroups: [...currentState.mobGroups, nextGroup],
    }));
    return nextGroup.id;
  }

  function updateMobGroup(
    mobGroupId: string,
    updater: MobGroup | ((current: MobGroup) => MobGroup)
  ): void {
    setAuthoringState((currentState) => ({
      ...currentState,
      mobGroups: currentState.mobGroups.map((group) => {
        if (group.id !== mobGroupId) {
          return group;
        }

        const nextGroup = typeof updater === "function" ? updater(group) : updater;
        return {
          ...nextGroup,
          id: group.id,
          updatedAt: getIsoTimestamp(),
        };
      }),
    }));
  }

  function deleteMobGroup(mobGroupId: string): void {
    setAuthoringState((currentState) => ({
      ...currentState,
      mobGroups: currentState.portalTemplates.some((portal) =>
        portal.stages.some((stage) =>
          stage.groupReferences.some((reference) => reference.mobGroupId === mobGroupId)
        )
      )
        ? currentState.mobGroups
        : currentState.mobGroups.filter((group) => group.id !== mobGroupId),
    }));
  }

  function createPortalTemplate(overrides: Partial<PortalTemplate> = {}): string {
    const nextPortal = createEmptyPortalTemplate(overrides);
    setAuthoringState((currentState) => ({
      ...currentState,
      portalTemplates: [...currentState.portalTemplates, nextPortal],
    }));
    return nextPortal.id;
  }

  function updatePortalTemplate(
    portalTemplateId: string,
    updater: PortalTemplate | ((current: PortalTemplate) => PortalTemplate)
  ): void {
    setAuthoringState((currentState) => ({
      ...currentState,
      portalTemplates: currentState.portalTemplates.map((portal) => {
        if (portal.id !== portalTemplateId) {
          return portal;
        }

        const nextPortal = typeof updater === "function" ? updater(portal) : updater;
        return {
          ...nextPortal,
          id: portal.id,
          updatedAt: getIsoTimestamp(),
        };
      }),
    }));
  }

  function deletePortalTemplate(portalTemplateId: string): void {
    setAuthoringState((currentState) => ({
      ...currentState,
      portalTemplates: currentState.portalTemplates.filter(
        (portal) => portal.id !== portalTemplateId
      ),
    }));
  }

  function updateAuthoringState(
    updater:
      | AuthoringContentState
      | ((current: AuthoringContentState) => AuthoringContentState)
  ): void {
    setAuthoringState((currentState) =>
      typeof updater === "function" ? updater(currentState) : updater
    );
  }

  function stripItemReferencesFromSheet(sheet: CharacterDraft, itemId: string): CharacterDraft {
    return normalizeSheetEquipment({
      ...sheet,
      ownedItemIds: sheet.ownedItemIds.filter((entry) => entry !== itemId),
      inventoryItemIds: sheet.inventoryItemIds.filter((entry) => entry !== itemId),
      activeItemIds: sheet.activeItemIds.filter((entry) => entry !== itemId),
      equipment: sheet.equipment.map((entry) =>
        entry.itemId === itemId ? { ...entry, itemId: null, anchorSlot: null } : entry
      ),
    });
  }

  function assignItemReferencesToSheet(sheet: CharacterDraft, itemId: string): CharacterDraft {
    return normalizeSheetEquipment({
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
        | "auctionEntryId"
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

  function duplicateItem(itemId: string): string | null {
    const sourceItem = items.find((item) => item.id === itemId) ?? null;
    if (!sourceItem) {
      return null;
    }

    const nextName = sourceItem.name.trim().length > 0 ? `${sourceItem.name} Copy` : "Item Copy";
    const nextItem = createSharedItemRecord(
      sourceItem.blueprintId,
      {
        auctionEntryId: sourceItem.auctionEntryId,
        name: nextName,
        isArtifact: sourceItem.isArtifact,
        baseDescription: sourceItem.baseDescription,
        baseOverrides: sourceItem.baseOverrides,
        bonusProfile: sourceItem.bonusProfile,
        customProperties: sourceItem.customProperties,
        baseStrength: sourceItem.baseStrength,
        anchorValueOverride: sourceItem.anchorValueOverride,
      },
      itemBlueprints
    );
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
        nextDefinition = createItemSubcategoryDefinitionRecord({
          ...updated,
          id: definition.id,
        });
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

  function replaceAuctionEntries(entries: AuctionHouseEntry[]): void {
    setAuctionEntries(entries.map((entry) => normalizeAuctionHouseEntry(entry)));
  }

  function resetAuctionEntries(): void {
    setAuctionEntries(createDefaultAuctionHouseEntries());
  }

  function completeAuctionTransaction(args: {
    entryId: string;
    characterId: string;
    mode: AuctionTransactionMode;
  }): { itemId: string; message: string } | { error: string } {
    const character =
      characters.find((candidate) => candidate.id === args.characterId) ?? null;
    const entry = auctionEntries.find((candidate) => candidate.id === args.entryId) ?? null;

    if (!character || !entry) {
      return { error: "The selected character or auction entry is no longer available." };
    }

    const resolution = resolveCompletedAuctionTransaction({
      entry,
      mode: args.mode,
      characterId: character.id,
      characterName: character.sheet.name.trim() || "Unnamed Character",
      characterMoney: character.sheet.money,
      characterGameDateTime: character.sheet.gameDateTime,
      itemBlueprints,
    });
    if ("error" in resolution) {
      return resolution;
    }

    setAuctionEntries((currentEntries) =>
      currentEntries.map((currentEntry) =>
        currentEntry.id === entry.id ? resolution.nextEntry : currentEntry
      )
    );
    setItems((currentItems) => [...currentItems, resolution.createdItem]);
    setCharacters((currentCharacters) =>
      currentCharacters.map((currentCharacter) => {
        if (currentCharacter.id !== character.id) {
          return currentCharacter;
        }

        return {
          ...currentCharacter,
          sheet: normalizeSheetEquipment({
            ...assignItemReferencesToSheet(
              currentCharacter.sheet,
              resolution.createdItem.id
            ),
            money: Math.max(0, currentCharacter.sheet.money - resolution.moneySpent),
            gameHistory: [
              resolution.historyEntry,
              ...(currentCharacter.sheet.gameHistory ?? []),
            ],
          }),
        };
      })
    );

    return {
      itemId: resolution.createdItem.id,
      message: resolution.message,
    };
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
          sheet: normalizeSheetEquipment(nextSheet),
        };
      })
    );
  }

  function setCharacterSupplementarySlotEnabled(
    characterId: string,
    slotId: SupplementaryEquipmentSlotId,
    isEnabled: boolean
  ): void {
    setCharacters((currentCharacters) =>
      currentCharacters.map((character) => {
        if (character.id !== characterId) {
          return character;
        }

        return {
          ...character,
          sheet: normalizeSheetEquipment(
            setCharacterSupplementarySlotEnabledOnSheet(character.sheet, slotId, isEnabled)
          ),
        };
      })
    );
  }

  function replaceCharacters(nextCharacters: CharacterRecord[]): void {
    setCharacters(
      nextCharacters.map((character) => ({
        ...character,
        sheet: normalizeSheetEquipment(character.sheet),
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

  function executeWorldCast(payload: WorldCastRequestPayload): string | null {
    const prepared = prepareWorldCastRequest({
      ...payload,
      itemsById: payload.itemsById ?? buildItemIndex(items),
    });
    if ("error" in prepared) {
      return prepared.error;
    }

    const engine = new WorldExecutionEngine({
      characters,
      knowledgeState,
      itemsById: payload.itemsById ?? buildItemIndex(items),
    });
    const execution = engine.executePreparedRequest(prepared.request);
    if ("error" in execution) {
      return execution.error;
    }

    replaceCharacters(execution.result.characters);
    updateKnowledgeState(execution.result.knowledgeState);
    return null;
  }

  function appendHistoryEntries(
    entries: Array<{ characterId: string; entry: CharacterRecord["sheet"]["gameHistory"][number] }>
  ): void {
    entries.forEach(({ characterId, entry }) => {
      updateCharacter(characterId, (currentSheet) => ({
        ...currentSheet,
        gameHistory: [entry, ...(currentSheet.gameHistory ?? [])],
      }));
    });
  }

  function executeArtifactAppraisal(args: {
    casterCharacterId: string;
    itemId: string;
    artifactAppraisalLevel: number;
  }): string | null {
    const casterCharacter =
      characters.find((character) => character.id === args.casterCharacterId) ?? null;
    const item = items.find((entry) => entry.id === args.itemId) ?? null;

    if (!casterCharacter || !item) {
      return "The selected character or item is no longer available.";
    }

    const result = executeArtifactAppraisalWorldCast({
      casterCharacter,
      item,
      artifactAppraisalLevel: args.artifactAppraisalLevel,
      knowledgeState,
      context: {
        itemBlueprints,
        itemCategoryDefinitions,
        itemSubcategoryDefinitions,
      },
    });
    if ("error" in result) {
      return result.error;
    }

    updateKnowledgeState(result.knowledgeState);
    updateItem(item.id, result.item);
    appendHistoryEntries(result.historyEntries);
    return null;
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
        auctionEntries,
        knowledgeEntities: knowledgeState.knowledgeEntities,
        knowledgeRevisions: knowledgeState.knowledgeRevisions,
        knowledgeOwnerships: knowledgeState.knowledgeOwnerships,
        mobTemplates: authoringState.mobTemplates,
        mobGroups: authoringState.mobGroups,
        portalTemplates: authoringState.portalTemplates,
        activePlayerCharacter,
        activeDmCharacter,
        activeCombatEncounter,
        chooseAuth: setAuthChoice,
        chooseRole: setRoleChoice,
        createCharacter,
        createItem,
        duplicateItem,
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
        replaceAuctionEntries,
        resetAuctionEntries,
        completeAuctionTransaction,
        selectCharacter,
        deleteCharacter,
        updateCharacter,
        setCharacterSupplementarySlotEnabled,
        replaceCharacters,
        updateKnowledgeState,
        createMobTemplate,
        updateMobTemplate,
        deleteMobTemplate,
        createMobGroup,
        updateMobGroup,
        deleteMobGroup,
        createPortalTemplate,
        updatePortalTemplate,
        deletePortalTemplate,
        updateAuthoringState,
        executeWorldCast,
        executeArtifactAppraisal,
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
