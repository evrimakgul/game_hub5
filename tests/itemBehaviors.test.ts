import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  buildItemIndex,
  canViewerSeeItemBonusDetails,
  createEmptyBonusProfile,
  createItemBlueprintRecord,
  createItemCategoryDefinitionRecord,
  createItemCustomPropertyRecord,
  createItemSubcategoryDefinitionRecord,
  createSharedItemRecord,
  getItemCompactHeaderSummary,
  normalizeItemCustomPropertyRecords,
  setProfileNotes,
  setProfileUtilityTraits,
  syncSharedItemRecordWithBlueprint,
} from "../src/lib/items.ts";
import {
  setCharacterEquipmentSlotItem,
  setCharacterSupplementarySlotEnabled,
  setCharacterWeaponHandSlotItem,
} from "../src/mutations/characterItemMutations.ts";
import { runTestSuite } from "./harness.ts";

export async function runItemBehaviorTests(): Promise<void> {
  await runTestSuite("itemBehaviors", [
    {
      name: "custom property labels preserve spaces",
      run: () => {
        const property = createItemCustomPropertyRecord({
          label: "Resistance Bundle",
          notes: "Fire and Cold",
        });
        const normalized = normalizeItemCustomPropertyRecords([property]);

        assert.equal(property.label, "Resistance Bundle");
        assert.equal(property.notes, "Fire and Cold");
        assert.equal(normalized[0]?.label, "Resistance Bundle");
        assert.equal(normalized[0]?.notes, "Fire and Cold");
      },
    },
    {
      name: "blank editable labels remain blank instead of being reset to defaults",
      run: () => {
        const blueprint = createItemBlueprintRecord({
          id: "blueprint:blank-text",
          label: "",
          defaultName: "  ",
        });
        const category = createItemCategoryDefinitionRecord({
          id: "category:blank-text",
          name: "",
        });
        const subcategory = createItemSubcategoryDefinitionRecord({
          id: "subcategory:blank-text",
          categoryId: "melee",
          name: "  ",
        });
        const property = createItemCustomPropertyRecord({
          id: "property:blank-text",
          label: "",
        });

        assert.equal(blueprint.label, "");
        assert.equal(blueprint.defaultName, "  ");
        assert.equal(category.name, "");
        assert.equal(subcategory.name, "  ");
        assert.equal(property.label, "");
      },
    },
    {
      name: "synced items preserve blank names and spaces in visible instance notes",
      run: () => {
        const blueprint = createItemBlueprintRecord({
          id: "blueprint:item-text",
          label: "Blueprint",
          defaultName: "Fallback Name",
        });
        const item = syncSharedItemRecordWithBlueprint(
          {
            ...createSharedItemRecord(blueprint.id, {}, [blueprint]),
            name: "",
            baseDescription: "Visible note with spaces ",
          },
          blueprint
        );

        assert.equal(item.name, "");
        assert.equal(item.baseDescription, "Visible note with spaces ");
      },
    },
    {
      name: "profile note fields preserve spaces while still dropping empty lines",
      run: () => {
        const profileWithTraits = setProfileUtilityTraits(createEmptyBonusProfile(), [
          "Quick Draw ",
          "   ",
          " Heavy Pull",
        ]);
        const profileWithNotes = setProfileNotes(createEmptyBonusProfile(), [
          "Can move 10 m with attack ",
          "",
          " Uses move action",
        ]);

        assert.deepEqual(profileWithTraits.utilityTraits, ["Quick Draw ", " Heavy Pull"]);
        assert.deepEqual(profileWithNotes.notes, [
          "Can move 10 m with attack ",
          " Uses move action",
        ]);
      },
    },
    {
      name: "item bonus detail visibility is gated by item-card ownership",
      run: () => {
        const item = createSharedItemRecord("weapon:one_handed", {
          id: "item-card-gated-1",
          name: "Hidden Blade",
          bonusProfile: {
            ...createEmptyBonusProfile(),
            derivedBonuses: { meleeDamage: 2 },
          },
          knowledge: {
            learnedCharacterIds: ["player-1"],
            visibleCharacterIds: ["player-1"],
          },
        });

        assert.equal(
          canViewerSeeItemBonusDetails(item, "player-1", false, false),
          false
        );
        assert.equal(
          canViewerSeeItemBonusDetails(item, "player-1", true, false),
          true
        );
      },
    },
    {
      name: "shields can occupy the secondary hand slot",
      run: () => {
        const shield = createSharedItemRecord("armor:shield_heavy", {
          id: "shield-1",
          name: "Turtle Shield",
        });
        const itemsById = buildItemIndex([shield]);
        const nextSheet = setCharacterWeaponHandSlotItem(
          PLAYER_CHARACTER_TEMPLATE.createInstance(),
          "weapon_secondary",
          shield.id,
          itemsById
        );

        assert.equal(
          nextSheet.equipment.find((entry) => entry.slot === "weapon_secondary")?.itemId,
          shield.id
        );
      },
    },
    {
      name: "shields selected into primary hand normalize to secondary hand",
      run: () => {
        const shield = createSharedItemRecord("armor:shield_light", {
          id: "shield-2",
          name: "Buckler",
        });
        const itemsById = buildItemIndex([shield]);
        const nextSheet = setCharacterWeaponHandSlotItem(
          PLAYER_CHARACTER_TEMPLATE.createInstance(),
          "weapon_primary",
          shield.id,
          itemsById
        );

        assert.equal(
          nextSheet.equipment.find((entry) => entry.slot === "weapon_primary")?.itemId ?? null,
          null
        );
        assert.equal(
          nextSheet.equipment.find((entry) => entry.slot === "weapon_secondary")?.itemId,
          shield.id
        );
      },
    },
    {
      name: "shields are blocked by a two-handed primary weapon",
      run: () => {
        const greatsword = createSharedItemRecord("weapon:two_handed", {
          id: "weapon-2h",
          name: "Greatsword",
        });
        const shield = createSharedItemRecord("armor:shield_heavy", {
          id: "shield-3",
          name: "Tower Shield",
        });
        const itemsById = buildItemIndex([greatsword, shield]);
        const sheetWithWeapon = setCharacterWeaponHandSlotItem(
          PLAYER_CHARACTER_TEMPLATE.createInstance(),
          "weapon_primary",
          greatsword.id,
          itemsById
        );
        const nextSheet = setCharacterWeaponHandSlotItem(
          sheetWithWeapon,
          "weapon_secondary",
          shield.id,
          itemsById
        );

        assert.equal(
          nextSheet.equipment.find((entry) => entry.slot === "weapon_primary")?.itemId,
          greatsword.id
        );
        assert.equal(
          nextSheet.equipment.find((entry) => entry.slot === "weapon_secondary")?.itemId,
          greatsword.id
        );
      },
    },
    {
      name: "one-handed primary weapon can coexist with an off-hand shield",
      run: () => {
        const sword = createSharedItemRecord("weapon:one_handed", {
          id: "weapon-1h",
          name: "Sword",
        });
        const shield = createSharedItemRecord("armor:shield_light", {
          id: "shield-4",
          name: "Round Shield",
        });
        const itemsById = buildItemIndex([sword, shield]);
        const sheetWithSword = setCharacterWeaponHandSlotItem(
          PLAYER_CHARACTER_TEMPLATE.createInstance(),
          "weapon_primary",
          sword.id,
          itemsById
        );
        const nextSheet = setCharacterWeaponHandSlotItem(
          sheetWithSword,
          "weapon_secondary",
          shield.id,
          itemsById
        );

        assert.equal(
          nextSheet.equipment.find((entry) => entry.slot === "weapon_primary")?.itemId,
          sword.id
        );
        assert.equal(
          nextSheet.equipment.find((entry) => entry.slot === "weapon_secondary")?.itemId,
          shield.id
        );
      },
    },
    {
      name: "shield summaries use the secondary hand slot label",
      run: () => {
        const shield = createSharedItemRecord("armor:shield_heavy", {
          id: "shield-summary",
          name: "Tower Shield",
        });

        assert.match(
          getItemCompactHeaderSummary(shield),
          /Slot: Secondary Hand/
        );
      },
    },
    {
      name: "two-handed equip writes one anchor across both occupied hands",
      run: () => {
        const bow = createSharedItemRecord("weapon:bow", {
          id: "weapon-anchor-bow",
          name: "Ash Bow",
        });
        const itemsById = buildItemIndex([bow]);
        const nextSheet = setCharacterWeaponHandSlotItem(
          PLAYER_CHARACTER_TEMPLATE.createInstance(),
          "weapon_primary",
          bow.id,
          itemsById
        );

        assert.deepEqual(
          nextSheet.equipment
            .filter((entry) => entry.slot === "weapon_primary" || entry.slot === "weapon_secondary")
            .map((entry) => [entry.slot, entry.itemId, entry.anchorSlot]),
          [
            ["weapon_primary", bow.id, "weapon_primary"],
            ["weapon_secondary", bow.id, "weapon_primary"],
          ]
        );
      },
    },
    {
      name: "clearing a follower hand slot clears the whole anchored group",
      run: () => {
        const bow = createSharedItemRecord("weapon:bow", {
          id: "weapon-follower-bow",
          name: "Ash Bow",
        });
        const itemsById = buildItemIndex([bow]);
        const equippedSheet = setCharacterWeaponHandSlotItem(
          PLAYER_CHARACTER_TEMPLATE.createInstance(),
          "weapon_primary",
          bow.id,
          itemsById
        );
        const clearedSheet = setCharacterWeaponHandSlotItem(
          equippedSheet,
          "weapon_secondary",
          "",
          itemsById
        );

        assert.deepEqual(
          clearedSheet.equipment
            .filter((entry) => entry.slot === "weapon_primary" || entry.slot === "weapon_secondary")
            .map((entry) => [entry.slot, entry.itemId, entry.anchorSlot]),
          [
            ["weapon_primary", null, null],
            ["weapon_secondary", null, null],
          ]
        );
      },
    },
    {
      name: "two-handed summaries show both occupied hand slots",
      run: () => {
        const weapon = createSharedItemRecord("weapon:two_handed", {
          id: "weapon-summary",
          name: "Greatsword",
        });

        assert.match(
          getItemCompactHeaderSummary(weapon),
          /Slots: Primary Hand \+ Secondary Hand/
        );
      },
    },
    {
      name: "crossbow summaries show armor penetration",
      run: () => {
        const crossbow = createSharedItemRecord("weapon:crossbow_heavy", {
          id: "weapon-summary-crossbow",
          name: "Heavy Crossbow",
        });

        assert.match(getItemCompactHeaderSummary(crossbow), /Armor Penetration: 2/);
      },
    },
    {
      name: "disabling a supplementary slot clears that equipped slot",
      run: () => {
        const earring = createSharedItemRecord("rings:earring", {
          id: "earring-1",
          name: "Silver Stud",
        });
        const itemsById = buildItemIndex([earring]);
        const enabledSheet = {
          ...PLAYER_CHARACTER_TEMPLATE.createInstance(),
          enabledSupplementarySlotIds: ["earring" as const],
        };
        const equippedSheet = setCharacterEquipmentSlotItem(
          enabledSheet,
          "earring",
          earring.id,
          itemsById
        );
        const disabledSheet = setCharacterSupplementarySlotEnabled(
          equippedSheet,
          "earring",
          false
        );

        assert.deepEqual(disabledSheet.enabledSupplementarySlotIds, []);
        assert.equal(
          disabledSheet.equipment.find((entry) => entry.slot === "earring")?.itemId ?? null,
          null
        );
      },
    },
  ]);
}
