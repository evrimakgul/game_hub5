import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import { EncounterExecutionEngine } from "../src/engine/encounterExecutionEngine.ts";
import { buildAssessCharacterHistoryEntry } from "../src/powers/runtimeSupport.ts";
import type { ActivePowerEffect } from "../src/types/activePowerEffects.ts";
import type { CharacterRecord } from "../src/types/character.ts";
import type {
  CombatEncounterParticipant,
  CombatEncounterState,
  EncounterTransientCombatant,
} from "../src/types/combatEncounter.ts";
import type { PreparedCastRequest } from "../src/types/combatEncounterView.ts";
import { createEmptyKnowledgeState } from "../src/lib/knowledge.ts";
import { runTestSuite } from "./harness.ts";

function createCharacterRecord(
  id: string,
  name: string,
  ownerRole: CharacterRecord["ownerRole"],
  options?: {
    currentHp?: number;
    currentMana?: number;
    manaInitialized?: boolean;
    activePowerEffects?: ActivePowerEffect[];
    statusTags?: CharacterRecord["sheet"]["statusTags"];
  }
): CharacterRecord {
  const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
  sheet.name = name;
  sheet.currentHp = options?.currentHp ?? sheet.currentHp;
  sheet.currentMana = options?.currentMana ?? sheet.currentMana;
  sheet.manaInitialized = options?.manaInitialized ?? true;
  sheet.activePowerEffects = options?.activePowerEffects ?? [];
  sheet.statusTags = options?.statusTags ?? [];

  return {
    id,
    ownerRole,
    sheet,
  };
}

function createParticipant(
  character: CharacterRecord,
  partyId: string | null = "party-1"
): CombatEncounterParticipant {
  return {
    characterId: character.id,
    ownerRole: character.ownerRole,
    displayName: character.sheet.name,
    initiativePool: 2,
    initiativeFaces: [6, 4],
    initiativeSuccesses: 1,
    dex: character.sheet.statState.DEX.base,
    wits: character.sheet.statState.WITS.base,
    partyId,
    controllerCharacterId: null,
    summonTemplateId: null,
    sourcePowerId: null,
  };
}

function createEncounter(
  participants: CombatEncounterParticipant[],
  transientCombatants: EncounterTransientCombatant[] = []
): CombatEncounterState {
  return {
    encounterId: "encounter-1",
    label: "Test Encounter",
    parties: [],
    participants,
    createdAt: "2026-04-04T00:00:00.000Z",
    turnState: {
      round: 1,
      activeParticipantIndex: 0,
      activeParticipantId: participants[0]?.characterId ?? null,
    },
    transientCombatants,
    ongoingStates: [],
    activityLog: [],
  };
}

function createPreparedRequest(
  casterCharacterId: string,
  targetCharacterIds: string[] = []
): PreparedCastRequest {
  return {
    casterCharacterId,
    targetCharacterIds,
    manaCost: 0,
    effects: [],
    historyEntries: [],
    activityLogEntries: [],
    healingApplications: [],
    damageApplications: [],
    resourceChanges: [],
    statusTagChanges: [],
    usageCounterChanges: [],
    summonChanges: [],
    ongoingStateChanges: [],
  };
}

function createAuraSourceEffect(
  caster: CharacterRecord,
  targetIds: string[]
): ActivePowerEffect {
  return {
    id: "effect-source-1",
    stackKey: "light_support",
    effectKind: "aura_source",
    powerId: "light_support",
    powerName: "Light Support",
    sourceLevel: 5,
    casterCharacterId: caster.id,
    casterName: caster.sheet.name,
    targetCharacterId: caster.id,
    sourceEffectId: null,
    shareMode: "aura",
    sharedTargetCharacterIds: targetIds,
    label: "Light Aura",
    summary: "Aura source",
    actionType: "standard",
    manaCost: 2,
    selectedStatId: null,
    modifiers: [],
    appliedAt: "2026-04-04T00:00:00.000Z",
  };
}

function createAuraSharedEffect(
  caster: CharacterRecord,
  target: CharacterRecord,
  sourceEffectId: string
): ActivePowerEffect {
  return {
    id: "effect-shared-1",
    stackKey: "light_support",
    effectKind: "aura_shared",
    powerId: "light_support",
    powerName: "Light Support",
    sourceLevel: 5,
    casterCharacterId: caster.id,
    casterName: caster.sheet.name,
    targetCharacterId: target.id,
    sourceEffectId,
    shareMode: "aura",
    sharedTargetCharacterIds: null,
    label: "Light Aura",
    summary: "Aura shared",
    actionType: "standard",
    manaCost: 2,
    selectedStatId: null,
    modifiers: [],
    appliedAt: "2026-04-04T00:00:00.000Z",
  };
}

