import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  CHARACTER_STORAGE_KEY,
  hydratePersistedCharacters,
  serializePersistedCharacters,
  writePersistedCharactersToStorage,
} from "../src/state/appFlowPersistence.ts";
import { runTestSuite } from "./harness.ts";

export async function runAppFlowPersistenceTests(): Promise<void> {
  await runTestSuite("appFlowPersistence", [
    {
      name: "hydratePersistedCharacters restores characters and legacy active ids",
      run: () => {
        const playerSheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        playerSheet.name = "Player One";
        const dmSheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        dmSheet.name = "DM One";

        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: 4,
            characters: [
              { id: "player-1", ownerRole: "player", sheet: playerSheet },
              { id: "dm-1", ownerRole: "dm", sheet: dmSheet },
            ],
            activeCharacterId: "dm-1",
          })
        );

        assert.equal(state.characters.length, 2);
        assert.equal(state.activePlayerCharacterId, null);
        assert.equal(state.activeDmCharacterId, "dm-1");
      },
    },
    {
      name: "hydratePersistedCharacters falls back invalid owner roles to player",
      run: () => {
        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: 4,
            characters: [
              {
                id: "mystery-1",
                ownerRole: "unknown",
                sheet: PLAYER_CHARACTER_TEMPLATE.createInstance(),
              },
            ],
          })
        );

        assert.equal(state.characters[0]?.ownerRole, "player");
      },
    },
    {
      name: "serialize and write helpers persist the current schema shape",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.name = "Writer";
        const payload = serializePersistedCharacters({
          characters: [{ id: "writer-1", ownerRole: "player", sheet }],
          activePlayerCharacterId: "writer-1",
          activeDmCharacterId: null,
        });
        const writes = new Map<string, string>();

        writePersistedCharactersToStorage(
          {
            setItem: (key, value) => {
              writes.set(key, value);
            },
          },
          {
            characters: [{ id: "writer-1", ownerRole: "player", sheet }],
            activePlayerCharacterId: "writer-1",
            activeDmCharacterId: null,
          }
        );

        assert.equal(payload.version, 4);
        assert.equal(payload.activePlayerCharacterId, "writer-1");
        assert.equal(payload.characters[0]?.ownerRole, "player");
        assert.equal(
          JSON.parse(writes.get(CHARACTER_STORAGE_KEY) ?? "{}").activePlayerCharacterId,
          "writer-1"
        );
      },
    },
  ]);
}
