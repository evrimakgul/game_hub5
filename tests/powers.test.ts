import assert from "node:assert/strict";

import { resolveCharacterModifiers } from "../src/config/modifiers.ts";
import { getCastablePowerOptions, getPassivePowerPackage } from "../src/config/powers.ts";
import type { Character, StatusEffectState } from "../src/types/character.ts";
import { runTestSuite } from "./harness.ts";

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    characterId: "character-1",
    profileId: "profile-1",
    displayName: "Test Character",
    isPlayerCharacter: true,
    age: null,
    biographyPrimary: null,
    biographySecondary: null,
    xpUsed: 66,
    money: 0,
    inspiration: 0,
    positiveKarma: 0,
    negativeKarma: 0,
    currentHp: 10,
    currentMana: 8,
    coreStats: {
      STR: 2,
      DEX: 3,
      STAM: 4,
      CHA: 1,
      APP: 1,
      MAN: 2,
      INT: 2,
      WITS: 3,
      PER: 2,
    },
    skillLevels: {
      melee: 0,
      ranged: 0,
      athletics: 2,
      stealth: 0,
      alertness: 1,
      intimidation: 0,
      social: 0,
      medicine: 0,
      technology: 0,
      academics: 0,
      mechanics: 0,
      occultism: 1,
      archery_or_guns: 0,
      energy_weapons: 0,
    },
    knownPowers: [],
    traits: [],
    merits: [],
    flaws: [],
    equippedItems: {},
    statusEffects: [],
    ...overrides,
  };
}

function createStatusEffect(effects: StatusEffectState["effects"]): StatusEffectState {
  return {
    statusEffectId: "status-1",
    label: "Status",
    sourceType: "power",
    sourceId: "light_support",
    stacks: 1,
    appliedAt: null,
    expiresAt: null,
    remainingRounds: null,
    effects,
    payload: {},
  };
}

export async function runPowersTests(): Promise<void> {
  await runTestSuite("powers", [
    {
      name: "passive power package exposes awareness and light support passive bonuses",
      run: () => {
        const passivePackage = getPassivePowerPackage([
          { powerId: "awareness", level: 2, learnedFrom: "xp", unlockedAtXp: 10 },
          { powerId: "light_support", level: 3, learnedFrom: "xp", unlockedAtXp: 20 },
        ]);

        assert.equal(passivePackage.effects.length, 3);
        assert.ok(passivePackage.tags.includes("nightvision"));
      },
    },
    {
      name: "modifier resolver applies passive power bonuses to skills and derived stats",
      run: () => {
        const character = createCharacter({
          knownPowers: [
            { powerId: "awareness", level: 2, learnedFrom: "xp", unlockedAtXp: 10 },
            { powerId: "light_support", level: 3, learnedFrom: "xp", unlockedAtXp: 20 },
          ],
        });

        const summary = resolveCharacterModifiers(character);
        assert.equal(summary.skillBonuses.alertness, 2);
        assert.equal(summary.derivedBonuses.mana_bonus, 2);
        assert.ok(summary.tags.includes("nightvision"));
      },
    },
    {
      name: "modifier resolver applies active status effect bonuses",
      run: () => {
        const character = createCharacter({
          statusEffects: [
            createStatusEffect([
              {
                id: "status.hit_bonus",
                kind: "modifier",
                label: "Light Support Hit Bonus",
                timing: "passive",
                target: { scope: "self", attribute: "attack_dice_pool_hit_bonus" },
                duration: { kind: "until_removed" },
                modifierType: "flat",
                value: 2,
                stacking: "refresh",
              },
            ]),
          ],
        });

        const summary = resolveCharacterModifiers(character);
        assert.equal(summary.derivedBonuses.attack_dice_pool_hit_bonus, 2);
      },
    },
    {
      name: "castable power options expose supported live-cast powers with level-based mana cost",
      run: () => {
        const castable = getCastablePowerOptions([
          { powerId: "light_support", level: 5, learnedFrom: "xp", unlockedAtXp: 50 },
          { powerId: "awareness", level: 2, learnedFrom: "xp", unlockedAtXp: 10 },
        ]);

        assert.equal(castable.length, 1);
        assert.equal(castable[0]?.powerId, "light_support");
        assert.equal(castable[0]?.manaCost, 4);
        assert.equal(castable[0]?.actionType, "standard");
      },
    },
  ]);
}
