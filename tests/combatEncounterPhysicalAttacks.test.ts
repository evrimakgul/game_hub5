import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  getResolvedPhysicalAttackProfile,
  preparePhysicalAttackRequest,
} from "../src/lib/combatEncounterPhysicalAttacks.ts";
import { buildItemIndex, createSharedItemRecord } from "../src/lib/items.ts";
import { setCharacterWeaponHandSlotItem } from "../src/mutations/characterItemMutations.ts";
import type { CharacterRecord } from "../src/types/character.ts";
import { runTestSuite } from "./harness.ts";

function createCharacterRecord(
  id: string,
  name: string,
  ownerRole: CharacterRecord["ownerRole"],
  options?: {
    stats?: Partial<Record<"STR" | "DEX" | "STAM" | "PER", number>>;
  }
): CharacterRecord {
  const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
  sheet.name = name;

  for (const [statId, value] of Object.entries(options?.stats ?? {})) {
    sheet.statState[statId as keyof typeof sheet.statState].base = value ?? 0;
  }

  return { id, ownerRole, sheet };
}

function withMockedRollFaces(faces: number[], run: () => void): void {
  const originalRandom = Math.random;
  let index = 0;
  Math.random = () => {
    const nextFace = faces[index] ?? 2;
    index += 1;
    return Math.max(0, Math.min(0.999999, (nextFace - 0.5) / 10));
  };

  try {
    run();
  } finally {
    Math.random = originalRandom;
  }
}

