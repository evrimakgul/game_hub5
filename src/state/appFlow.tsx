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
import { createSharedItemRecord } from "../lib/items.ts";
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
import type { ItemBlueprintId, SharedItemRecord } from "../types/items.ts";
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
        "name" | "itemLevel" | "qualityTier" | "baseDescription" | "bonusProfile" | "knowledge"
      >
    >
  ) => string;
  updateItem: (
    itemId: string,
    updater: SharedItemRecord | ((current: SharedItemRecord) => SharedItemRecord)
  ) => void;
  deleteItem: (itemId: string) => void;
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
  const [items, setItems] = useState<SharedItemRecord[]>(persistedCharacters.items);
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
        items,
        ...knowledgeState,
        activePlayerCharacterId,
        activeDmCharacterId,
      }
    );
  }, [activeDmCharacterId, activePlayerCharacterId, characters, items, knowledgeState]);

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

  function createItem(
    blueprintId: ItemBlueprintId,
    overrides: Partial<
      Pick<
        SharedItemRecord,
        "name" | "itemLevel" | "qualityTier" | "baseDescription" | "bonusProfile" | "knowledge"
      >
    > = {}
  ): string {
    const nextItem = createSharedItemRecord(blueprintId, overrides);
    setItems((currentItems) => [...currentItems, nextItem]);
    return nextItem.id;
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

        return typeof updater === "function" ? updater(item) : updater;
      })
    );
  }

  function deleteItem(itemId: string): void {
    setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
    setCharacters((currentCharacters) =>
      currentCharacters.map((character) => ({
        ...character,
        sheet: normalizeCharacterDraft({
          ...character.sheet,
          ownedItemIds: character.sheet.ownedItemIds.filter((entry) => entry !== itemId),
          inventoryItemIds: character.sheet.inventoryItemIds.filter((entry) => entry !== itemId),
          activeItemIds: character.sheet.activeItemIds.filter((entry) => entry !== itemId),
          equipment: character.sheet.equipment.map((entry) =>
            entry.itemId === itemId ? { ...entry, itemId: null } : entry
          ),
        }),
      }))
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