export async function runEncounterExecutionEngineTests(): Promise<void> {
  await runTestSuite("encounterExecutionEngine", [
    {
      name: "executePreparedRequest links Assess Character history rows into knowledge revisions",
      run: () => {
        const caster = createCharacterRecord("caster-1", "Veli", "player");
        const target = createCharacterRecord("target-1", "Ali", "player");
        caster.sheet.powers = [
          { id: "awareness", name: "Awareness", level: 3, governingStat: "PER" },
        ];
        const historyEntry = buildAssessCharacterHistoryEntry(
          caster.sheet,
          target,
          "04.04.2026 12:00"
        );
        const request = createPreparedRequest(caster.id, [target.id]);
        request.historyEntries = [{ characterId: caster.id, entry: historyEntry }];
        const engine = new EncounterExecutionEngine({
          characters: [caster, target],
          encounter: createEncounter([createParticipant(caster), createParticipant(target)]),
          knowledgeState: createEmptyKnowledgeState(),
          itemsById: {},
        });

        const result = engine.executePreparedRequest(request);
        assert.ok(!("error" in result));
        if ("error" in result) {
          return;
        }

        assert.equal(result.result.knowledgeState.knowledgeEntities.length, 1);
        assert.equal(result.result.knowledgeState.knowledgeRevisions.length, 1);
        assert.equal(result.result.knowledgeState.knowledgeOwnerships.length, 1);
        assert.ok(result.result.characters[0]?.sheet.gameHistory[0]?.knowledgeLink);
      },
    },
    {
      name: "executePreparedRequest breaks crowd control on damage and grants immunity",
      run: () => {
        const attacker = createCharacterRecord("attacker-1", "Attacker", "player");
        const controller = createCharacterRecord("controller-1", "Controller", "player");
        const target = createCharacterRecord("target-1", "Target", "dm", {
          statusTags: [
            { id: "paralyzed", label: "Paralyzed" },
            { id: "crowd_control:controller-1", label: "Controlled by Controller" },
          ],
        });
        const encounter = createEncounter([
          createParticipant(attacker),
          createParticipant(controller),
          createParticipant(target, "party-2"),
        ]);
        encounter.ongoingStates = [
          {
            id: "cc-1",
            kind: "crowd_control",
            casterCharacterId: controller.id,
            targetCharacterId: target.id,
            powerLevel: 5,
            maintenanceManaCost: 2,
            breaksOnDamageFromCaster: false,
            breaksOnDamageFromOthers: true,
            commandActionType: "bonus",
            summaryNote: null,
          },
        ];
        const request = createPreparedRequest(attacker.id, [target.id]);
        request.damageApplications = [
          {
            targetCharacterId: target.id,
            rawAmount: 3,
            damageType: "physical",
            mitigationChannel: "dr",
            sourceCharacterId: attacker.id,
            sourceLabel: "Physical Attack",
            sourceSummary: "Attack hit",
          },
        ];
        const engine = new EncounterExecutionEngine({
          characters: [attacker, controller, target],
          encounter,
          knowledgeState: createEmptyKnowledgeState(),
          itemsById: {},
        });

        const result = engine.executePreparedRequest(request);
        assert.ok(!("error" in result));
        if ("error" in result) {
          return;
        }

        const nextTarget = result.result.characters.find((entry) => entry.id === target.id);
        assert.equal(result.result.encounter.ongoingStates.length, 0);
        assert.ok(nextTarget);
        assert.ok(
          nextTarget?.sheet.statusTags.some((tag) => tag.id === "crowd_control_immunity")
        );
        assert.ok(
          !nextTarget?.sheet.statusTags.some((tag) => tag.id === "paralyzed")
        );
      },
    },
    {
      name: "executePreparedRequest merges summon spawn and dismiss changes into encounter state",
      run: () => {
        const caster = createCharacterRecord("caster-1", "Necro", "player");
        const summonSheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        summonSheet.name = "Skeleton";
        const summon: EncounterTransientCombatant = {
          id: "summon-1",
          ownerRole: "player",
          controllerCharacterId: caster.id,
          sourcePowerId: "necromancy",
          sourcePowerLevel: 3,
          summonTemplateId: "skeleton",
          buffRules: {
            canReceiveSingleBuffs: false,
            canReceiveGroupBuffs: false,
            canBeHealed: false,
          },
          sheet: summonSheet,
        };
        const summonParticipant: CombatEncounterParticipant = {
          characterId: summon.id,
          ownerRole: "player",
          displayName: summon.sheet.name,
          initiativePool: 2,
          initiativeFaces: [7, 2],
          initiativeSuccesses: 1,
          dex: 2,
          wits: 2,
          partyId: "party-1",
          controllerCharacterId: caster.id,
          summonTemplateId: "skeleton",
          sourcePowerId: "necromancy",
        };
        const encounter = createEncounter([createParticipant(caster)]);
        const spawnRequest = createPreparedRequest(caster.id);
        spawnRequest.summonChanges = [
          {
            operation: "spawn",
            summon,
            participant: summonParticipant,
          },
        ];

        const spawnEngine = new EncounterExecutionEngine({
          characters: [caster],
          encounter,
          knowledgeState: createEmptyKnowledgeState(),
          itemsById: {},
        });
        const spawned = spawnEngine.executePreparedRequest(spawnRequest);
        assert.ok(!("error" in spawned));
        if ("error" in spawned) {
          return;
        }

        assert.equal(spawned.result.encounter.transientCombatants.length, 1);
        assert.equal(spawned.result.encounter.participants[1]?.characterId, summon.id);

        const dismissRequest = createPreparedRequest(caster.id);
        dismissRequest.summonChanges = [{ operation: "dismiss", summonId: summon.id }];
        const dismissEngine = new EncounterExecutionEngine({
          characters: spawned.result.characters,
          encounter: spawned.result.encounter,
          knowledgeState: spawned.result.knowledgeState,
          itemsById: {},
        });
        const dismissed = dismissEngine.executePreparedRequest(dismissRequest);
        assert.ok(!("error" in dismissed));
        if ("error" in dismissed) {
          return;
        }

        assert.equal(dismissed.result.encounter.transientCombatants.length, 0);
        assert.equal(
          dismissed.result.encounter.participants.some((participant) => participant.characterId === summon.id),
          false
        );
      },
    },
    {
      name: "advanceTurn drops maintained crowd control when upkeep cannot be paid",
      run: () => {
        const starter = createCharacterRecord("starter-1", "Starter", "player");
        const controller = createCharacterRecord("controller-1", "Controller", "player", {
          currentMana: 0,
        });
        const target = createCharacterRecord("target-1", "Target", "dm", {
          statusTags: [
            { id: "paralyzed", label: "Paralyzed" },
            { id: "crowd_control:controller-1", label: "Controlled by Controller" },
          ],
        });
        const encounter = createEncounter([
          createParticipant(starter),
          createParticipant(controller),
          createParticipant(target, "party-2"),
        ]);
        encounter.ongoingStates = [
          {
            id: "cc-1",
            kind: "crowd_control",
            casterCharacterId: controller.id,
            targetCharacterId: target.id,
            powerLevel: 5,
            maintenanceManaCost: 2,
            breaksOnDamageFromCaster: false,
            breaksOnDamageFromOthers: true,
            commandActionType: "bonus",
            summaryNote: null,
          },
        ];

        const engine = new EncounterExecutionEngine({
          characters: [starter, controller, target],
          encounter,
          knowledgeState: createEmptyKnowledgeState(),
          itemsById: {},
        });
        const result = engine.advanceTurn();
        const nextTarget = result.characters.find((entry) => entry.id === target.id);

        assert.equal(result.encounter.turnState.activeParticipantId, controller.id);
        assert.equal(result.encounter.ongoingStates.length, 0);
        assert.ok(
          result.encounter.activityLog[0]?.summary.includes("could not pay upkeep")
        );
        assert.ok(
          !nextTarget?.sheet.statusTags.some((tag) => tag.id === "paralyzed")
        );
      },
    },
    {
      name: "advanceTurn removes aura source and shared effects when the source is down",
      run: () => {
        const source = createCharacterRecord("source-1", "Source", "player", {
          currentHp: -10,
        });
        const ally = createCharacterRecord("ally-1", "Ally", "player");
        const sourceEffect = createAuraSourceEffect(source, [source.id, ally.id]);
        const sharedEffect = createAuraSharedEffect(source, ally, sourceEffect.id);
        source.sheet.activePowerEffects = [sourceEffect];
        ally.sheet.activePowerEffects = [sharedEffect];

        const engine = new EncounterExecutionEngine({
          characters: [source, ally],
          encounter: createEncounter([createParticipant(source), createParticipant(ally)]),
          knowledgeState: createEmptyKnowledgeState(),
          itemsById: {},
        });
        const result = engine.advanceTurn();
        const nextSource = result.characters.find((entry) => entry.id === source.id);
        const nextAlly = result.characters.find((entry) => entry.id === ally.id);

        assert.equal(nextSource?.sheet.activePowerEffects.length, 0);
        assert.equal(nextAlly?.sheet.activePowerEffects.length, 0);
        assert.ok(result.encounter.activityLog[0]?.summary.includes("Aura effects ended"));
      },
    },
  ]);
}