export async function runCombatEncounterPhysicalAttackTests(): Promise<void> {
  await runTestSuite("combatEncounterPhysicalAttacks", [
    {
      name: "no equipped weapon falls back to unarmed",
      run: () => {
        const character = createCharacterRecord("fighter", "Fighter", "player", {
          stats: { STR: 3, DEX: 3 },
        });

        const profile = getResolvedPhysicalAttackProfile(character.sheet, {});

        assert.equal(profile.id, "unarmed");
        assert.equal(profile.label, "Unarmed");
        assert.equal(profile.attacksPerAction, 2);
        assert.equal(profile.baseDamagePool, 3);
      },
    },
    {
      name: "equipped brawl item uses the brawl profile",
      run: () => {
        const character = createCharacterRecord("fighter", "Fighter", "player", {
          stats: { STR: 4, DEX: 3 },
        });
        const knuckles = createSharedItemRecord("weapon:brawl", {
          id: "item-brawl",
          name: "Shock Knuckles",
        });
        const itemsById = buildItemIndex([knuckles]);

        character.sheet = setCharacterWeaponHandSlotItem(
          character.sheet,
          "weapon_primary",
          knuckles.id,
          itemsById
        );

        const profile = getResolvedPhysicalAttackProfile(character.sheet, itemsById);

        assert.equal(profile.id, "brawl");
        assert.equal(profile.label, "Shock Knuckles");
        assert.equal(profile.baseDamagePool, 5);
      },
    },
    {
      name: "two-handed and oversized melee weapons use the new baseline damage values",
      run: () => {
        const twoHandedUser = createCharacterRecord("fighter-2h", "Fighter", "player", {
          stats: { STR: 4, DEX: 3 },
        });
        const oversizedUser = createCharacterRecord("fighter-oversized", "Fighter", "player", {
          stats: { STR: 6, DEX: 3 },
        });
        const greatsword = createSharedItemRecord("weapon:two_handed", {
          id: "item-greatsword",
          name: "Greatsword",
        });
        const oversized = createSharedItemRecord("weapon:oversized", {
          id: "item-oversized",
          name: "Oversized Blade",
        });

        twoHandedUser.sheet = setCharacterWeaponHandSlotItem(
          twoHandedUser.sheet,
          "weapon_primary",
          greatsword.id,
          buildItemIndex([greatsword])
        );
        oversizedUser.sheet = setCharacterWeaponHandSlotItem(
          oversizedUser.sheet,
          "weapon_primary",
          oversized.id,
          buildItemIndex([oversized])
        );

        const twoHandedProfile = getResolvedPhysicalAttackProfile(
          twoHandedUser.sheet,
          buildItemIndex([greatsword])
        );
        const oversizedProfile = getResolvedPhysicalAttackProfile(
          oversizedUser.sheet,
          buildItemIndex([oversized])
        );

        assert.equal(twoHandedProfile.id, "two_handed");
        assert.equal(twoHandedProfile.baseDamagePool, 10);
        assert.equal(oversizedProfile.id, "oversized");
        assert.equal(oversizedProfile.baseDamagePool, 15);
      },
    },
    {
      name: "ranged blueprint classes use their authoritative base damage values",
      run: () => {
        const cases = [
          { blueprintId: "weapon:ranged_light", itemId: "item-ranged-light", expected: 5 },
          { blueprintId: "weapon:pistol", itemId: "item-pistol", expected: 6 },
          { blueprintId: "weapon:bow_long", itemId: "item-bow-long", expected: 6 },
          { blueprintId: "weapon:rifle", itemId: "item-rifle", expected: 7 },
          { blueprintId: "weapon:crossbow_heavy", itemId: "item-crossbow-heavy", expected: 8 },
          { blueprintId: "weapon:shotgun", itemId: "item-shotgun", expected: 10 },
          { blueprintId: "weapon:chaingun", itemId: "item-chaingun", expected: 12 },
          { blueprintId: "weapon:rocket_launcher", itemId: "item-rocket", expected: 20 },
        ] as const;

        cases.forEach(({ blueprintId, itemId, expected }) => {
          const item = createSharedItemRecord(blueprintId, {
            id: itemId,
            name: itemId,
          });
          const itemsById = buildItemIndex([item]);
          const equipped = setCharacterWeaponHandSlotItem(
            PLAYER_CHARACTER_TEMPLATE.createInstance(),
            "weapon_primary",
            item.id,
            itemsById
          );
          const profile = getResolvedPhysicalAttackProfile(equipped, itemsById);

          assert.equal(profile.id, "ranged");
          assert.equal(profile.baseDamagePool, expected);
        });
      },
    },
    {
      name: "two one-handed weapons resolve to the dual one-handed profile",
      run: () => {
        const character = createCharacterRecord("fighter", "Fighter", "player", {
          stats: { STR: 3, DEX: 4 },
        });
        const sword = createSharedItemRecord("weapon:one_handed", {
          id: "item-sword",
          name: "Sword",
        });
        const dagger = createSharedItemRecord("weapon:one_handed", {
          id: "item-dagger",
          name: "Dagger",
        });
        const itemsById = buildItemIndex([sword, dagger]);

        character.sheet = setCharacterWeaponHandSlotItem(
          character.sheet,
          "weapon_primary",
          sword.id,
          itemsById
        );
        character.sheet = setCharacterWeaponHandSlotItem(
          character.sheet,
          "weapon_secondary",
          dagger.id,
          itemsById
        );

        const profile = getResolvedPhysicalAttackProfile(character.sheet, itemsById);

        assert.equal(profile.id, "dual_one_handed");
        assert.equal(profile.successDc, 7);
        assert.equal(profile.attacksPerAction, 2);
        assert.equal(profile.baseDamagePool, 6);
      },
    },
    {
      name: "bow assignment occupies both hand slots",
      run: () => {
        const character = createCharacterRecord("archer", "Archer", "player");
        const bow = createSharedItemRecord("weapon:bow", {
          id: "item-bow",
          name: "Ash Bow",
        });
        const itemsById = buildItemIndex([bow]);

        character.sheet = setCharacterWeaponHandSlotItem(
          character.sheet,
          "weapon_primary",
          bow.id,
          itemsById
        );

        assert.deepEqual(
          character.sheet.equipment
            .filter((entry) => entry.slot === "weapon_primary" || entry.slot === "weapon_secondary")
            .map((entry) => [entry.slot, entry.itemId]),
          [
            ["weapon_primary", "item-bow"],
            ["weapon_secondary", "item-bow"],
          ]
        );
      },
    },
    {
      name: "automatic one-handed attack resolves hit, marginal, damage, and log output",
      run: () => {
        const attacker = createCharacterRecord("attacker", "Attacker", "player", {
          stats: { STR: 3, DEX: 3 },
        });
        const target = createCharacterRecord("target", "Target", "dm", {
          stats: { DEX: 1, STAM: 2 },
        });
        const sword = createSharedItemRecord("weapon:one_handed", {
          id: "item-sword",
          name: "Longsword",
        });
        const itemsById = buildItemIndex([sword]);

        attacker.sheet = setCharacterWeaponHandSlotItem(
          attacker.sheet,
          "weapon_primary",
          sword.id,
          itemsById
        );

        withMockedRollFaces([6, 6, 2, 6, 6, 2, 2, 2], () => {
          const prepared = preparePhysicalAttackRequest({
            casterCharacter: attacker,
            targetCharacter: target,
            itemsById,
          });

          assert.ok(!("error" in prepared));
          if ("error" in prepared) {
            return;
          }

          assert.equal(prepared.profile.id, "one_handed");
          assert.deepEqual(prepared.request.damageApplications, [
            {
              targetCharacterId: target.id,
              rawAmount: 2,
              damageType: "physical",
              mitigationChannel: "dr",
              sourceCharacterId: attacker.id,
              sourceLabel: "Longsword",
              sourceSummary: "Longsword (2 physical)",
            },
          ]);
          assert.equal(
            prepared.request.activityLogEntries[0]?.summary,
            "Attacker attacked Target with Longsword. A1 hit 2 vs AC 1, marginal 1, dmg 2 vs DR 0, took 2."
          );
        });
      },
    },
  ]);
}
