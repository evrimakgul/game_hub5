import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import { WorldExecutionEngine } from "../src/engine/worldExecutionEngine.ts";
import { createEmptyKnowledgeState, characterOwnsItemKnowledgeCard } from "../src/lib/knowledge.ts";
import {
  type WorldCastRequestPayload,
  getPreferredCastPowerVariantForEnvironment,
  isCastPowerVariantSupportedInEnvironment,
} from "../src/lib/powerCasting.ts";
import {
  executeArtifactAppraisalWorldCast,
  getWorldCastTargetOptions,
  prepareWorldCastRequest,
} from "../src/lib/worldCasting.ts";
import { createSharedItemRecord } from "../src/lib/items.ts";
import type { CharacterRecord } from "../src/types/character.ts";
import { runTestSuite } from "./harness.ts";

function createCharacterRecord(
  id: string,
  name: string,
  ownerRole: CharacterRecord["ownerRole"],
  options?: {
    powers?: CharacterRecord["sheet"]["powers"];
    currentHp?: number;
    currentMana?: number;
    manaInitialized?: boolean;
    statusTags?: CharacterRecord["sheet"]["statusTags"];
    stats?: Partial<Record<"APP" | "INT" | "PER" | "STR" | "DEX" | "WITS" | "STAM", number>>;
  }
): CharacterRecord {
  const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
  sheet.name = name;
  sheet.currentHp = options?.currentHp ?? sheet.currentHp;
  sheet.currentMana = options?.currentMana ?? sheet.currentMana;
  sheet.manaInitialized = options?.manaInitialized ?? true;
  sheet.statusTags = options?.statusTags ?? [];
  sheet.powers = options?.powers ?? [];

  for (const [statId, value] of Object.entries(options?.stats ?? {})) {
    sheet.statState[statId as keyof typeof sheet.statState].base = value ?? 0;
  }

  return {
    id,
    ownerRole,
    sheet,
  };
}

function createWorldPayload(args: {
  casterCharacter: CharacterRecord;
  characters: CharacterRecord[];
  selectedPower: CharacterRecord["sheet"]["powers"][number];
  selectedTargetIds: string[];
  selectedVariantId?: WorldCastRequestPayload["selectedVariantId"];
  selectedStatId?: WorldCastRequestPayload["selectedStatId"];
}): WorldCastRequestPayload {
  return {
    casterCharacter: args.casterCharacter,
    casterDisplayName: args.casterCharacter.sheet.name,
    selectedPower: args.selectedPower,
    selectedVariantId: args.selectedVariantId ?? "default",
    attackOutcome: "unresolved",
    selectedTargetIds: args.selectedTargetIds,
    fallbackTargetIds: args.selectedTargetIds,
    healingAllocations: {},
    selectedStatId: args.selectedStatId ?? null,
    castMode: "self",
    selectedDamageType: null,
    bonusManaSpend: 0,
    selectedSummonOptionId: null,
    characters: args.characters,
    itemsById: {},
  };
}

