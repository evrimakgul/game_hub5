import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  buildItemIndex,
  createItemCustomPropertyRecord,
  createSharedItemRecord,
  getItemCompactHeaderSummary,
  normalizeItemCustomPropertyRecords,
} from "../src/lib/items.ts";
import { setCharacterWeaponHandSlotItem } from "../src/mutations/characterItemMutations.ts";
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
  ]);
}
