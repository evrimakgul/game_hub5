import assert from "node:assert/strict";

import {
  CHARACTER_DRAFT_SCHEMA_VERSION,
  PLAYER_CHARACTER_TEMPLATE,
  hydrateCharacterDraft,
} from "../src/config/characterTemplate.ts";
import { getResolvedResistanceLevel } from "../src/config/characterRuntime.ts";
import { buildItemIndex, createDefaultItemBlueprints, createSharedItemRecord } from "../src/lib/items.ts";
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
      name: "empty persisted state seeds starter items once",
      run: () => {
        const state = hydratePersistedCharacters(null);

        assert.equal(state.items.length, 5);
        assert.equal(state.starterItemsInitialized, true);
      },
    },
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
        assert.equal(state.items.length, 5);
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
          itemBlueprints: createDefaultItemBlueprints(),
          items: [item],
          knowledgeEntities: [],
          knowledgeRevisions: [],
          knowledgeOwnerships: [],
          starterItemsInitialized: true,
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
            itemBlueprints: createDefaultItemBlueprints(),
            items: [item],
            knowledgeEntities: [],
            knowledgeRevisions: [],
            knowledgeOwnerships: [],
            starterItemsInitialized: true,
            activePlayerCharacterId: "writer-1",
            activeDmCharacterId: null,
          }
        );

        assert.equal(payload.version, CHARACTER_DRAFT_SCHEMA_VERSION);
        assert.equal(payload.itemBlueprints?.length, createDefaultItemBlueprints().length);
        assert.equal(payload.itemInstances?.length, 1);
        assert.equal(payload.starterItemsInitialized, true);
        assert.equal(payload.activePlayerCharacterId, "writer-1");
        assert.equal(payload.characters[0]?.ownerRole, "player");
        assert.equal(
          JSON.parse(writes.get(CHARACTER_STORAGE_KEY) ?? "{}").activePlayerCharacterId,
          "writer-1"
        );
      },
    },
    {
      name: "hydratePersistedCharacters seeds starter items when legacy saves have no bootstrap flag",
      run: () => {
        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: 6,
            characters: [],
            items: [],
          })
        );

        assert.equal(state.items.length, 5);
        assert.equal(state.starterItemsInitialized, true);
      },
    },
    {
      name: "hydratePersistedCharacters does not recreate deleted starter items after bootstrap completes",
      run: () => {
        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: 6,
            characters: [],
            items: [],
            starterItemsInitialized: true,
          })
        );

        assert.equal(state.items.length, 0);
        assert.equal(state.starterItemsInitialized, true);
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

        assert.equal(state.items.length, 7);
        assert.equal(state.characters[0]?.sheet.ownedItemIds.length, 2);
        assert.equal(state.characters[0]?.sheet.inventoryItemIds.length, 2);
        assert.equal(state.characters[0]?.sheet.equipment[0]?.itemId, "item-legacy-1-legacy-equipment-0");
        const itemIndex = buildItemIndex(state.items);
        assert.equal(itemIndex["item-legacy-1-legacy-inventory-0"]?.knowledge.visibleCharacterIds[0], "legacy-1");
      },
    },
    {
      name: "hydratePersistedCharacters restores knowledge collections and drops legacy intel snapshot rows",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.gameHistory = [
          {
            id: "history-intel-1",
            type: "intel_snapshot",
            actualDateTime: "04.04.2026 12:00",
            gameDateTime: "17.09.2124 - 08:00",
            sourcePower: "Assess Character Lv 3",
            targetCharacterId: "target-1",
            targetName: "Ali",
            summary: "CR 1, Rank F",
            snapshot: {
              rank: "F",
              cr: 1,
              age: null,
              karma: "-0 / +0",
              biographyPrimary: "",
              resistances: [],
              combatSummary: [],
              stats: [],
              skills: [],
              powers: [],
              specials: [],
              notes: [],
            },
          },
          {
            id: "history-note-1",
            type: "note",
            actualDateTime: "04.04.2026 12:05",
            gameDateTime: "17.09.2124 - 08:05",
            note: "Normal note",
          },
        ];

        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: 6,
            characters: [{ id: "player-1", ownerRole: "player", sheet }],
            knowledgeEntities: [
              {
                id: "knowledge-entity-1",
                type: "character",
                subjectKey: "target-1",
                displayName: "Ali",
                createdAt: "2026-04-04T12:00:00.000Z",
                updatedAt: "2026-04-04T12:00:00.000Z",
              },
            ],
            knowledgeRevisions: [
              {
                id: "knowledge-revision-1",
                entityId: "knowledge-entity-1",
                revisionNumber: 1,
                title: "Ali Card",
                summary: "CR 1, Rank F",
                content: [
                  {
                    id: "knowledge-section-1",
                    title: "Summary",
                    kind: "summary",
                    entries: [{ id: "knowledge-entry-1", label: "Rank", value: "F" }],
                  },
                ],
                tags: ["character"],
                createdAt: "2026-04-04T12:00:00.000Z",
                createdByCharacterId: "player-1",
                sourceType: "spell",
                sourceSpellName: "Assess Character Lv 3",
                sourceHistoryEntryId: "history-intel-1",
                parentRevisionId: null,
                lineageMode: "observed",
                isCanonical: true,
              },
            ],
            knowledgeOwnerships: [
              {
                id: "knowledge-ownership-1",
                ownerCharacterId: "player-1",
                revisionId: "knowledge-revision-1",
                acquiredAt: "2026-04-04T12:00:00.000Z",
                acquiredFromCharacterId: null,
                localLabel: "",
                isArchived: false,
                isPinned: false,
              },
            ],
          })
        );

        assert.equal(state.characters[0]?.sheet.gameHistory.length, 1);
        assert.equal(state.characters[0]?.sheet.gameHistory[0]?.type, "note");
        assert.equal(state.knowledgeEntities.length, 1);
        assert.equal(state.knowledgeRevisions.length, 1);
        assert.equal(state.knowledgeOwnerships.length, 1);
      },
    },
    {
      name: "hydratePersistedCharacters preserves spell bonuses on shared items",
      run: () => {
        const item = createSharedItemRecord("mystic:mystic", {
          id: "spell-item-1",
          name: "Mystic Focus",
          bonusProfile: {
            ...createSharedItemRecord("mystic:mystic").bonusProfile,
            spellBonuses: {
              "awareness:assess_character": 1,
            },
          },
        });

        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: 6,
            characters: [],
            items: [item],
            starterItemsInitialized: true,
          })
        );

        assert.equal(
          buildItemIndex(state.items)["spell-item-1"]?.bonusProfile.spellBonuses["awareness:assess_character"],
          1
        );
      },
    },
    {
      name: "hydratePersistedCharacters normalizes legacy blueprint ids to the new authoritative catalog",
      run: () => {
        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: 6,
            characters: [],
            starterItemsInitialized: true,
            items: [
              createSharedItemRecord("weapon:bow", { id: "legacy-bow" }),
              createSharedItemRecord("armor:shield", { id: "legacy-shield" }),
              createSharedItemRecord("mystic:mystic", { id: "legacy-focus" }),
            ],
          })
        );
        const itemIndex = buildItemIndex(state.items);

        assert.equal(itemIndex["legacy-bow"]?.blueprintId, "weapon:ranged_light");
        assert.equal(itemIndex["legacy-shield"]?.blueprintId, "armor:shield_light");
        assert.equal(itemIndex["legacy-focus"]?.blueprintId, "mystic:focus");
      },
    },
    {
      name: "starter item instances are backed by persisted blueprints",
      run: () => {
        const state = hydratePersistedCharacters(null);
        const blueprintIds = new Set(state.itemBlueprints.map((blueprint) => blueprint.id));

        assert.ok(state.items.every((item) => blueprintIds.has(item.blueprintId)));
      },
    },
    {
      name: "hydratePersistedCharacters backfills legacy lessen darkness resistance modifiers",
      run: () => {
        const hydratedSheet = hydrateCharacterDraft({
          ...PLAYER_CHARACTER_TEMPLATE.createInstance(),
          activePowerEffects: [
          {
            id: "effect-1",
            stackKey: "light_support:expose_darkness",
            effectKind: "aura_shared",
            powerId: "light_support",
            powerName: "Light Support",
            sourceLevel: 5,
            casterCharacterId: "caster-1",
            casterName: "Beacon",
            targetCharacterId: "target-1",
            sourceEffectId: "source-1",
            shareMode: null,
            sharedTargetCharacterIds: null,
            label: "Lessen Darkness",
            summary: "-1 physical / elemental resistance",
            actionType: "standard",
            manaCost: null,
            selectedStatId: null,
            modifiers: [],
            appliedAt: new Date(0).toISOString(),
          },
          ],
          resistances: {
            ...PLAYER_CHARACTER_TEMPLATE.createInstance().resistances,
            fire: 1,
          },
        });

        assert.equal(hydratedSheet.activePowerEffects[0]?.modifiers.length, 6);
        assert.equal(getResolvedResistanceLevel(hydratedSheet, "fire"), 0);
      },
    },
  ]);
}
