import assert from "node:assert/strict";

import {
  CHARACTER_DRAFT_SCHEMA_VERSION,
  PLAYER_CHARACTER_TEMPLATE,
  hydrateCharacterDraft,
} from "../src/config/characterTemplate.ts";
import { getResolvedResistanceLevel } from "../src/config/characterRuntime.ts";
import {
  buildItemIndex,
  createDefaultItemBlueprints,
  createDefaultItemCategoryDefinitions,
  createDefaultItemSubcategoryDefinitions,
  getItemBlueprintOptions,
  createSharedItemRecord,
} from "../src/lib/items.ts";
import {
  CHARACTER_STORAGE_BACKUP_KEY,
  CHARACTER_STORAGE_KEY,
  hydratePersistedCharacters,
  readPersistedCharactersFromStorage,
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
          itemCategoryDefinitions: createDefaultItemCategoryDefinitions(),
          itemSubcategoryDefinitions: createDefaultItemSubcategoryDefinitions(),
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
            itemCategoryDefinitions: createDefaultItemCategoryDefinitions(),
            itemSubcategoryDefinitions: createDefaultItemSubcategoryDefinitions(),
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
        assert.equal(
          JSON.parse(writes.get(CHARACTER_STORAGE_BACKUP_KEY) ?? "{}").activePlayerCharacterId,
          "writer-1"
        );
      },
    },
    {
      name: "hydratePersistedCharacters infers a shared anchor for legacy multi-slot weapon entries",
      run: () => {
        const legacySheet = {
          ...PLAYER_CHARACTER_TEMPLATE.createInstance(),
          ownedItemIds: ["legacy-bow"],
          inventoryItemIds: ["legacy-bow"],
          equipment: [
            { slot: "weapon_primary", itemId: "legacy-bow" },
            { slot: "weapon_secondary", itemId: "legacy-bow" },
          ],
        };

        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: 6,
            characters: [{ id: "archer-1", ownerRole: "player", sheet: legacySheet }],
            items: [
              createSharedItemRecord("weapon:bow", {
                id: "legacy-bow",
                name: "Legacy Bow",
              }),
            ],
            starterItemsInitialized: true,
          })
        );

        assert.deepEqual(
          state.characters[0]?.sheet.equipment
            .filter((entry) => entry.slot === "weapon_primary" || entry.slot === "weapon_secondary")
            .map((entry) => [entry.slot, entry.itemId, entry.anchorSlot]),
          [
            ["weapon_primary", "legacy-bow", "weapon_primary"],
            ["weapon_secondary", "legacy-bow", "weapon_primary"],
          ]
        );
      },
    },
    {
      name: "supplementary slot enablement persists through serialize and hydrate",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.enabledSupplementarySlotIds = ["orbital", "charm"];

        const payload = serializePersistedCharacters({
          characters: [{ id: "support-1", ownerRole: "player", sheet }],
          itemCategoryDefinitions: createDefaultItemCategoryDefinitions(),
          itemSubcategoryDefinitions: createDefaultItemSubcategoryDefinitions(),
          itemBlueprints: createDefaultItemBlueprints(),
          items: [],
          knowledgeEntities: [],
          knowledgeRevisions: [],
          knowledgeOwnerships: [],
          starterItemsInitialized: true,
          activePlayerCharacterId: "support-1",
          activeDmCharacterId: null,
        });
        const hydrated = hydratePersistedCharacters(JSON.stringify(payload));

        assert.deepEqual(
          ((payload.characters[0]?.sheet as { enabledSupplementarySlotIds?: string[] } | undefined)
            ?.enabledSupplementarySlotIds ?? []),
          ["orbital", "charm"]
        );
        assert.deepEqual(
          hydrated.characters[0]?.sheet.enabledSupplementarySlotIds,
          ["orbital", "charm"]
        );
      },
    },
    {
      name: "serializePersistedCharacters keeps anchor-aware equipment entries",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.equipment = [
          { slot: "weapon_primary", itemId: "bow-1", anchorSlot: "weapon_primary" },
          { slot: "weapon_secondary", itemId: "bow-1", anchorSlot: "weapon_primary" },
          ...sheet.equipment.filter(
            (entry) => entry.slot !== "weapon_primary" && entry.slot !== "weapon_secondary"
          ),
        ];

        const payload = serializePersistedCharacters({
          characters: [{ id: "archer-2", ownerRole: "player", sheet }],
          itemCategoryDefinitions: createDefaultItemCategoryDefinitions(),
          itemSubcategoryDefinitions: createDefaultItemSubcategoryDefinitions(),
          itemBlueprints: createDefaultItemBlueprints(),
          items: [],
          knowledgeEntities: [],
          knowledgeRevisions: [],
          knowledgeOwnerships: [],
          starterItemsInitialized: true,
          activePlayerCharacterId: "archer-2",
          activeDmCharacterId: null,
        });
        const serializedEquipment =
          ((payload.characters[0]?.sheet as {
            equipment?: Array<{
              slot: string;
              itemId: string | null;
              anchorSlot: string | null;
            }>;
          } | undefined)?.equipment ?? []);

        assert.deepEqual(
          serializedEquipment
            .filter((entry) => entry.slot === "weapon_primary" || entry.slot === "weapon_secondary")
            .map((entry) => [entry.slot, entry.itemId, entry.anchorSlot]),
          [
            ["weapon_primary", "bow-1", "weapon_primary"],
            ["weapon_secondary", "bow-1", "weapon_primary"],
          ]
        );
      },
    },
    {
      name: "readPersistedCharactersFromStorage recovers from backup when primary is starter-only",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.name = "Recovered";
        const primary = JSON.stringify({
          version: 6,
          characters: [],
          itemInstances: createDefaultItemBlueprints()
            .slice(0, 0),
          starterItemsInitialized: true,
        });
        const backup = JSON.stringify({
          version: 6,
          characters: [{ id: "recovered-1", ownerRole: "player", sheet }],
          itemBlueprints: createDefaultItemBlueprints(),
          itemInstances: [],
          starterItemsInitialized: true,
        });

        const state = readPersistedCharactersFromStorage({
          getItem: (key) => {
            if (key === CHARACTER_STORAGE_KEY) {
              return primary;
            }

            if (key === CHARACTER_STORAGE_BACKUP_KEY) {
              return backup;
            }

            return null;
          },
        });

        assert.equal(state.characters.length, 1);
        assert.equal(state.characters[0]?.sheet.name, "Recovered");
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
        assert.equal(
          state.knowledgeRevisions[0]?.sourceSpellName,
          "Assess Entity Lv 3"
        );
        assert.equal(state.knowledgeEntities.length, 1);
        assert.equal(state.knowledgeRevisions.length, 1);
        assert.equal(state.knowledgeOwnerships.length, 1);
      },
    },
    {
      name: "hydratePersistedCharacters normalizes legacy assess spell bonuses on shared items",
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
          buildItemIndex(state.items)["spell-item-1"]?.bonusProfile.spellBonuses["awareness:assess_entity"],
          1
        );
        assert.equal(
          buildItemIndex(state.items)["spell-item-1"]?.bonusProfile.spellBonuses["awareness:assess_character"],
          undefined
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
              createSharedItemRecord("weapon:ranged_light", { id: "legacy-light-crossbow" }),
              createSharedItemRecord("armor:shield", { id: "legacy-shield" }),
              createSharedItemRecord("mystic:mystic", { id: "legacy-focus" }),
            ],
          })
        );
        const itemIndex = buildItemIndex(state.items);

        assert.equal(itemIndex["legacy-bow"]?.blueprintId, "range:short_bow");
        assert.equal(itemIndex["legacy-light-crossbow"]?.blueprintId, "range:light_crossbow");
        assert.equal(itemIndex["legacy-shield"]?.blueprintId, "shield:light");
        assert.equal(itemIndex["legacy-focus"]?.blueprintId, "occult:one_handed");
      },
    },
    {
      name: "hydratePersistedCharacters backfills missing seeded definitions and blueprints into existing catalogs",
      run: () => {
        const persistedBlueprints = createDefaultItemBlueprints()
          .filter((blueprint) => blueprint.id !== "range:light_crossbow")
          .map((blueprint) =>
            blueprint.id === "range:short_bow"
              ? { ...blueprint, label: "Custom Short Bow Label" }
              : blueprint
          );
        const persistedCategories = createDefaultItemCategoryDefinitions()
          .filter((definition) => definition.id !== "range")
          .map((definition) =>
            definition.id === "melee" ? { ...definition, name: "Custom Melee" } : definition
          );
        const persistedSubcategories = createDefaultItemSubcategoryDefinitions()
          .filter((definition) => definition.id !== "range:crossbow")
          .map((definition) =>
            definition.id === "range:bow" ? { ...definition, name: "Custom Bow" } : definition
          );

        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: CHARACTER_DRAFT_SCHEMA_VERSION,
            characters: [],
            starterItemsInitialized: true,
            itemBlueprints: persistedBlueprints,
            itemCategoryDefinitions: persistedCategories,
            itemSubcategoryDefinitions: persistedSubcategories,
          })
        );

        assert.equal(
          state.itemBlueprints.find((blueprint) => blueprint.id === "range:short_bow")?.label,
          "Custom Short Bow Label"
        );
        assert.ok(state.itemBlueprints.some((blueprint) => blueprint.id === "range:light_crossbow"));
        assert.equal(
          state.itemCategoryDefinitions.find((definition) => definition.id === "melee")?.name,
          "Custom Melee"
        );
        assert.ok(state.itemCategoryDefinitions.some((definition) => definition.id === "range"));
        assert.equal(
          state.itemSubcategoryDefinitions.find((definition) => definition.id === "range:bow")?.name,
          "Custom Bow"
        );
        assert.ok(
          state.itemSubcategoryDefinitions.some((definition) => definition.id === "range:crossbow")
        );
      },
    },
    {
      name: "hydratePersistedCharacters supplements seeded blueprint combat fields and notes without overwriting explicit values",
      run: () => {
        const defaultHeavyCrossbow = createDefaultItemBlueprints().find(
          (blueprint) => blueprint.id === "range:heavy_crossbow"
        );
        assert.ok(defaultHeavyCrossbow);
        if (!defaultHeavyCrossbow) {
          return;
        }

        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: CHARACTER_DRAFT_SCHEMA_VERSION,
            characters: [],
            starterItemsInitialized: true,
            itemBlueprints: [
              {
                ...defaultHeavyCrossbow,
                label: "Custom Heavy Crossbow",
                combatSpec: {
                  attackKind: "ranged",
                  physicalProfileKind: "ranged",
                  handsRequired: 2,
                  attacksPerAction: 1,
                  rangedDamageBase: 8,
                  rangeMeters: 50,
                },
                visibleNotes: [],
              },
            ],
          })
        );

        const heavyCrossbow = state.itemBlueprints.find(
          (blueprint) => blueprint.id === "range:heavy_crossbow"
        );

        assert.equal(heavyCrossbow?.label, "Custom Heavy Crossbow");
        assert.equal(heavyCrossbow?.combatSpec?.armorPenetration, 2);
        assert.ok(
          heavyCrossbow?.visibleNotes.includes(
            "Classic rules note: uses attack, bonus, and move actions; DM must enforce manually."
          )
        );
      },
    },
    {
      name: "deprecated melee unarmed blueprint stays readable but is hidden from normal creation options",
      run: () => {
        const state = hydratePersistedCharacters(null);
        const blueprintOptions = getItemBlueprintOptions(state.itemBlueprints).filter(
          (option) => option.isLegacy !== true && option.isDeprecated !== true
        );

        assert.ok(state.itemBlueprints.some((blueprint) => blueprint.id === "melee:unarmed"));
        assert.ok(!blueprintOptions.some((option) => option.id === "melee:unarmed"));
      },
    },
    {
      name: "hydratePersistedCharacters keeps mixed-schema items when both items and itemInstances exist",
      run: () => {
        const legacyItem = createSharedItemRecord("weapon:one_handed", {
          id: "legacy-item",
          name: "Legacy Blade",
        });
        const currentItem = createSharedItemRecord("armor:shield_heavy", {
          id: "current-item",
          name: "Turtle Shield",
        });

        const state = hydratePersistedCharacters(
          JSON.stringify({
            version: 6,
            characters: [],
            itemBlueprints: createDefaultItemBlueprints(),
            items: [legacyItem],
            itemInstances: [currentItem],
            starterItemsInitialized: true,
          })
        );

        const itemIndex = buildItemIndex(state.items);
        assert.ok(itemIndex["legacy-item"]);
        assert.ok(itemIndex["current-item"]);
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
