import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import { prepareCastRequest } from "../src/lib/combatEncounterCasting.ts";
import { POWER_USAGE_KEYS, setLongRestSelection } from "../src/lib/powerUsage.ts";
import {
  getCastPowerSummonOptions,
  type CastPowerVariantId,
} from "../src/rules/powerEffects.ts";
import { buildSummonCastResolution } from "../src/rules/summons.ts";
import type { CharacterRecord } from "../src/types/character.ts";
import type {
  EncounterParticipantView,
  CastOutcomeState,
  ContestOutcomeState,
} from "../src/types/combatEncounterView.ts";
import type { EncounterTransientCombatant } from "../src/types/combatEncounter.ts";
import { runTestSuite } from "./harness.ts";

function createCharacterRecord(
  id: string,
  name: string,
  ownerRole: CharacterRecord["ownerRole"],
  options?: {
    powers?: CharacterRecord["sheet"]["powers"];
    currentHp?: number;
    statusTags?: CharacterRecord["sheet"]["statusTags"];
    stats?: Partial<Record<"APP" | "INT" | "DEX" | "WITS" | "STAM", number>>;
  }
): CharacterRecord {
  const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
  sheet.name = name;
  sheet.currentHp = options?.currentHp ?? sheet.currentHp;
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

function createParticipantView(
  character: CharacterRecord,
  partyId: string | null = "party-1"
): EncounterParticipantView {
  return {
    participant: {
      characterId: character.id,
      ownerRole: character.ownerRole,
      displayName: character.sheet.name,
      initiativePool: 2,
      initiativeFaces: [6, 2],
      initiativeSuccesses: 1,
      dex: character.sheet.statState.DEX.base,
      wits: character.sheet.statState.WITS.base,
      partyId,
      controllerCharacterId: null,
      summonTemplateId: null,
      sourcePowerId: null,
    },
    character,
    transientCombatant: null,
    snapshot: null,
  };
}

function preparePayload(options: {
  casterCharacter: CharacterRecord;
  encounterParticipants: EncounterParticipantView[];
  selectedPower: CharacterRecord["sheet"]["powers"][number];
  selectedTargetIds: string[];
  variantId?: CastPowerVariantId;
  attackOutcome?: CastOutcomeState;
  contestOutcome?: ContestOutcomeState;
  selectedDamageType?: "fire" | "cold" | "lightning" | "acid" | "necrotic";
  selectedSummonOptionId?: string | null;
}): Parameters<typeof prepareCastRequest>[0] {
  return {
    casterCharacter: options.casterCharacter,
    casterDisplayName: options.casterCharacter.sheet.name,
    selectedPower: options.selectedPower,
    selectedVariantId: options.variantId ?? "default",
    attackOutcome: options.attackOutcome ?? "unresolved",
    contestOutcome: options.contestOutcome ?? "unresolved",
    selectedTargetIds: options.selectedTargetIds,
    fallbackTargetIds: options.selectedTargetIds,
    healingAllocations: {},
    selectedStatId: null,
    castMode: "self",
    selectedDamageType: options.selectedDamageType ?? null,
    bonusManaSpend: 0,
    selectedSummonOptionId: options.selectedSummonOptionId ?? null,
    encounterParticipants: options.encounterParticipants,
  };
}

export async function runCombatEncounterCastingTests(): Promise<void> {
  await runTestSuite("combatEncounterCasting", [
    {
      name: "low-level elementalist locks to the first chosen damage type until long rest",
      run: () => {
        const caster = createCharacterRecord("caster", "Caster", "player", {
          powers: [
            {
              id: "elementalist",
              name: "Elementalist",
              level: 2,
              governingStat: "INT",
            },
          ],
          stats: { INT: 4 },
        });
        const target = createCharacterRecord("target", "Target", "dm");
        const views = [createParticipantView(caster), createParticipantView(target, "party-2")];

        const firstCast = prepareCastRequest(
          preparePayload({
            casterCharacter: caster,
            encounterParticipants: views,
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
            variantId: "elemental_bolt",
            selectedDamageType: "fire",
          })
        );

        assert.ok(!("error" in firstCast));
        if ("error" in firstCast) {
          return;
        }

        assert.deepEqual(firstCast.request.usageCounterChanges, [
          {
            characterId: caster.id,
            operation: "setSelection",
            key: POWER_USAGE_KEYS.elementalistLockedDamageType,
            value: "fire",
          },
        ]);

        caster.sheet.powerUsageState = setLongRestSelection(
          caster.sheet.powerUsageState,
          POWER_USAGE_KEYS.elementalistLockedDamageType,
          "fire"
        );

        const lockedCast = prepareCastRequest(
          preparePayload({
            casterCharacter: caster,
            encounterParticipants: views,
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
            variantId: "elemental_bolt",
            selectedDamageType: "acid",
          })
        );

        assert.deepEqual(lockedCast, {
          error: "Elementalist is locked to fire until long rest.",
        });
      },
    },
    {
      name: "necrotic touch rejects shadow targets instead of treating them as undead healing targets",
      run: () => {
        const caster = createCharacterRecord("caster", "Necro", "player", {
          powers: [
            {
              id: "necromancy",
              name: "Necromancy",
              level: 3,
              governingStat: "APP",
            },
          ],
          stats: { APP: 4 },
        });
        const target = createCharacterRecord("target", "Shade", "dm", {
          statusTags: [{ id: "shadow", label: "Shadow" }],
        });
        const views = [createParticipantView(caster), createParticipantView(target, "party-2")];

        const prepared = prepareCastRequest(
          preparePayload({
            casterCharacter: caster,
            encounterParticipants: views,
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
            variantId: "necrotic_touch",
            attackOutcome: "hit",
          })
        );

        assert.deepEqual(prepared, {
          error: "Necrotic Touch does not work on shadow or incorporeal targets.",
        });
      },
    },
    {
      name: "crowd control enforces living-target rules before level five and allows nonliving sheets at level five",
      run: () => {
        const target = createCharacterRecord("construct", "Construct", "dm", {
          statusTags: [{ id: "construct", label: "Construct" }],
        });

        const lowLevelCaster = createCharacterRecord("caster-low", "Controller", "player", {
          powers: [
            {
              id: "crowd_control",
              name: "Crowd Control",
              level: 1,
              governingStat: "CHA",
            },
          ],
        });
        const lowPrepared = prepareCastRequest(
          preparePayload({
            casterCharacter: lowLevelCaster,
            encounterParticipants: [
              createParticipantView(lowLevelCaster),
              createParticipantView(target, "party-2"),
            ],
            selectedPower: lowLevelCaster.sheet.powers[0],
            selectedTargetIds: [target.id],
            variantId: "crowd_control",
            contestOutcome: "success",
          })
        );

        assert.deepEqual(lowPrepared, {
          error: "Crowd Control can only target living creatures at this level.",
        });

        const highLevelCaster = createCharacterRecord("caster-high", "Master Controller", "player", {
          powers: [
            {
              id: "crowd_control",
              name: "Crowd Control",
              level: 5,
              governingStat: "CHA",
            },
          ],
        });
        const highPrepared = prepareCastRequest(
          preparePayload({
            casterCharacter: highLevelCaster,
            encounterParticipants: [
              createParticipantView(highLevelCaster),
              createParticipantView(target, "party-2"),
            ],
            selectedPower: highLevelCaster.sheet.powers[0],
            selectedTargetIds: [target.id],
            variantId: "crowd_control",
            contestOutcome: "success",
          })
        );

        assert.ok(!("error" in highPrepared));
        if ("error" in highPrepared) {
          return;
        }

        assert.equal(highPrepared.request.manaCost, 1);
        assert.equal(highPrepared.request.statusTagChanges.length, 2);
        assert.equal(highPrepared.request.ongoingStateChanges.length, 1);
      },
    },
    {
      name: "light support mana restore spends the long-rest usage counter",
      run: () => {
        const caster = createCharacterRecord("caster", "Beacon", "player", {
          powers: [
            {
              id: "light_support",
              name: "Light Support",
              level: 4,
              governingStat: "APP",
            },
          ],
          stats: { APP: 4 },
        });
        const target = createCharacterRecord("target", "Ally", "player");
        const views = [createParticipantView(caster), createParticipantView(target)];

        const prepared = prepareCastRequest(
          preparePayload({
            casterCharacter: caster,
            encounterParticipants: views,
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
            variantId: "mana_restore",
          })
        );

        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        assert.deepEqual(prepared.request.resourceChanges, [
          {
            characterId: target.id,
            field: "currentMana",
            operation: "adjust",
            value: 8,
          },
        ]);
        assert.deepEqual(prepared.request.usageCounterChanges, [
          {
            characterId: caster.id,
            operation: "increment",
            scope: "longRest",
            key: POWER_USAGE_KEYS.lightSupportManaRestore,
            targetCharacterId: null,
            amount: 1,
          },
        ]);
      },
    },
    {
      name: "necromancy summons dismiss old summons and build leveled zombie stats",
      run: () => {
        const caster = createCharacterRecord("caster", "Summoner", "player", {
          powers: [
            {
              id: "necromancy",
              name: "Necromancy",
              level: 4,
              governingStat: "APP",
            },
          ],
          stats: { APP: 4, DEX: 3, WITS: 3 },
        });
        const power = caster.sheet.powers[0];
        const summonOption = getCastPowerSummonOptions(power, "summon_undead").find(
          (option) => option.templateId === "zombie"
        );
        const existingTransient: EncounterTransientCombatant = {
          id: "old-zombie",
          ownerRole: "player",
          controllerCharacterId: caster.id,
          sourcePowerId: power.id,
          sourcePowerLevel: power.level,
          summonTemplateId: "simple_skeleton",
          buffRules: {
            canReceiveSingleBuffs: false,
            canReceiveGroupBuffs: false,
            canBeHealed: false,
          },
          sheet: PLAYER_CHARACTER_TEMPLATE.createInstance(),
        };

        assert.ok(summonOption);
        if (!summonOption) {
          return;
        }

        const resolution = buildSummonCastResolution({
          casterCharacter: caster,
          casterParticipant: createParticipantView(caster).participant,
          power,
          selectedSummonOptionId: summonOption.id,
          activeTransientCombatants: [existingTransient],
        });

        assert.ok(!("error" in resolution));
        if ("error" in resolution) {
          return;
        }

        assert.equal(resolution.manaCost, 4);
        assert.deepEqual(resolution.dismissIds, ["old-zombie"]);
        assert.equal(resolution.summons.length, 1);
        assert.equal(resolution.summons[0]?.sheet.statState.STR.base, 4);
        assert.equal(resolution.summons[0]?.sheet.statState.DEX.base, 4);
        assert.equal(resolution.summons[0]?.sheet.statState.STAM.base, 4);
        assert.equal(resolution.summons[0]?.buffRules.canReceiveGroupBuffs, true);
        assert.match(
          resolution.summons[0]?.sheet.activePowerEffects[0]?.summary ?? "",
          /\+4 hit, \+4 dmg/
        );
      },
    },
    {
      name: "resurrection restores a loaded target to one HP and strips death tags",
      run: () => {
        const caster = createCharacterRecord("caster", "Priest", "player", {
          powers: [
            {
              id: "necromancy",
              name: "Necromancy",
              level: 5,
              governingStat: "APP",
            },
          ],
        });
        const target = createCharacterRecord("target", "Fallen", "player", {
          currentHp: -8,
          statusTags: [
            { id: "dead", label: "Dead" },
            { id: "bleeding", label: "Bleeding" },
            { id: "dying", label: "Dying" },
          ],
        });
        const views = [createParticipantView(caster), createParticipantView(target)];

        const prepared = prepareCastRequest(
          preparePayload({
            casterCharacter: caster,
            encounterParticipants: views,
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
            variantId: "resurrection",
          })
        );

        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        assert.equal(prepared.request.manaCost, 6);
        assert.deepEqual(prepared.request.resourceChanges, [
          {
            characterId: target.id,
            field: "currentHp",
            operation: "set",
            value: 1,
          },
        ]);
        assert.deepEqual(
          prepared.request.statusTagChanges.map((change) => change.tag.id).sort(),
          ["bleeding", "dead", "dying"]
        );
      },
    },
  ]);
}
