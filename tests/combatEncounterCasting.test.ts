import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  getEncounterCastTargetOptions,
  prepareCastRequest,
} from "../src/lib/combatEncounterCasting.ts";
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
    stats?: Partial<Record<"APP" | "CHA" | "INT" | "DEX" | "WITS" | "STAM", number>>;
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
  selectedDamageType?: "fire" | "cold" | "lightning" | "acid" | "necrotic";
  selectedSummonOptionId?: string | null;
}): Parameters<typeof prepareCastRequest>[0] {
  return {
    casterCharacter: options.casterCharacter,
    casterDisplayName: options.casterCharacter.sheet.name,
    selectedPower: options.selectedPower,
    selectedVariantId: options.variantId ?? "default",
    attackOutcome: options.attackOutcome ?? "unresolved",
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
      name: "healing targets undead allies as radiant damage instead of healing",
      run: () => {
        const caster = createCharacterRecord("caster", "Healer", "player", {
          powers: [
            {
              id: "healing",
              name: "Healing",
              level: 5,
              governingStat: "INT",
            },
          ],
          stats: { INT: 4 },
        });
        const target = createCharacterRecord("target", "Zombie Ally", "player", {
          statusTags: [{ id: "undead", label: "Undead" }],
        });
        const views = [createParticipantView(caster), createParticipantView(target)];

        const targetOptions = getEncounterCastTargetOptions({
          casterView: views[0],
          encounterParticipants: views,
          selectedPower: caster.sheet.powers[0],
          selectedVariantId: "heal_living",
          castMode: "self",
        });

        assert.ok(targetOptions.some((view) => view.participant.characterId === target.id));

        const prepared = prepareCastRequest(
          preparePayload({
            casterCharacter: caster,
            encounterParticipants: views,
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
            variantId: "heal_living",
          })
        );

        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        assert.equal(prepared.request.healingApplications.length, 0);
        assert.deepEqual(prepared.request.damageApplications, [
          {
            targetCharacterId: target.id,
            rawAmount: 9,
            damageType: "radiant",
            mitigationChannel: "soak",
            sourceCharacterId: caster.id,
            sourceLabel: "Healing Lv 5",
            sourceSummary: "Healing Reversal (9 radiant)",
          },
        ]);
      },
    },
    {
      name: "necrotic touch heals undead targets instead of damaging them",
      run: () => {
        const caster = createCharacterRecord("caster", "Necro", "player", {
          powers: [
            {
              id: "necromancy",
              name: "Necromancy",
              level: 5,
              governingStat: "APP",
            },
          ],
          stats: { APP: 4 },
        });
        const target = createCharacterRecord("target", "Skeleton", "dm", {
          statusTags: [{ id: "undead", label: "Undead" }],
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

        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        assert.equal(prepared.request.damageApplications.length, 0);
        assert.deepEqual(prepared.request.healingApplications, [
          {
            targetCharacterId: caster.id,
            amount: 5,
            temporaryHpCap: null,
          },
          {
            targetCharacterId: target.id,
            amount: 14,
            temporaryHpCap: null,
          },
        ]);
      },
    },
    {
      name: "crowd control enforces living-target rules before level five and auto-resolves success at level five",
      run: () => {
        const target = createCharacterRecord("construct", "Construct", "dm", {
          statusTags: [{ id: "construct", label: "Construct" }],
          stats: { CHA: 2, WITS: 2 },
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
          stats: { CHA: 3, INT: 3 },
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
          stats: { CHA: 3, INT: 3 },
        });

        withMockedRollFaces([6, 6, 6, 6, 6, 6, 2, 2, 2, 2], () => {
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
            })
          );

          assert.ok(!("error" in highPrepared));
          if ("error" in highPrepared) {
            return;
          }

          assert.equal(highPrepared.request.manaCost, 0);
          assert.equal(highPrepared.request.statusTagChanges.length, 2);
          assert.equal(highPrepared.request.ongoingStateChanges.length, 1);
          assert.equal(
            highPrepared.request.activityLogEntries[0]?.summary,
            "Crowd Control: Master Controller 6 vs Construct 0 (success)."
          );
        });
      },
    },
    {
      name: "crowd control auto-resolves failure without applying control state",
      run: () => {
        const caster = createCharacterRecord("caster", "Controller", "player", {
          powers: [
            {
              id: "crowd_control",
              name: "Crowd Control",
              level: 3,
              governingStat: "CHA",
            },
          ],
          stats: { CHA: 2, INT: 2 },
        });
        const target = createCharacterRecord("target", "Guard", "dm", {
          stats: { CHA: 3, WITS: 3 },
        });

        withMockedRollFaces([2, 2, 2, 2, 6, 6, 6, 6, 6, 6], () => {
          const prepared = prepareCastRequest(
            preparePayload({
              casterCharacter: caster,
              encounterParticipants: [
                createParticipantView(caster),
                createParticipantView(target, "party-2"),
              ],
              selectedPower: caster.sheet.powers[0],
              selectedTargetIds: [target.id],
              variantId: "crowd_control",
            })
          );

          assert.ok(!("error" in prepared));
          if ("error" in prepared) {
            return;
          }

          assert.equal(prepared.request.statusTagChanges.length, 0);
          assert.equal(prepared.request.ongoingStateChanges.length, 0);
          assert.equal(
            prepared.request.activityLogEntries[0]?.summary,
            "Crowd Control: Controller 0 vs Guard 6 (failure)."
          );
        });
      },
    },
    {
      name: "crowd control ties fail",
      run: () => {
        const caster = createCharacterRecord("caster", "Controller", "player", {
          powers: [
            {
              id: "crowd_control",
              name: "Crowd Control",
              level: 2,
              governingStat: "CHA",
            },
          ],
          stats: { CHA: 2, INT: 2 },
        });
        const target = createCharacterRecord("target", "Scout", "dm", {
          stats: { CHA: 2, WITS: 2 },
        });

        withMockedRollFaces([6, 6, 2, 2, 6, 6, 2, 2], () => {
          const prepared = prepareCastRequest(
            preparePayload({
              casterCharacter: caster,
              encounterParticipants: [
                createParticipantView(caster),
                createParticipantView(target, "party-2"),
              ],
              selectedPower: caster.sheet.powers[0],
              selectedTargetIds: [target.id],
              variantId: "crowd_control",
            })
          );

          assert.ok(!("error" in prepared));
          if ("error" in prepared) {
            return;
          }

          assert.equal(prepared.request.statusTagChanges.length, 0);
          assert.equal(prepared.request.ongoingStateChanges.length, 0);
          assert.equal(
            prepared.request.activityLogEntries[0]?.summary,
            "Crowd Control: Controller 2 vs Scout 2 (failure)."
          );
        });
      },
    },
    {
      name: "shadow walk builds a zero-effect movement action with its own mana cost",
      run: () => {
        const caster = createCharacterRecord("caster", "Shade", "player", {
          powers: [
            {
              id: "shadow_control",
              name: "Shadow Control",
              level: 5,
              governingStat: "MAN",
            },
          ],
        });
        const target = createCharacterRecord("target", "Scout", "dm");
        const prepared = prepareCastRequest(
          preparePayload({
            casterCharacter: caster,
            encounterParticipants: [
              createParticipantView(caster),
              createParticipantView(target, "party-2"),
            ],
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
            variantId: "shadow_walk",
          })
        );

        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        assert.equal(prepared.request.manaCost, 2);
        assert.equal(prepared.request.effects.length, 0);
        assert.equal(prepared.request.damageApplications.length, 0);
        assert.equal(prepared.request.activityLogEntries.length, 1);
      },
    },
    {
      name: "boost physique logs its real action name instead of a shadow cloak fallback",
      run: () => {
        const caster = createCharacterRecord("caster", "Bulwark", "player", {
          powers: [
            {
              id: "body_reinforcement",
              name: "Body Reinforcement",
              level: 5,
              governingStat: "STAM",
            },
          ],
          stats: { STAM: 5 },
        });
        const target = createCharacterRecord("target", "Frontliner", "player");
        const prepared = prepareCastRequest({
          ...preparePayload({
            casterCharacter: caster,
            encounterParticipants: [createParticipantView(caster), createParticipantView(target)],
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [target.id],
          }),
          selectedStatId: "STR",
        });

        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        assert.equal(
          prepared.request.activityLogEntries[0]?.summary,
          "Boost Physique: Bulwark affected Frontliner."
        );
      },
    },
    {
      name: "shadow fighter uses the level five summon mana cost",
      run: () => {
        const caster = createCharacterRecord("caster", "Shade", "player", {
          powers: [
            {
              id: "shadow_control",
              name: "Shadow Control",
              level: 5,
              governingStat: "MAN",
            },
          ],
        });
        const power = caster.sheet.powers[0];
        const summonOption = getCastPowerSummonOptions(power, "shadow_fighter")[0];

        assert.ok(summonOption);
        if (!summonOption) {
          return;
        }

        assert.equal(summonOption.manaCost, 4);

        const prepared = prepareCastRequest(
          preparePayload({
            casterCharacter: caster,
            encounterParticipants: [createParticipantView(caster)],
            selectedPower: power,
            selectedTargetIds: [caster.id],
            variantId: "shadow_fighter",
            selectedSummonOptionId: summonOption.id,
          })
        );

        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        assert.equal(prepared.request.manaCost, 4);
      },
    },
    {
      name: "elementalist can target transient summons while crowd control cannot",
      run: () => {
        const caster = createCharacterRecord("caster", "Mage", "player", {
          powers: [
            { id: "elementalist", name: "Elementalist", level: 5, governingStat: "INT" },
          ],
        });
        const controller = createCharacterRecord("controller", "Controller", "dm", {
          powers: [
            { id: "shadow_control", name: "Shadow Control", level: 5, governingStat: "MAN" },
          ],
        });
        const transientSheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        transientSheet.name = "Shadow Soldier";
        const summonView: EncounterParticipantView = {
          participant: {
            characterId: "summon-1",
            ownerRole: "dm",
            displayName: "Shadow Soldier",
            initiativePool: 3,
            initiativeFaces: [8, 7, 6],
            initiativeSuccesses: 3,
            dex: 3,
            wits: 3,
            partyId: "party-2",
            controllerCharacterId: controller.id,
            summonTemplateId: "shadow_soldier",
            sourcePowerId: "shadow_control",
          },
          character: {
            id: "summon-1",
            ownerRole: "dm",
            sheet: transientSheet,
          },
          transientCombatant: {
            id: "summon-1",
            ownerRole: "dm",
            controllerCharacterId: controller.id,
            sourcePowerId: "shadow_control",
            sourcePowerLevel: 5,
            summonTemplateId: "shadow_soldier",
            buffRules: {
              canReceiveSingleBuffs: true,
              canReceiveGroupBuffs: true,
              canBeHealed: false,
            },
            sheet: transientSheet,
          },
          snapshot: null,
        };

        const encounterParticipants = [
          createParticipantView(caster),
          createParticipantView(controller, "party-2"),
          summonView,
        ];
        const elementalistTargets = getEncounterCastTargetOptions({
          casterView: encounterParticipants[0],
          encounterParticipants,
          selectedPower: caster.sheet.powers[0],
          selectedVariantId: "elemental_bolt",
          castMode: "self",
        });
        const crowdControlTargets = getEncounterCastTargetOptions({
          casterView: encounterParticipants[1],
          encounterParticipants,
          selectedPower: {
            id: "crowd_control",
            name: "Crowd Control",
            level: 5,
            governingStat: "CHA",
          },
          selectedVariantId: "crowd_control",
          castMode: "self",
        });

        assert.ok(
          elementalistTargets.some((view) => view.participant.characterId === "summon-1")
        );
        assert.ok(
          !crowdControlTargets.some((view) => view.participant.characterId === "summon-1")
        );
      },
    },
    {
      name: "luminous restoration restores mana without a long-rest usage counter",
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
            variantId: "luminous_restoration",
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
        assert.deepEqual(prepared.request.usageCounterChanges, []);
      },
    },
    {
      name: "lessen darkness is a separate level five linked aura effect",
      run: () => {
        const caster = createCharacterRecord("caster", "Beacon", "player", {
          powers: [
            {
              id: "light_support",
              name: "Light Support",
              level: 5,
              governingStat: "APP",
            },
          ],
          stats: { APP: 4 },
        });
        const ally = createCharacterRecord("ally", "Ally", "player");
        const enemy = createCharacterRecord("enemy", "Enemy", "dm");
        const views = [
          createParticipantView(caster),
          createParticipantView(ally),
          createParticipantView(enemy, "party-2"),
        ];

        const lightPrepared = prepareCastRequest(
          preparePayload({
            casterCharacter: caster,
            encounterParticipants: views,
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [caster.id],
            variantId: "let_there_be_light",
          })
        );

        assert.ok(!("error" in lightPrepared));
        if ("error" in lightPrepared) {
          return;
        }

        caster.sheet.activePowerEffects = lightPrepared.request.effects;

        const prepared = prepareCastRequest(
          preparePayload({
            casterCharacter: caster,
            encounterParticipants: views,
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [enemy.id],
            variantId: "lessen_darkness",
          })
        );

        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        const sourceEffect = prepared.request.effects.find(
          (effect) => effect.effectKind === "aura_source" && effect.targetCharacterId === caster.id
        );
        const allyEffect = lightPrepared.request.effects.find(
          (effect) => effect.targetCharacterId === ally.id
        );
        const enemyEffect = prepared.request.effects.find(
          (effect) => effect.targetCharacterId === enemy.id
        );

        assert.ok(sourceEffect);
        assert.deepEqual(sourceEffect?.sharedTargetCharacterIds, [caster.id, enemy.id]);
        assert.equal(allyEffect, undefined);
        assert.equal(enemyEffect?.stackKey, "light_support:expose_darkness");
        assert.equal(enemyEffect?.label, "Lessen Darkness");
      },
    },
    {
      name: "necromancy zombie replaces only its own subtype and uses the newer stat rules",
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
        const summonOption = getCastPowerSummonOptions(power, "non_living_zombie")[0];
        const existingTransient: EncounterTransientCombatant = {
          id: "old-zombie",
          ownerRole: "player",
          controllerCharacterId: caster.id,
          sourcePowerId: power.id,
          sourcePowerLevel: power.level,
          summonTemplateId: "non_living_zombie",
          buffRules: {
            canReceiveSingleBuffs: true,
            canReceiveGroupBuffs: true,
            canBeHealed: true,
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

        assert.equal(resolution.manaCost, 3);
        assert.deepEqual(resolution.dismissIds, ["old-zombie"]);
        assert.equal(resolution.summons.length, 1);
        assert.deepEqual(resolution.summons[0]?.sheet.statusTags, [
          { id: "undead", label: "Undead" },
        ]);
        assert.equal(resolution.summons[0]?.sheet.statState.STR.base, 8);
        assert.equal(resolution.summons[0]?.sheet.statState.DEX.base, 6);
        assert.equal(resolution.summons[0]?.sheet.statState.STAM.base, 8);
        assert.equal(resolution.summons[0]?.buffRules.canReceiveGroupBuffs, true);
        assert.match(
          resolution.summons[0]?.sheet.activePowerEffects[0]?.summary ?? "",
          /DR 7, \+4 hit, \+4 dmg/
        );
      },
    },
    {
      name: "shadow fighter summons carry a shadow status tag",
      run: () => {
        const caster = createCharacterRecord("caster", "Shade", "player", {
          powers: [
            {
              id: "shadow_control",
              name: "Shadow Control",
              level: 5,
              governingStat: "MAN",
            },
          ],
        });
        const power = caster.sheet.powers[0];
        const summonOption = getCastPowerSummonOptions(power, "shadow_fighter")[0];

        assert.ok(summonOption);
        if (!summonOption) {
          return;
        }

        const resolution = buildSummonCastResolution({
          casterCharacter: caster,
          casterParticipant: createParticipantView(caster).participant,
          power,
          selectedSummonOptionId: summonOption.id,
          activeTransientCombatants: [],
        });

        assert.ok(!("error" in resolution));
        if ("error" in resolution) {
          return;
        }

        assert.deepEqual(resolution.summons[0]?.sheet.statusTags, [
          { id: "shadow", label: "Shadow" },
        ]);
      },
    },
    {
      name: "shadow fighter inherits an active smoldering shadow aura from the caster",
      run: () => {
        const caster = createCharacterRecord("caster", "Shade", "player", {
          powers: [
            {
              id: "shadow_control",
              name: "Shadow Control",
              level: 5,
              governingStat: "MAN",
            },
          ],
        });
        const cloakEffect = prepareCastRequest(
          {
            ...preparePayload({
              casterCharacter: caster,
              encounterParticipants: [createParticipantView(caster)],
              selectedPower: caster.sheet.powers[0],
              selectedTargetIds: [caster.id],
              variantId: "smoldering_shadow",
              selectedSummonOptionId: null,
            }),
            castMode: "aura",
          }
        );

        assert.ok(!("error" in cloakEffect));
        if ("error" in cloakEffect) {
          return;
        }

        caster.sheet.activePowerEffects = cloakEffect.request.effects;

        const summonOption = getCastPowerSummonOptions(caster.sheet.powers[0], "shadow_fighter")[0];
        assert.ok(summonOption);
        if (!summonOption) {
          return;
        }

        const prepared = prepareCastRequest(
          preparePayload({
            casterCharacter: caster,
            encounterParticipants: [createParticipantView(caster)],
            selectedPower: caster.sheet.powers[0],
            selectedTargetIds: [caster.id],
            variantId: "shadow_fighter",
            selectedSummonOptionId: summonOption.id,
          })
        );

        assert.ok(!("error" in prepared));
        if ("error" in prepared) {
          return;
        }

        const updatedSourceEffect = prepared.request.effects.find(
          (effect) => effect.effectKind === "aura_source" && effect.targetCharacterId === caster.id
        );
        const summonAuraEffect = prepared.request.effects.find(
          (effect) =>
            effect.effectKind === "aura_shared" &&
            effect.targetCharacterId.startsWith("shadow_fighter")
        );

        assert.ok(updatedSourceEffect);
        assert.ok(
          updatedSourceEffect?.sharedTargetCharacterIds?.some((targetId) =>
            targetId.startsWith("shadow_fighter")
          )
        );
        assert.equal(summonAuraEffect?.stackKey, "shadow_control:cloak");
      },
    },
    {
      name: "necromancer's bless restores a loaded target to one HP and strips death tags",
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
            variantId: "necromancers_bless",
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
