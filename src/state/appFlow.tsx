import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  PLAYER_CHARACTER_TEMPLATE,
  type CharacterDraft,
} from "../config/characterTemplate";

type AuthChoice = "login" | "signup" | null;
type RoleChoice = "player" | "dm" | null;

type CharacterRecord = {
  id: string;
  sheet: CharacterDraft;
};

type AppFlowContextValue = {
  authChoice: AuthChoice;
  roleChoice: RoleChoice;
  characters: CharacterRecord[];
  activeCharacter: CharacterRecord | null;
  chooseAuth: (choice: Exclude<AuthChoice, null>) => void;
  chooseRole: (choice: Exclude<RoleChoice, null>) => void;
  createCharacter: () => string;
  selectCharacter: (characterId: string) => void;
  deleteCharacter: (characterId: string) => void;
  updateActiveCharacter: (updater: CharacterDraft | ((current: CharacterDraft) => CharacterDraft)) => void;
};

const AppFlowContext = createContext<AppFlowContextValue | null>(null);

export function AppFlowProvider({ children }: PropsWithChildren) {
  const [authChoice, setAuthChoice] = useState<AuthChoice>(null);
  const [roleChoice, setRoleChoice] = useState<RoleChoice>(null);
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);

  const activeCharacter = useMemo(
    () => characters.find((character) => character.id === activeCharacterId) ?? null,
    [activeCharacterId, characters]
  );

  function createCharacter(): string {
    const characterId = `character-${Date.now()}-${characters.length + 1}`;

    setCharacters((currentCharacters) => [
      ...currentCharacters,
      {
        id: characterId,
        sheet: PLAYER_CHARACTER_TEMPLATE.createInstance(),
      },
    ]);
    setActiveCharacterId(characterId);

    return characterId;
  }

  function selectCharacter(characterId: string): void {
    setActiveCharacterId(characterId);
  }

  function deleteCharacter(characterId: string): void {
    setCharacters((currentCharacters) =>
      currentCharacters.filter((character) => character.id !== characterId)
    );
    setActiveCharacterId((currentActiveCharacterId) =>
      currentActiveCharacterId === characterId ? null : currentActiveCharacterId
    );
  }

  function updateActiveCharacter(
    updater: CharacterDraft | ((current: CharacterDraft) => CharacterDraft)
  ): void {
    if (!activeCharacterId) {
      return;
    }

    setCharacters((currentCharacters) =>
      currentCharacters.map((character) => {
        if (character.id !== activeCharacterId) {
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

  return (
    <AppFlowContext.Provider
      value={{
        authChoice,
        roleChoice,
        characters,
        activeCharacter,
        chooseAuth: setAuthChoice,
        chooseRole: setRoleChoice,
        createCharacter,
        selectCharacter,
        deleteCharacter,
        updateActiveCharacter,
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
