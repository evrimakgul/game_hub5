import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CHARACTER_DRAFT_SCHEMA_VERSION,
  PLAYER_CHARACTER_TEMPLATE,
  type CharacterDraft,
  hydrateCharacterDraft,
} from "../config/characterTemplate";
import type { CombatEngineState } from "../types/combatEngine";

type AuthChoice = "login" | "signup" | null;
type RoleChoice = "player" | "dm" | null;
export type CharacterOwnerRole = "player" | "dm";

export type CharacterRecord = {
  id: string;
  ownerRole: CharacterOwnerRole;
  sheet: CharacterDraft;
};

type PersistedCharacterEnvelope = {
  version: number;
  characters: Array<{ id: string; ownerRole?: unknown; sheet: unknown }>;
  activeCharacterId?: string | null;
  activePlayerCharacterId?: string | null;
  activeDmCharacterId?: string | null;
};

type AppFlowContextValue = {
  authChoice: AuthChoice;
  roleChoice: RoleChoice;
  characters: CharacterRecord[];
  activePlayerCharacter: CharacterRecord | null;
  activeDmCharacter: CharacterRecord | null;
  activeCombat: CombatEngineState | null;
  chooseAuth: (choice: Exclude<AuthChoice, null>) => void;
  chooseRole: (choice: Exclude<RoleChoice, null>) => void;
  createCharacter: (ownerRole?: CharacterOwnerRole) => string;
  selectCharacter: (characterId: string) => void;
  deleteCharacter: (characterId: string) => void;
  updateCharacter: (
    characterId: string,
    updater: CharacterDraft | ((current: CharacterDraft) => CharacterDraft)
  ) => void;
  beginCombatEncounter: (combatState: CombatEngineState) => void;
  updateCombatEncounter: (
    updater:
      | CombatEngineState
      | ((current: CombatEngineState) => CombatEngineState)
  ) => void;
  clearCombatEncounter: () => void;
};

const AppFlowContext = createContext<AppFlowContextValue | null>(null);
const CHARACTER_STORAGE_KEY = "convergence.local.characters";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOwnerRole(value: unknown): CharacterOwnerRole {
  return value === "dm" ? "dm" : "player";
}

function readPersistedCharacters(): {
  characters: CharacterRecord[];
  activePlayerCharacterId: string | null;
  activeDmCharacterId: string | null;
} {
  if (typeof window === "undefined") {
    return {
      characters: [],
      activePlayerCharacterId: null,
      activeDmCharacterId: null,
    };
  }

  const rawValue = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
  if (!rawValue) {
    return {
      characters: [],
      activePlayerCharacterId: null,
      activeDmCharacterId: null,
    };
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsed)) {
      return {
        characters: [],
        activePlayerCharacterId: null,
        activeDmCharacterId: null,
      };
    }

    const envelope = parsed as Partial<PersistedCharacterEnvelope>;
    const characters = Array.isArray(envelope.characters)
      ? envelope.characters.flatMap((entry) => {
          if (!isRecord(entry) || typeof entry.id !== "string") {
            return [];
          }

          return [
            {
              id: entry.id,
              ownerRole: normalizeOwnerRole(entry.ownerRole),
              sheet: hydrateCharacterDraft(entry.sheet),
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
    return {
      characters: [],
      activePlayerCharacterId: null,
      activeDmCharacterId: null,
    };
  }
}

export function AppFlowProvider({ children }: PropsWithChildren) {
  const persistedCharacters = useMemo(readPersistedCharacters, []);
  const [authChoice, setAuthChoice] = useState<AuthChoice>(null);
  const [roleChoice, setRoleChoice] = useState<RoleChoice>(null);
  const [characters, setCharacters] = useState<CharacterRecord[]>(persistedCharacters.characters);
  const [activePlayerCharacterId, setActivePlayerCharacterId] = useState<string | null>(
    persistedCharacters.activePlayerCharacterId
  );
  const [activeDmCharacterId, setActiveDmCharacterId] = useState<string | null>(
    persistedCharacters.activeDmCharacterId
  );
  const [activeCombat, setActiveCombat] = useState<CombatEngineState | null>(null);

  const activePlayerCharacter = useMemo(
    () => characters.find((character) => character.id === activePlayerCharacterId) ?? null,
    [activePlayerCharacterId, characters]
  );
  const activeDmCharacter = useMemo(
    () => characters.find((character) => character.id === activeDmCharacterId) ?? null,
    [activeDmCharacterId, characters]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload: PersistedCharacterEnvelope = {
      version: CHARACTER_DRAFT_SCHEMA_VERSION,
      characters: characters.map((character) => ({
        id: character.id,
        ownerRole: character.ownerRole,
        sheet: character.sheet,
      })),
      activePlayerCharacterId,
      activeDmCharacterId,
    };

    window.localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(payload));
  }, [activeDmCharacterId, activePlayerCharacterId, characters]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleStorage(event: StorageEvent): void {
      if (event.key !== CHARACTER_STORAGE_KEY) {
        return;
      }

      const nextState = readPersistedCharacters();
      setCharacters(nextState.characters);
      setActivePlayerCharacterId(nextState.activePlayerCharacterId);
      setActiveDmCharacterId(nextState.activeDmCharacterId);
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
          sheet: nextSheet,
        };
      })
    );
  }

  function beginCombatEncounter(combatState: CombatEngineState): void {
    setActiveCombat(combatState);
  }

  function updateCombatEncounter(
    updater:
      | CombatEngineState
      | ((current: CombatEngineState) => CombatEngineState)
  ): void {
    setActiveCombat((currentCombat) => {
      if (!currentCombat) {
        return currentCombat;
      }

      return typeof updater === "function" ? updater(currentCombat) : updater;
    });
  }

  function clearCombatEncounter(): void {
    setActiveCombat(null);
  }

  return (
    <AppFlowContext.Provider
      value={{
        authChoice,
        roleChoice,
        characters,
        activePlayerCharacter,
        activeDmCharacter,
        activeCombat,
        chooseAuth: setAuthChoice,
        chooseRole: setRoleChoice,
        createCharacter,
        selectCharacter,
        deleteCharacter,
        updateCharacter,
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
