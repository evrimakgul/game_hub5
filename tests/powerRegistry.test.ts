import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import { createActionForContext } from "../src/powers/registry.ts";
import {
  getPassiveSkillSources,
  getPassiveUtilityTraits,
} from "../src/powers/passiveRegistry.ts";
import type { ActionContext } from "../src/engine/context.ts";
import type { CharacterRecord } from "../src/types/character.ts";
import { runTestSuite } from "./harness.ts";

function createCharacterRecord(
  id: string,
  name: string,
  ownerRole: CharacterRecord["ownerRole"]
): CharacterRecord {
  const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
  sheet.name = name;

  return {
    id,
    ownerRole,
    sheet,
  };
}

function createActionContext(args: {
  caster: CharacterRecord;
  target: CharacterRecord;
  power: CharacterRecord["sheet"]["powers"][number];
  spellId: ActionContext["selectedSpellId"];
}): ActionContext {
  const casterView = {
    participant: {
      characterId: args.caster.id,
      ownerRole: args.caster.ownerRole,
      displayName: args.caster.sheet.name,
      initiativePool: 0,
      initiativeFaces: [],
      initiativeSuccesses: 0,
      dex: 0,
      wits: 0,
      partyId: "party-1",
      controllerCharacterId: null,
      summonTemplateId: null,
      sourcePowerId: null,
    },
    character: args.caster,
    transientCombatant: null,
    snapshot: null,
  };
  const targetView = {
    participant: {
      characterId: args.target.id,
      ownerRole: args.target.ownerRole,
      displayName: args.target.sheet.name,
      initiativePool: 0,
      initiativeFaces: [],
      initiativeSuccesses: 0,
      dex: 0,
      wits: 0,
      partyId: "party-2",
      controllerCharacterId: null,
      summonTemplateId: null,
      sourcePowerId: null,
    },
    character: args.target,
    transientCombatant: null,
    snapshot: null,
  };

  return {
    payload: null,
    casterCharacter: args.caster,
    casterName: args.caster.sheet.name,
    selectedPower: args.power,
    selectedSpellId: args.spellId,
    encounterParticipants: [casterView, targetView],
    itemsById: {},
    casterView,
    validTargetViews: [casterView, targetView],
    selectedTargetViews: [targetView],
    fallbackTargetViews: [targetView],
    finalTargetViews: [targetView],
    finalTargets: [args.target],
    attackOutcome: "hit",
    healingAllocations: {},
    selectedStatId: "STR",
    castMode: "aura",
    selectedDamageType: "fire",
    bonusManaSpend: 0,
    selectedSummonOptionId: null,
  };
}