export async function runWorldCastingTests(): Promise<void> {
  await runTestSuite("worldCasting", [
    {
      name: "world prep and execution for Assess Entity create linked knowledge without encounter logs",
      run: () => {
        const caster = createCharacterRecord("caster", "Reader", "player", {
          powers: [{ id: "awareness", name: "Awareness", level: 3, governingStat: "PER" }],
          stats: { PER: 5 },
        });
        const target = createCharacterRecord("target", "Subject", "dm");
        const prepared = prepareWorldCastRequest(
          createWorldPayload({
            casterCharacter: caster,
            characters: [caster, target],
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
            selectedVariantId: "assess_entity",
          })
        );

        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        assert.equal(prepared.request.activityLogEntries.length, 0);
        assert.equal(prepared.request.historyEntries.length, 1);

        const engine = new WorldExecutionEngine({
          characters: [caster, target],
          knowledgeState: createEmptyKnowledgeState(),
          itemsById: {},
        });
        const execution = engine.executePreparedRequest(prepared.request);
        assert.ok(!("error" in execution));
        if ("error" in execution) {
          return;
        }

        assert.equal(execution.result.knowledgeState.knowledgeEntities.length, 1);
        assert.equal(execution.result.knowledgeState.knowledgeRevisions.length, 1);
        assert.equal(execution.result.knowledgeState.knowledgeOwnerships.length, 1);
        assert.ok(execution.result.characters[0]?.sheet.gameHistory[0]?.knowledgeLink);
      },
    },
    {
      name: "Body Reinforcement spends mana and applies an active effect out of combat",
      run: () => {
        const caster = createCharacterRecord("caster", "Buffer", "player", {
          powers: [
            {
              id: "body_reinforcement",
              name: "Body Reinforcement",
              level: 3,
              governingStat: "STAM",
            },
          ],
          currentMana: 12,
          stats: { STAM: 4 },
        });
        const target = createCharacterRecord("target", "Tank", "player");
        const prepared = prepareWorldCastRequest(
          createWorldPayload({
            casterCharacter: caster,
            characters: [caster, target],
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
            selectedStatId: "STR",
          })
        );

        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        const engine = new WorldExecutionEngine({
          characters: [caster, target],
          knowledgeState: createEmptyKnowledgeState(),
          itemsById: {},
        });
        const execution = engine.executePreparedRequest(prepared.request);
        assert.ok(!("error" in execution));
        if ("error" in execution) {
          return;
        }

        const nextCaster = execution.result.characters.find((entry) => entry.id === caster.id);
        const nextTarget = execution.result.characters.find((entry) => entry.id === target.id);

        assert.ok(nextCaster);
        assert.ok(nextTarget);
        assert.ok((nextCaster?.sheet.currentMana ?? 0) < caster.sheet.currentMana);
        assert.equal(nextTarget?.sheet.activePowerEffects.length, 1);
        assert.equal(nextTarget?.sheet.activePowerEffects[0]?.selectedStatId, "STR");
      },
    },
    {
      name: "Healing Touch heals out of combat and world healing excludes undead targets",
      run: () => {
        const caster = createCharacterRecord("caster", "Healer", "player", {
          powers: [{ id: "healing", name: "Healing", level: 5, governingStat: "INT" }],
          stats: { INT: 4 },
        });
        const livingTarget = createCharacterRecord("living", "Patient", "player", {
          currentHp: 2,
        });
        const undeadTarget = createCharacterRecord("undead", "Zombie", "dm", {
          statusTags: [{ id: "undead", label: "Undead" }],
        });

        const targetOptions = getWorldCastTargetOptions({
          casterCharacter: caster,
          characters: [caster, livingTarget, undeadTarget],
          selectedPower: caster.sheet.powers[0],
          selectedVariantId: "healing_touch",
        });
        assert.ok(targetOptions.some((entry) => entry.id === livingTarget.id));
        assert.ok(!targetOptions.some((entry) => entry.id === undeadTarget.id));

        const prepared = prepareWorldCastRequest(
          createWorldPayload({
            casterCharacter: caster,
            characters: [caster, livingTarget, undeadTarget],
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [livingTarget.id],
            selectedVariantId: "healing_touch",
          })
        );
        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        const engine = new WorldExecutionEngine({
          characters: [caster, livingTarget, undeadTarget],
          knowledgeState: createEmptyKnowledgeState(),
          itemsById: {},
        });
        const execution = engine.executePreparedRequest(prepared.request);
        assert.ok(!("error" in execution));
        if ("error" in execution) {
          return;
        }

        const nextTarget = execution.result.characters.find((entry) => entry.id === livingTarget.id);
        assert.ok((nextTarget?.sheet.currentHp ?? 0) > 2);
      },
    },
    {
      name: "Luminous Restoration restores mana out of combat",
      run: () => {
        const caster = createCharacterRecord("caster", "Beacon", "player", {
          powers: [{ id: "light_support", name: "Light Support", level: 4, governingStat: "APP" }],
          stats: { APP: 4 },
        });
        const target = createCharacterRecord("target", "Mage", "player", {
          currentMana: 1,
          powers: [{ id: "light_support", name: "Light Support", level: 1, governingStat: "APP" }],
          stats: { APP: 3 },
        });
        const prepared = prepareWorldCastRequest(
          createWorldPayload({
            casterCharacter: caster,
            characters: [caster, target],
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
            selectedVariantId: "luminous_restoration",
          })
        );
        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        const engine = new WorldExecutionEngine({
          characters: [caster, target],
          knowledgeState: createEmptyKnowledgeState(),
          itemsById: {},
        });
        const execution = engine.executePreparedRequest(prepared.request);
        assert.ok(!("error" in execution));
        if ("error" in execution) {
          return;
        }

        const nextTarget = execution.result.characters.find((entry) => entry.id === target.id);
        assert.ok((nextTarget?.sheet.currentMana ?? 0) > 1);
      },
    },
    {
      name: "combat-only variants stay unavailable in world casting helpers",
      run: () => {
        const power = {
          id: "crowd_control",
          name: "Crowd Control",
          level: 5,
          governingStat: "CHA" as const,
        };

        assert.equal(
          isCastPowerVariantSupportedInEnvironment(power, "crowd_control", "world"),
          false
        );
        assert.equal(
          getPreferredCastPowerVariantForEnvironment(power, "world"),
          "crowd_control"
        );
      },
    },
    {
      name: "unsupported world variants reject execution through the world backend",
      run: () => {
        const caster = createCharacterRecord("caster", "Controller", "player", {
          powers: [{ id: "crowd_control", name: "Crowd Control", level: 5, governingStat: "CHA" }],
        });
        const target = createCharacterRecord("target", "Guard", "dm");
        const prepared = prepareWorldCastRequest(
          createWorldPayload({
            casterCharacter: caster,
            characters: [caster, target],
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
            selectedVariantId: "crowd_control",
          })
        );

        assert.deepEqual(prepared, { error: "Combat only for now." });
      },
    },
    {
      name: "Artifact Appraisal world backend grants the item card and reveals the item",
      run: () => {
        const caster = createCharacterRecord("caster", "Scholar", "player");
        const item = createSharedItemRecord("weapon:one_handed", {
          id: "item-1",
          name: "Relic Blade",
          bonusProfile: {
            notes: ["Old power"],
            statBonuses: {},
            skillBonuses: {},
            derivedBonuses: { melee_damage: 2 },
            resistanceBonuses: {},
            powerBonuses: {},
            spellBonuses: {},
            utilityTraits: [],
          },
        });

        const result = executeArtifactAppraisalWorldCast({
          casterCharacter: caster,
          item,
          artifactAppraisalLevel: 3,
          knowledgeState: createEmptyKnowledgeState(),
          context: {
            itemBlueprints: [],
            itemCategoryDefinitions: [],
            itemSubcategoryDefinitions: [],
          },
        });

        assert.ok(!("error" in result));
        if ("error" in result) {
          return;
        }

        assert.equal(
          characterOwnsItemKnowledgeCard(result.knowledgeState, caster.id, item.id),
          true
        );
        assert.ok(result.item.knowledge.learnedCharacterIds.includes(caster.id));
        assert.ok(result.item.knowledge.visibleCharacterIds.includes(caster.id));
      },
    },
  ]);
}
