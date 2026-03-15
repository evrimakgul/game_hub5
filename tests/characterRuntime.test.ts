import assert from "node:assert/strict";

import {
  buildCharacterDerivedValues,
  getCurrentSkillValue,
} from "../src/config/characterRuntime.ts";
import { buildItemIndex, createSharedItemRecord } from "../src/lib/items.ts";
import {
  normalizeCharacterDraft,
  PLAYER_CHARACTER_TEMPLATE,
} from "../src/config/characterTemplate.ts";
import { runTestSuite } from "./harness.ts";

export async function runCharacterRuntimeTests(): Promise<void> {
  await runTestSuite("characterRuntime", [
    {
      name: "awareness insight grants temporary inspiration only once per session state",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.powers = [
          {
            id: "awareness",
            name: "Awareness",
            level: 1,
            governingStat: "PER",
          },
        ];

        const normalizedOnce = normalizeCharacterDraft(sheet);
        const normalizedTwice = normalizeCharacterDraft(normalizedOnce);
        const derived = buildCharacterDerivedValues(normalizedTwice);

        assert.equal(normalizedOnce.temporaryInspiration, 1);
        assert.equal(normalizedOnce.awarenessInsightGranted, true);
        assert.equal(normalizedTwice.temporaryInspiration, 1);
        assert.equal(derived.temporaryInspiration, 1);
        assert.equal(derived.totalInspiration, 1);
      },
    },
    {
      name: "removing awareness clears the granted temporary inspiration slot",
      run: () => {
        const sheet = normalizeCharacterDraft({
          ...PLAYER_CHARACTER_TEMPLATE.createInstance(),
          temporaryInspiration: 0,
          powers: [
            {
              id: "awareness",
              name: "Awareness",
              level: 1,
              governingStat: "PER",
            },
          ],
        });

        const withoutAwareness = normalizeCharacterDraft({
          ...sheet,
          powers: [],
        });

        assert.equal(withoutAwareness.awarenessInsightGranted, false);
        assert.equal(withoutAwareness.temporaryInspiration, 0);
      },
    },
    {
      name: "passive utility traits and cantrip skill bonuses are derived from unlocked powers",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.powers = [
          {
            id: "awareness",
            name: "Awareness",
            level: 3,
            governingStat: "PER",
          },
          {
            id: "crowd_control",
            name: "Crowd Control",
            level: 5,
            governingStat: "CHA",
          },
          {
            id: "light_support",
            name: "Light Support",
            level: 5,
            governingStat: "APP",
          },
          {
            id: "necromancy",
            name: "Necromancy",
            level: 5,
            governingStat: "APP",
          },
          {
            id: "shadow_control",
            name: "Shadow Control",
            level: 5,
            governingStat: "MAN",
          },
        ];

        const derived = buildCharacterDerivedValues(sheet);

        assert.equal(getCurrentSkillValue(sheet, "social"), 1);
        assert.equal(getCurrentSkillValue(sheet, "intimidation"), 1);
        assert.equal(getCurrentSkillValue(sheet, "mechanics"), 1);
        assert.equal(getCurrentSkillValue(sheet, "technology"), 1);
        assert.equal(getCurrentSkillValue(sheet, "melee"), 2);
        assert.deepEqual(derived.utilityTraits, [
          "Techno-Invisibility Immunity",
          "Nightvision",
          "Hostile Undead Ignore Unless Attacked",
          "Shadow Walk 125m",
          "Cosmetic Clothing / Armor Shift",
          "Minor Body Cosmetics",
        ]);
      },
    },
    {
      name: "shared item references apply equipped and active item bonuses",
      run: () => {
        const armor = createSharedItemRecord("armor:light", {
          id: "armor-1",
          name: "Scout Armor",
          bonusProfile: {
            statBonuses: { DEX: 1 },
            skillBonuses: { stealth: 2 },
            derivedBonuses: { max_mana: 3 },
            resistanceBonuses: {},
            utilityTraits: ["Low-Light Lens"],
            notes: ["+2 stealth"],
            powerBonuses: {},
          },
        });
        const charm = createSharedItemRecord("jewel:jewel", {
          id: "jewel-1",
          name: "Occult Charm",
          bonusProfile: {
            statBonuses: {},
            skillBonuses: {},
            derivedBonuses: { melee_damage: 2 },
            resistanceBonuses: {},
            utilityTraits: [],
            notes: [],
            powerBonuses: {},
          },
        });
        const itemsById = buildItemIndex([armor, charm]);
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.ownedItemIds = ["armor-1", "jewel-1"];
        sheet.inventoryItemIds = ["armor-1", "jewel-1"];
        sheet.activeItemIds = ["jewel-1"];
        sheet.equipment = [{ slot: "Armor", itemId: "armor-1" }];

        const derived = buildCharacterDerivedValues(sheet, itemsById);

        assert.equal(derived.currentStats.DEX, 3);
        assert.equal(getCurrentSkillValue(sheet, "stealth", itemsById), 2);
        assert.equal(derived.maxMana, 3);
        assert.equal(derived.armorClass, 5);
        assert.equal(derived.damageReduction, 1);
        assert.equal(derived.meleeDamage, 4);
        assert.ok(derived.utilityTraits.includes("Low-Light Lens"));
      },
    },
  ]);
}
