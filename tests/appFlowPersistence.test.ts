import assert from "node:assert/strict";

import {
  CHARACTER_DRAFT_SCHEMA_VERSION,
  PLAYER_CHARACTER_TEMPLATE,
} from "../src/config/characterTemplate.ts";
import { buildItemIndex, createSharedItemRecord } from "../src/lib/items.ts";
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
        assert.equal(state.items.length, 0);
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
        const item = createSharedItemRecord("weapon:one_handed", {
          id: "item-1",
          name: "Writer Blade",
        });
        const payload = serializePersistedCharacters({
          characters: [{ id: "writer-1", ownerRole: "player", sheet }],
          items: [item],
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
            items: [item],
            activePlayerCharacterId: "writer-1",
            activeDmCharacterId: null,
          }
        );

        assert.equal(payload.version, CHARACTER_DRAFT_SCHEMA_VERSION);
        assert.equal(payload.items?.length, 1);
        assert.equal(payload.activePlayerCharacterId, "writer-1");
        assert.equal(payload.characters[0]?.ownerRole, "player");
        assert.equal(
          JSON.parse(writes.get(CHARACTER_STORAGE_KEY) ?? "{}").activePlayerCharacterId,
          "writer-1"
        );
      },
    },
    {
      name: "hydratePersistedCharacters migrates legacy embedded inventory into shared items",
      run: () => {
        const legacySheet = PLAYER_CHARACTER_TEMPLATE.createInstance() as unknown as Record<string, unknown>;
        delete legacySheet.ownedItemIds;
        delete legacySheet.inventoryItemIds;
        delete legacySheet.activeItemIds;
        legacySheet.inventory = [
          {
            name: "Legacy Sword",
            category: "weapon",
            note: "Old steel blade",
            qualityTier: "Rare",
            revealedSpec: "+1 hit",
            identified: true,
          },
        ];
        legacySheet.equipment = [
          {
            slot: "Main Hand",
            item: "Legacy Sword",
            effect: "Equipped",
            qualityTier: "Rare",
            revealedSpec: "+1 hit",
            identified: true,
          },
        ];

        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: 5,
            characters: [{ id: "legacy-1", ownerRole: "player", sheet: legacySheet }],
          })
        );

        assert.equal(state.items.length, 2);
        assert.equal(state.characters[0]?.sheet.ownedItemIds.length, 2);
        assert.equal(state.characters[0]?.sheet.inventoryItemIds.length, 2);
        assert.equal(state.characters[0]?.sheet.equipment[0]?.itemId, "item-legacy-1-legacy-equipment-0");
        const itemIndex = buildItemIndex(state.items);
        assert.equal(itemIndex["item-legacy-1-legacy-inventory-0"]?.knowledge.visibleCharacterIds[0], "legacy-1");
      },
    },
  ]);
}