export async function runPowerRegistryTests(): Promise<void> {
  await runTestSuite("powerRegistry", [
    {
      name: "registry resolves every supported spell to the expected action class",
      run: () => {
        const caster = createCharacterRecord("caster", "Caster", "player");
        const target = createCharacterRecord("target", "Target", "dm");
        const cases = [
          {
            power: { id: "awareness", name: "Awareness", level: 5, governingStat: "PER" as const },
            spellId: "assess_character" as const,
            actionName: "AssessCharacterSpellAction",
          },
          {
            power: {
              id: "body_reinforcement",
              name: "Body Reinforcement",
              level: 5,
              governingStat: "STAM" as const,
            },
            spellId: "default" as const,
            actionName: "BoostPhysiqueSpellAction",
          },
          {
            power: {
              id: "crowd_control",
              name: "Crowd Control",
              level: 5,
              governingStat: "CHA" as const,
            },
            spellId: "crowd_control" as const,
            actionName: "ControlEntitySpellAction",
          },
          {
            power: {
              id: "crowd_control",
              name: "Crowd Control",
              level: 5,
              governingStat: "CHA" as const,
            },
            spellId: "release_control" as const,
            actionName: "ReleaseControlSpellAction",
          },
          {
            power: { id: "elementalist", name: "Elementalist", level: 5, governingStat: "INT" as const },
            spellId: "elemental_bolt" as const,
            actionName: "ElementalistSpellAction",
          },
          {
            power: { id: "elementalist", name: "Elementalist", level: 5, governingStat: "INT" as const },
            spellId: "elemental_cantrip" as const,
            actionName: "ElementalistSpellAction",
          },
          {
            power: { id: "healing", name: "Healing", level: 5, governingStat: "INT" as const },
            spellId: "default" as const,
            actionName: "HealingSpellAction",
          },
          {
            power: { id: "healing", name: "Healing", level: 5, governingStat: "INT" as const },
            spellId: "cure" as const,
            actionName: "HealingSpellAction",
          },
          {
            power: { id: "healing", name: "Healing", level: 5, governingStat: "INT" as const },
            spellId: "wound_mend" as const,
            actionName: "HealingSpellAction",
          },
          {
            power: { id: "light_support", name: "Light Support", level: 5, governingStat: "APP" as const },
            spellId: "default" as const,
            actionName: "LightAuraSpellAction",
          },
          {
            power: { id: "light_support", name: "Light Support", level: 5, governingStat: "APP" as const },
            spellId: "mana_restore" as const,
            actionName: "ManaRestoreSpellAction",
          },
          {
            power: { id: "necromancy", name: "Necromancy", level: 5, governingStat: "APP" as const },
            spellId: "summon_undead" as const,
            actionName: "SummonUndeadSpellAction",
          },
          {
            power: { id: "necromancy", name: "Necromancy", level: 5, governingStat: "APP" as const },
            spellId: "dismiss_summon" as const,
            actionName: "SummonUndeadSpellAction",
          },
          {
            power: { id: "necromancy", name: "Necromancy", level: 5, governingStat: "APP" as const },
            spellId: "necrotic_touch" as const,
            actionName: "NecroticTouchSpellAction",
          },
          {
            power: { id: "necromancy", name: "Necromancy", level: 5, governingStat: "APP" as const },
            spellId: "resurrection" as const,
            actionName: "ResurrectionSpellAction",
          },
          {
            power: { id: "shadow_control", name: "Shadow Control", level: 5, governingStat: "MAN" as const },
            spellId: "default" as const,
            actionName: "CloakOfShadowSpellAction",
          },
          {
            power: { id: "shadow_control", name: "Shadow Control", level: 5, governingStat: "MAN" as const },
            spellId: "shadow_cloak" as const,
            actionName: "CloakOfShadowSpellAction",
          },
          {
            power: { id: "shadow_control", name: "Shadow Control", level: 5, governingStat: "MAN" as const },
            spellId: "shadow_walk" as const,
            actionName: "ShadowWalkSpellAction",
          },
          {
            power: { id: "shadow_control", name: "Shadow Control", level: 5, governingStat: "MAN" as const },
            spellId: "shadow_manipulation" as const,
            actionName: "ShadowManipulationSpellAction",
          },
          {
            power: { id: "shadow_control", name: "Shadow Control", level: 5, governingStat: "MAN" as const },
            spellId: "shadow_soldier" as const,
            actionName: "ShadowSoldierSpellAction",
          },
          {
            power: { id: "shadow_control", name: "Shadow Control", level: 5, governingStat: "MAN" as const },
            spellId: "dismiss_summon" as const,
            actionName: "ShadowSoldierSpellAction",
          },
        ];

        cases.forEach(({ power, spellId, actionName }) => {
          const action = createActionForContext(
            createActionContext({
              caster,
              target,
              power,
              spellId,
            })
          );

          assert.ok(action, `${power.id}:${spellId} should resolve to an action`);
          assert.equal(action?.constructor.name, actionName);
        });
      },
    },
    {
      name: "passive registry exposes the expected skill bonuses and traits",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.powers = [
          { id: "awareness", name: "Awareness", level: 3, governingStat: "PER" },
          { id: "crowd_control", name: "Crowd Control", level: 5, governingStat: "CHA" },
          { id: "light_support", name: "Light Support", level: 5, governingStat: "APP" },
          { id: "necromancy", name: "Necromancy", level: 5, governingStat: "APP" },
          { id: "shadow_control", name: "Shadow Control", level: 5, governingStat: "MAN" },
        ];

        assert.deepEqual(
          getPassiveSkillSources(sheet, "alertness"),
          [{ label: "Awareness", value: 3 }]
        );
        assert.deepEqual(
          getPassiveSkillSources(sheet, "social"),
          [{ label: "Crowd Control", value: 1 }]
        );
        assert.deepEqual(
          getPassiveSkillSources(sheet, "melee"),
          [{ label: "Necromancy", value: 2 }]
        );
        assert.deepEqual(getPassiveUtilityTraits(sheet), [
          "Techno-Invisibility Immunity",
          "Nightvision",
          "Hostile Undead Ignore Unless Attacked",
          "Shadow Walk 125m",
          "Cosmetic Clothing / Armor Shift",
          "Minor Body Cosmetics",
        ]);
      },
    },
  ]);
}
