import { buildCharacterEncounterSnapshot } from "../rules/combatEncounter.ts";
import {
  buildCharacterDerivedValues,
  getCurrentSkillValue,
  getCurrentStatValue,
} from "../config/characterRuntime.ts";
import {
  buildActivePowerEffect,
  buildAuraSharedPowerEffect,
  buildDirectDamageCastResolution,
  buildHealingCastResolution,
  doesActivePowerEffectConflict,
  getCastPowerTargetModeForVariant,
  isAuraSharedEffect,
} from "../rules/powerEffects.ts";
import { getRuntimePowerLevelDefinition } from "../rules/powerData.ts";
import { buildSummonCastResolution } from "../rules/summons.ts";
import type { GameHistoryEntry } from "../config/characterTemplate.ts";
import { getCrAndRankFromXpUsed } from "../rules/xpTables.ts";
import type { ActivePowerEffect } from "../types/activePowerEffects.ts";
import type { CharacterRecord } from "../types/character.ts";
import type {
  CastRequestPayload,
  EncounterParticipantView,
  EncounterPartyMemberView,
  PreparedCastRequest,
} from "../types/combatEncounterView.ts";
import { createTimestampedId } from "./ids.ts";
import {
  POWER_USAGE_KEYS,
  getLongRestSelection,
  getPerTargetDailyPowerUsageCount,
  getPowerUsageCount,
} from "./powerUsage.ts";
import { buildGameHistoryNoteEntry } from "./historyEntries.ts";
import type { CastPowerMode, CastPowerVariantId } from "../rules/powerEffects.ts";

function buildPreparedCastRequest(
  casterCharacterId: string,
  targetCharacterIds: string[],
  manaCost = 0
): PreparedCastRequest {
  return {
    casterCharacterId,
    targetCharacterIds,
    manaCost,
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

function buildEncounterActivityLogEntry(summary: string) {
  return {
    id: createTimestampedId("encounter-log"),
    createdAt: new Date().toISOString(),
    summary,
  };
}

function joinTargetNames(targets: CharacterRecord[]): string {
  return targets.map((target) => target.sheet.name.trim() || target.id).join(", ");
}

function normalizeStatusTagText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function hasStatusTagId(
  view: EncounterParticipantView | CharacterRecord,
  statusId: string
): boolean {
  const tags = "character" in view ? view.character?.sheet.statusTags ?? [] : view.sheet.statusTags ?? [];
  const normalized = normalizeStatusTagText(statusId);
  return tags.some(
    (tag) =>
      normalizeStatusTagText(tag.id) === normalized ||
      normalizeStatusTagText(tag.label) === normalized
  );
}

export function isSummonedEncounterTarget(view: EncounterParticipantView): boolean {
  return view.transientCombatant !== null || view.participant.summonTemplateId !== null;
}

export function canEncounterTargetReceiveHealing(view: EncounterParticipantView): boolean {
  return view.transientCombatant ? view.transientCombatant.buffRules.canBeHealed : true;
}

export function canEncounterTargetReceiveSingleBuff(view: EncounterParticipantView): boolean {
  return view.transientCombatant ? view.transientCombatant.buffRules.canReceiveSingleBuffs : true;
}

export function canEncounterTargetReceiveGroupBuff(view: EncounterParticipantView): boolean {
  return view.transientCombatant ? view.transientCombatant.buffRules.canReceiveGroupBuffs : true;
}

function isFriendlyEncounterTarget(
  casterParticipant: EncounterParticipantView["participant"],
  targetView: EncounterParticipantView
): boolean {
  if (targetView.character === null) {
    return false;
  }

  if (targetView.participant.characterId === casterParticipant.characterId) {
    return true;
  }

  if (casterParticipant.partyId === null) {
    return true;
  }

  return targetView.participant.partyId !== null && targetView.participant.partyId === casterParticipant.partyId;
}

function isEnemyEncounterTarget(
  casterParticipant: EncounterParticipantView["participant"],
  targetView: EncounterParticipantView
): boolean {
  if (targetView.character === null || targetView.participant.characterId === casterParticipant.characterId) {
    return false;
  }

  if (casterParticipant.partyId === null) {
    return true;
  }

  return targetView.participant.partyId !== null && targetView.participant.partyId !== casterParticipant.partyId;
}

function isControlledByCaster(
  targetView: EncounterParticipantView,
  casterCharacterId: string
): boolean {
  return hasStatusTagId(targetView, `crowd_control:${casterCharacterId}`);
}

export function getEncounterCastTargetOptions(args: {
  casterView: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  selectedPower: CastRequestPayload["selectedPower"];
  selectedVariantId: CastPowerVariantId;
  castMode: CastPowerMode | null;
}): EncounterParticipantView[] {
  const { casterView, encounterParticipants, selectedPower, selectedVariantId } = args;
  const casterParticipant = casterView.participant;
  const targetMode = getCastPowerTargetModeForVariant(selectedPower, selectedVariantId);

  if (
    selectedPower.id === "necromancy" &&
    (selectedVariantId === "summon_undead" || selectedVariantId === "dismiss_summon")
  ) {
    return encounterParticipants.filter(
      ({ participant }) => participant.characterId === casterParticipant.characterId
    );
  }

  if (
    selectedPower.id === "shadow_control" &&
    (selectedVariantId === "shadow_soldier" || selectedVariantId === "dismiss_summon")
  ) {
    return encounterParticipants.filter(
      ({ participant }) => participant.characterId === casterParticipant.characterId
    );
  }

  if (selectedPower.id === "shadow_control" && selectedVariantId === "shadow_walk") {
    return encounterParticipants.filter(
      (view) =>
        view.participant.characterId !== casterParticipant.characterId && isLivingEncounterTarget(view)
    );
  }

  if (selectedPower.id === "crowd_control" && selectedVariantId === "release_control") {
    return encounterParticipants.filter((view) => isControlledByCaster(view, casterParticipant.characterId));
  }

  if (selectedPower.id === "crowd_control") {
    return encounterParticipants.filter((view) => isEnemyEncounterTarget(casterParticipant, view));
  }

  if (selectedPower.id === "healing") {
    return encounterParticipants.filter(
      (view) =>
        isFriendlyEncounterTarget(casterParticipant, view) && canEncounterTargetReceiveHealing(view)
    );
  }

  if (selectedPower.id === "light_support" && selectedVariantId === "mana_restore") {
    return encounterParticipants.filter((view) => isFriendlyEncounterTarget(casterParticipant, view));
  }

  if (selectedPower.id === "light_support" && selectedVariantId === "expose_darkness") {
    return encounterParticipants.filter((view) => isEnemyEncounterTarget(casterParticipant, view));
  }

  if (selectedPower.id === "body_reinforcement") {
    return encounterParticipants.filter(
      (view) =>
        isFriendlyEncounterTarget(casterParticipant, view) && canEncounterTargetReceiveSingleBuff(view)
    );
  }

  if (
    selectedPower.id === "elementalist" ||
    (selectedPower.id === "shadow_control" && selectedVariantId === "shadow_manipulation") ||
    (selectedPower.id === "necromancy" && selectedVariantId === "necrotic_touch")
  ) {
    return encounterParticipants.filter((view) => isEnemyEncounterTarget(casterParticipant, view));
  }

  if (selectedPower.id === "necromancy" && selectedVariantId === "resurrection") {
    return encounterParticipants.filter(
      (view) => view.transientCombatant === null && view.participant.characterId !== casterParticipant.characterId
    );
  }

  if (targetMode === "self") {
    return encounterParticipants.filter(
      ({ participant }) => participant.characterId === casterParticipant.characterId
    );
  }

  return encounterParticipants.filter(({ character }) => character !== null);
}

function buildStatusRemovalChanges(
  targetCharacter: CharacterRecord,
  statusIds: string[]
): PreparedCastRequest["statusTagChanges"] {
  const normalizedStatusIds = new Set(statusIds.map((statusId) => normalizeStatusTagText(statusId)));

  return (targetCharacter.sheet.statusTags ?? []).flatMap((tag) => {
    if (
      !normalizedStatusIds.has(normalizeStatusTagText(tag.id)) &&
      !normalizedStatusIds.has(normalizeStatusTagText(tag.label))
    ) {
      return [];
    }

    return [
      {
        characterId: targetCharacter.id,
        operation: "remove" as const,
        tag: {
          id: tag.id,
          label: tag.label,
        },
      },
    ];
  });
}

function isLivingEncounterTarget(view: EncounterParticipantView): boolean {
  if (view.transientCombatant) {
    return false;
  }

  if (!view.character) {
    return true;
  }

  return !view.character.sheet.statusTags.some((tag) =>
    ["undead", "shadow", "incorporeal", "construct", "non_living"].includes(
      normalizeStatusTagText(tag.id)
    ) ||
    ["undead", "shadow", "incorporeal", "construct", "non_living"].includes(
      normalizeStatusTagText(tag.label)
    )
  );
}

function blocksNecroticTouch(view: EncounterParticipantView): boolean {
  const tags = view.character?.sheet.statusTags ?? [];

  return tags.some((tag) =>
    ["shadow", "incorporeal"].includes(normalizeStatusTagText(tag.id)) ||
    ["shadow", "incorporeal"].includes(normalizeStatusTagText(tag.label))
  );
}

export function getAuraSelectedTargetIds(effect: ActivePowerEffect): string[] {
  const targetIds = effect.sharedTargetCharacterIds ?? [effect.casterCharacterId];
  return Array.from(new Set([effect.casterCharacterId, ...targetIds]));
}

export function buildDefaultHealingAllocations(
  totalAmount: number,
  targetIds: string[]
): Record<string, string> {
  if (targetIds.length === 0) {
    return {};
  }

  const normalizedTotal = Math.max(0, Math.trunc(totalAmount));
  const baseAmount = Math.floor(normalizedTotal / targetIds.length);
  const remainder = normalizedTotal % targetIds.length;

  return Object.fromEntries(
    targetIds.map((targetId, index) => [
      targetId,
      String(baseAmount + (index < remainder ? 1 : 0)),
    ])
  );
}

export function buildAssessCharacterHistoryEntry(
  casterSheet: CharacterRecord["sheet"],
  targetCharacter: CharacterRecord,
  actualDateTime: string,
  itemsById: Record<string, import("../types/items").SharedItemRecord> = {}
): GameHistoryEntry {
  const targetDerived = buildCharacterDerivedValues(targetCharacter.sheet, itemsById);
  const targetSnapshot = buildCharacterEncounterSnapshot(targetCharacter.sheet, itemsById);
  const awarenessLevel = casterSheet.powers.find((power) => power.id === "awareness")?.level ?? 0;
  const targetProgression = getCrAndRankFromXpUsed(targetCharacter.sheet.xpUsed);

  return {
    id: createTimestampedId("history-intel"),
    type: "intel_snapshot",
    actualDateTime,
    gameDateTime: casterSheet.gameDateTime,
    sourcePower: `Assess Character Lv ${awarenessLevel}`,
    targetCharacterId: targetCharacter.id,
    targetName: targetCharacter.sheet.name.trim() || targetCharacter.id,
    summary: `CR ${targetProgression.cr}, Rank ${targetProgression.rank}`,
    snapshot: {
      rank: targetProgression.rank,
      cr: targetProgression.cr,
      age: targetCharacter.sheet.age,
      karma: `-${targetCharacter.sheet.negativeKarma} / +${targetCharacter.sheet.positiveKarma}`,
      biographyPrimary: targetCharacter.sheet.biographyPrimary,
      resistances: targetSnapshot.visibleResistances.map(
        (resistance) =>
          `${resistance.label}: ${resistance.levelLabel} ${resistance.multiplierLabel}`
      ),
      combatSummary: targetSnapshot.combatSummary.map((field) => ({
        label: field.label,
        value: field.value,
      })),
      stats: targetSnapshot.stats.map((field) => ({
        label: field.label,
        value: field.value,
      })),
      skills: targetCharacter.sheet.skills.map((skill) => ({
        label: skill.label,
        value: getCurrentSkillValue(targetCharacter.sheet, skill.id, itemsById),
      })),
      powers:
        awarenessLevel >= 2
          ? targetCharacter.sheet.powers.map((power) => `${power.name} Lv ${power.level}`)
          : [],
      specials:
        awarenessLevel >= 2 ? targetCharacter.sheet.statusTags.map((tag) => tag.label) : [],
      notes: [
        `HP ${targetCharacter.sheet.currentHp} / ${targetDerived.maxHp}`,
        `Inspiration ${targetDerived.totalInspiration}`,
      ],
    },
  };
}

export function isTargetAffectedByAuraSource(
  sourceEffect: ActivePowerEffect,
  targetCharacter: CharacterRecord
): boolean {
  if (targetCharacter.id === sourceEffect.casterCharacterId) {
    return true;
  }

  const comparisonEffect = buildAuraSharedPowerEffect(sourceEffect, targetCharacter.id);
  return (targetCharacter.sheet.activePowerEffects ?? []).some(
    (effect) =>
      isAuraSharedEffect(effect) &&
      (effect.sourceEffectId === sourceEffect.id ||
        doesActivePowerEffectConflict(effect, comparisonEffect))
  );
}

export function getReplacementWarnings(
  finalTargets: CharacterRecord[],
  builtEffects: ActivePowerEffect[]
): string[] {
  return finalTargets.flatMap((targetCharacter, index) => {
    const builtEffect = builtEffects[index];
    const existingEffect = (targetCharacter.sheet.activePowerEffects ?? []).find((effect) =>
      doesActivePowerEffectConflict(effect, builtEffect)
    );

    if (!existingEffect) {
      return [];
    }

    const targetName = targetCharacter.sheet.name.trim() || targetCharacter.id;
    const statText = builtEffect.selectedStatId ? ` on ${builtEffect.selectedStatId}` : "";

    return [
      `${targetName} already has ${existingEffect.label}${statText}. Recasting will replace it and still spend mana.`,
    ];
  });
}

export function prepareCastRequest(
  payload: CastRequestPayload
): { error: string } | { request: PreparedCastRequest; warnings: string[] } {
  const casterView =
    payload.encounterParticipants.find(
      ({ participant }) => participant.characterId === payload.casterCharacter.id
    ) ?? null;
  const validTargetViews = casterView
    ? getEncounterCastTargetOptions({
        casterView,
        encounterParticipants: payload.encounterParticipants,
        selectedPower: payload.selectedPower,
        selectedVariantId: payload.selectedVariantId,
        castMode: payload.castMode,
      })
    : [];
  const validTargetIds = new Set(
    validTargetViews.map(({ participant }) => participant.characterId)
  );
  const selectedTargetViews = payload.selectedTargetIds
    .map((targetId) =>
      payload.encounterParticipants.find(({ participant }) => participant.characterId === targetId)
    )
    .filter(
      (targetView): targetView is EncounterParticipantView =>
        targetView !== undefined && validTargetIds.has(targetView.participant.characterId)
    );
  const fallbackTargetViews = payload.fallbackTargetIds
    .map((targetId) =>
      payload.encounterParticipants.find(({ participant }) => participant.characterId === targetId)
    )
    .filter(
      (targetView): targetView is EncounterParticipantView =>
        targetView !== undefined && validTargetIds.has(targetView.participant.characterId)
    );
  const finalTargetViews = selectedTargetViews.length > 0 ? selectedTargetViews : fallbackTargetViews;
  const finalTargets = finalTargetViews
    .map((targetView) => targetView.character)
    .filter((targetCharacter): targetCharacter is CharacterRecord => targetCharacter !== null);
  const casterName = payload.casterCharacter.sheet.name.trim() || payload.casterDisplayName;

  if (
    payload.selectedTargetIds.some((targetId) => targetId.length > 0 && !validTargetIds.has(targetId))
  ) {
    return { error: "At least one selected target is not valid for this action." };
  }

  if (finalTargets.length === 0) {
    return { error: "Select at least one valid target before casting." };
  }

  if (payload.selectedPower.id === "awareness" && payload.selectedVariantId === "assess_character") {
    const targetCharacter = finalTargets[0];
    if (!targetCharacter) {
      return { error: "Select one target for Assess Character." };
    }

    const awarenessLevel = payload.selectedPower.level;
    const casterPerception = buildCharacterDerivedValues(
      payload.casterCharacter.sheet,
      payload.itemsById ?? {}
    ).currentStats.PER;
    const crCaps = [0, 6, 9, 12, 15, 18];
    const allowedCr = Math.min(casterPerception + awarenessLevel, crCaps[awarenessLevel] ?? 18);
    const targetCr = getCrAndRankFromXpUsed(targetCharacter.sheet.xpUsed).cr;

    if (targetCr > allowedCr) {
      return {
        error: `Assess Character limit is CR ${allowedCr}, but ${targetCharacter.sheet.name.trim() || targetCharacter.id} is CR ${targetCr}.`,
      };
    }

    const now = new Date();

    return {
      request: {
        ...buildPreparedCastRequest(payload.casterCharacter.id, [targetCharacter.id], 0),
        activityLogEntries: [
          buildEncounterActivityLogEntry(
            `Assess Character: ${casterName} read ${targetCharacter.sheet.name.trim() || targetCharacter.id}.`
          ),
        ],
        historyEntries: [
          {
            characterId: payload.casterCharacter.id,
            entry: buildAssessCharacterHistoryEntry(
              payload.casterCharacter.sheet,
              targetCharacter,
              `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
              payload.itemsById ?? {}
            ),
          },
        ],
      },
      warnings: [],
    };
  }

  if (payload.selectedPower.id === "crowd_control") {
    if (payload.selectedVariantId === "release_control") {
      const request = buildPreparedCastRequest(
        payload.casterCharacter.id,
        finalTargets.map((targetCharacter) => targetCharacter.id),
        0
      );

      request.statusTagChanges = finalTargets.flatMap((targetCharacter) => [
        {
          characterId: targetCharacter.id,
          operation: "remove" as const,
          tag: {
            id: "paralyzed",
            label: "Paralyzed",
          },
        },
        {
          characterId: targetCharacter.id,
          operation: "remove" as const,
          tag: {
            id: `crowd_control:${payload.casterCharacter.id}`,
            label: `Controlled by ${casterName}`,
          },
        },
      ]);
      request.ongoingStateChanges = finalTargets.map((targetCharacter) => ({
        operation: "releaseCrowdControl" as const,
        casterCharacterId: payload.casterCharacter.id,
        targetCharacterId: targetCharacter.id,
      }));
      request.activityLogEntries = [
        buildEncounterActivityLogEntry(
          `Crowd Control released on ${joinTargetNames(finalTargets)}.`
        ),
      ];

      return { request, warnings: [] };
    }

    if (payload.contestOutcome === "unresolved") {
      return { error: "Resolve the control contest first." };
    }

    if (payload.contestOutcome === "failure") {
      return {
        request: {
          ...buildPreparedCastRequest(
            payload.casterCharacter.id,
            finalTargets.map((targetCharacter) => targetCharacter.id),
            0
          ),
          activityLogEntries: [
            buildEncounterActivityLogEntry(
              `Crowd Control failed on ${joinTargetNames(finalTargets)}.`
            ),
          ],
        },
        warnings: [],
      };
    }

    const runtimeLevel = getRuntimePowerLevelDefinition(
      payload.selectedPower.id,
      payload.selectedPower.level
    );
    const mechanics = runtimeLevel?.mechanics ?? {};
    const allowedTargetTypes = Array.isArray(mechanics.allowed_target_types)
      ? mechanics.allowed_target_types.filter((value): value is string => typeof value === "string")
      : ["living"];
    const maxControlledTargets = Math.max(1, Math.trunc(Number(mechanics.max_controlled_targets ?? 1)));
    const currentlyControlledTargetIds = new Set(
      payload.encounterParticipants.flatMap((view) =>
        isControlledByCaster(view, payload.casterCharacter.id) ? [view.participant.characterId] : []
      )
    );
    const invalidTargets = finalTargetViews.filter((targetView) => {
      const isLiving = isLivingEncounterTarget(targetView);

      if (isLiving) {
        return !allowedTargetTypes.includes("living");
      }

      if (targetView.transientCombatant) {
        return true;
      }

      return !allowedTargetTypes.includes("non_living_except_other_occult_summons");
    });

    if (invalidTargets.length > 0) {
      return {
        error:
          payload.selectedPower.level >= 5
            ? "At least one target is an unsupported summon for Crowd Control."
            : "Crowd Control can only target living creatures at this level.",
      };
    }

    const newControlledTargetCount = finalTargets.filter(
      (targetCharacter) => !currentlyControlledTargetIds.has(targetCharacter.id)
    ).length;
    if (currentlyControlledTargetIds.size + newControlledTargetCount > maxControlledTargets) {
      return {
        error: `Crowd Control can maintain at most ${maxControlledTargets} controlled target(s) at this level.`,
      };
    }

    if (
      finalTargets.some((targetCharacter) =>
        targetCharacter.sheet.statusTags.some(
          (tag) => normalizeStatusTagText(tag.id) === "crowd_control_immunity"
        )
      )
    ) {
      return { error: "At least one target is currently immune to Crowd Control." };
    }

    const request = buildPreparedCastRequest(
      payload.casterCharacter.id,
      finalTargets.map((targetCharacter) => targetCharacter.id),
      0
    );

    request.statusTagChanges = finalTargets.flatMap((targetCharacter) => [
      {
        characterId: targetCharacter.id,
        operation: "add" as const,
        tag: {
          id: "paralyzed",
          label: "Paralyzed",
        },
      },
      {
        characterId: targetCharacter.id,
        operation: "add" as const,
        tag: {
          id: `crowd_control:${payload.casterCharacter.id}`,
          label: `Controlled by ${casterName}`,
        },
      },
    ]);
    request.ongoingStateChanges = finalTargets.map((targetCharacter) => ({
      operation: "add" as const,
      state: {
        id: createTimestampedId("crowd-control"),
        kind: "crowd_control" as const,
        casterCharacterId: payload.casterCharacter.id,
        targetCharacterId: targetCharacter.id,
        powerLevel: payload.selectedPower.level,
        maintenanceManaCost:
          typeof mechanics.maintenance_mana_cost_per_target_per_turn === "number"
            ? mechanics.maintenance_mana_cost_per_target_per_turn
            : typeof mechanics.maintenance_mana_cost_per_turn === "number"
              ? mechanics.maintenance_mana_cost_per_turn
              : 1,
        breaksOnDamageFromCaster: mechanics.breaks_on_damage_from_caster !== false,
        breaksOnDamageFromOthers: mechanics.breaks_on_damage_from_others !== false,
        commandActionType:
          mechanics.command_action_type === "bonus" || mechanics.command_action_type === "free"
            ? mechanics.command_action_type
            : null,
        summaryNote: null,
      },
    }));
    request.activityLogEntries = [
      buildEncounterActivityLogEntry(
        `Crowd Control seized ${finalTargets.length} target${finalTargets.length === 1 ? "" : "s"}.`
      ),
    ];

    return {
      request,
      warnings: [],
    };
  }

  if (payload.selectedPower.id === "healing") {
    const healingResolution = buildHealingCastResolution({
      casterSheet: payload.casterCharacter.sheet,
      power: payload.selectedPower,
      variantId: payload.selectedVariantId,
      targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
      allocations: payload.healingAllocations,
      itemsById: payload.itemsById,
    });
    if ("error" in healingResolution) {
      return { error: healingResolution.error };
    }

    const perTargetDailyLimit = healingResolution.perTargetDailyLimit;
    if (
      perTargetDailyLimit !== null &&
      healingResolution.applications.some(
        (application) =>
          getPerTargetDailyPowerUsageCount(
            payload.casterCharacter.sheet.powerUsageState,
            POWER_USAGE_KEYS.healingCantrip,
            application.targetCharacterId
          ) >= perTargetDailyLimit
      )
    ) {
      return { error: "Healing cantrip uses for at least one target are already exhausted today." };
    }

    const request = buildPreparedCastRequest(
      payload.casterCharacter.id,
      healingResolution.applications.map((application) => application.targetCharacterId),
      healingResolution.manaCost
    );

    request.healingApplications = healingResolution.applications.map((application) => {
      if (!healingResolution.overhealCapStat) {
        return application;
      }

      const targetCharacter = finalTargets.find(
        (target) => target.id === application.targetCharacterId
      );
      const alreadyUsed =
        targetCharacter &&
        getPerTargetDailyPowerUsageCount(
          payload.casterCharacter.sheet.powerUsageState,
          POWER_USAGE_KEYS.healingOverheal,
          targetCharacter.id
        ) >= 1;

      return {
        ...application,
        temporaryHpCap:
          targetCharacter && !alreadyUsed
            ? getCurrentStatValue(
                targetCharacter.sheet,
                healingResolution.overhealCapStat,
                payload.itemsById ?? {}
              )
            : null,
      };
    });
    request.statusTagChanges = finalTargets.flatMap((targetCharacter) =>
      buildStatusRemovalChanges(targetCharacter, healingResolution.removedStatuses)
    );
    request.historyEntries = finalTargets.flatMap((targetCharacter) =>
      healingResolution.canRegrowLimbs
        ? [
            {
              characterId: targetCharacter.id,
              entry: buildGameHistoryNoteEntry(
                "Regrowth-capable healing applied. Restore missing limbs if relevant.",
                targetCharacter.sheet.gameDateTime
              ),
            },
          ]
        : []
    );
    request.usageCounterChanges = [
      ...healingResolution.applications.flatMap((application) =>
        healingResolution.perTargetDailyLimit !== null
          ? [
              {
                characterId: payload.casterCharacter.id,
                operation: "increment" as const,
                scope: "perTargetDaily" as const,
                key: POWER_USAGE_KEYS.healingCantrip,
                targetCharacterId: application.targetCharacterId,
                amount: 1,
              },
            ]
          : []
      ),
      ...request.healingApplications.flatMap((application) =>
        application.temporaryHpCap !== null
          ? [
              {
                characterId: payload.casterCharacter.id,
                operation: "increment" as const,
                scope: "perTargetDaily" as const,
                key: POWER_USAGE_KEYS.healingOverheal,
                targetCharacterId: application.targetCharacterId,
                amount: 1,
              },
            ]
          : []
      ),
    ];
    request.activityLogEntries = [
      buildEncounterActivityLogEntry(
        `${payload.selectedVariantId === "cure" ? "Cure" : payload.selectedVariantId === "wound_mend" ? "Wound Mend" : "Heal"}: ${casterName} affected ${joinTargetNames(finalTargets)}.`
      ),
    ];

    return {
      request,
      warnings: [],
    };
  }

  if (payload.selectedPower.id === "light_support" && payload.selectedVariantId === "mana_restore") {
    const runtimeLevel = getRuntimePowerLevelDefinition(
      payload.selectedPower.id,
      payload.selectedPower.level
    );
    const manaRestore =
      runtimeLevel?.mechanics?.mana_restore &&
      typeof runtimeLevel.mechanics.mana_restore === "object"
        ? (runtimeLevel.mechanics.mana_restore as Record<string, unknown>)
        : null;

    if (!runtimeLevel || !manaRestore) {
      return { error: "Mana Restore data is missing for this Light Support level." };
    }

    if (
      getPowerUsageCount(
        payload.casterCharacter.sheet.powerUsageState,
        "longRest",
        POWER_USAGE_KEYS.lightSupportManaRestore
      ) >= 1
    ) {
      return { error: "Light Support mana restore is already spent for this long rest." };
    }

    const restoreAmount = Math.max(
      0,
      getCurrentStatValue(payload.casterCharacter.sheet, "APP", payload.itemsById ?? {}) *
        Math.max(1, Math.trunc(Number((manaRestore.max_amount_formula as { multiplier?: number })?.multiplier ?? 1)))
    );
    const targetCharacter = finalTargets[0];
    if (!targetCharacter) {
      return { error: "Select one target for Mana Restore." };
    }

    return {
      request: {
        ...buildPreparedCastRequest(payload.casterCharacter.id, [targetCharacter.id], 0),
        activityLogEntries: [
          buildEncounterActivityLogEntry(
            `Mana Restore: ${casterName} restored mana to ${targetCharacter.sheet.name.trim() || targetCharacter.id}.`
          ),
        ],
        resourceChanges: [
          {
            characterId: targetCharacter.id,
            field: "currentMana",
            operation: "adjust",
            value: restoreAmount,
          },
        ],
        usageCounterChanges: [
          {
            characterId: payload.casterCharacter.id,
            operation: "increment",
            scope: "longRest",
            key: POWER_USAGE_KEYS.lightSupportManaRestore,
            targetCharacterId: null,
            amount: 1,
          },
        ],
      },
      warnings: [],
    };
  }

  if (
    payload.selectedPower.id === "shadow_control" &&
    payload.selectedVariantId === "shadow_walk"
  ) {
    const runtimeLevel = getRuntimePowerLevelDefinition(
      payload.selectedPower.id,
      payload.selectedPower.level
    );
    const shadowWalk =
      runtimeLevel?.mechanics?.shadow_walk &&
      typeof runtimeLevel.mechanics.shadow_walk === "object"
        ? (runtimeLevel.mechanics.shadow_walk as Record<string, unknown>)
        : null;
    const targetCharacter = finalTargets[0];
    if (!targetCharacter) {
      return { error: "Select one living target for Shadow Walk." };
    }

    return {
      request: {
        ...buildPreparedCastRequest(payload.casterCharacter.id, [targetCharacter.id], 2),
        activityLogEntries: [
          buildEncounterActivityLogEntry(
            `Shadow Walk: ${casterName} moved through ${targetCharacter.sheet.name.trim() || targetCharacter.id}'s shadow.`
          ),
        ],
      },
      warnings: [],
    };
  }

  if (
    payload.selectedPower.id === "elementalist" ||
    (payload.selectedPower.id === "shadow_control" &&
      payload.selectedVariantId === "shadow_manipulation") ||
    (payload.selectedPower.id === "necromancy" && payload.selectedVariantId === "necrotic_touch")
  ) {
    if (payload.selectedPower.id === "elementalist" && payload.selectedPower.level <= 2) {
      const lockedDamageType = getLongRestSelection(
        payload.casterCharacter.sheet.powerUsageState,
        POWER_USAGE_KEYS.elementalistLockedDamageType
      );
      if (lockedDamageType && payload.selectedDamageType !== lockedDamageType) {
        return { error: `Elementalist is locked to ${lockedDamageType} until long rest.` };
      }
    }

    if (payload.selectedPower.id === "necromancy" && payload.selectedVariantId === "necrotic_touch") {
      if (payload.attackOutcome === "unresolved") {
        return { error: "Resolve the touch attack outcome first." };
      }

      if (payload.attackOutcome === "miss") {
        const runtimeLevel = getRuntimePowerLevelDefinition(
          payload.selectedPower.id,
          payload.selectedPower.level
        );
        const necroticTouch =
          runtimeLevel?.mechanics?.necrotic_touch &&
          typeof runtimeLevel.mechanics.necrotic_touch === "object"
            ? (runtimeLevel.mechanics.necrotic_touch as Record<string, unknown>)
            : null;

        return {
          request: {
            ...buildPreparedCastRequest(
              payload.casterCharacter.id,
              finalTargets.map((targetCharacter) => targetCharacter.id),
              typeof necroticTouch?.mana_cost === "number"
                ? necroticTouch.mana_cost
                : runtimeLevel?.mana_cost ?? 0
            ),
            activityLogEntries: [
              buildEncounterActivityLogEntry(
                `Necrotic Touch missed ${joinTargetNames(finalTargets)}.`
              ),
            ],
          },
          warnings: [],
        };
      }
    }

    const damageResolution = buildDirectDamageCastResolution({
      casterSheet: payload.casterCharacter.sheet,
      power: payload.selectedPower,
      variantId: payload.selectedVariantId,
      targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
      selectedDamageType: payload.selectedDamageType,
      bonusManaSpend: payload.bonusManaSpend,
      targetMetadata: finalTargetViews.map((targetView) => ({
        characterId: targetView.participant.characterId,
        isLiving: isLivingEncounterTarget(targetView),
        blocksNecroticTouch: blocksNecroticTouch(targetView),
      })),
      itemsById: payload.itemsById,
    });
    if ("error" in damageResolution) {
      return { error: damageResolution.error };
    }

    const request = buildPreparedCastRequest(
      payload.casterCharacter.id,
      finalTargets.map((targetCharacter) => targetCharacter.id),
      damageResolution.manaCost
    );
    request.damageApplications = damageResolution.applications.map((application) => ({
      ...application,
      sourceCharacterId: payload.casterCharacter.id,
    }));

    if (payload.selectedPower.id === "elementalist" && payload.selectedPower.level <= 2) {
      const lockedDamageType = getLongRestSelection(
        payload.casterCharacter.sheet.powerUsageState,
        POWER_USAGE_KEYS.elementalistLockedDamageType
      );

      if (!lockedDamageType && payload.selectedDamageType) {
        request.usageCounterChanges.push({
          characterId: payload.casterCharacter.id,
          operation: "setSelection",
          key: POWER_USAGE_KEYS.elementalistLockedDamageType,
          value: payload.selectedDamageType,
        });
      }
    }

    if (payload.selectedPower.id === "necromancy" && payload.selectedVariantId === "necrotic_touch") {
      request.healingApplications.push({
        targetCharacterId: payload.casterCharacter.id,
        amount: payload.selectedPower.level,
        temporaryHpCap: null,
      });

      if (damageResolution.undeadHealingAmount !== null && damageResolution.undeadHealingAmount !== undefined) {
        const targetCharacter = finalTargets[0];
        if (targetCharacter) {
          request.healingApplications.push({
            targetCharacterId: targetCharacter.id,
            amount: damageResolution.undeadHealingAmount,
            temporaryHpCap: null,
          });
        }
      }
    }
    request.activityLogEntries = [
      buildEncounterActivityLogEntry(
        `${payload.selectedVariantId === "elemental_cantrip" ? "Elemental Cantrip" : payload.selectedVariantId === "shadow_manipulation" ? "Shadow Manipulation" : "Necrotic Touch"}: ${casterName} targeted ${joinTargetNames(finalTargets)}.`
      ),
    ];

    return {
      request,
      warnings: [],
    };
  }

  if (
    (payload.selectedPower.id === "necromancy" &&
      (payload.selectedVariantId === "summon_undead" ||
        payload.selectedVariantId === "dismiss_summon")) ||
    (payload.selectedPower.id === "shadow_control" &&
      (payload.selectedVariantId === "shadow_soldier" ||
        payload.selectedVariantId === "dismiss_summon"))
  ) {
    const activeTransientCombatants = payload.encounterParticipants.flatMap((targetView) =>
      targetView.transientCombatant ? [targetView.transientCombatant] : []
    );
    if (payload.selectedVariantId === "dismiss_summon") {
      const dismissIds = activeTransientCombatants
        .filter(
          (entry) =>
            entry.controllerCharacterId === payload.casterCharacter.id &&
            entry.sourcePowerId === payload.selectedPower.id
        )
        .map((entry) => entry.id);
      if (dismissIds.length === 0) {
        return { error: "There is no active summon to remove for this power." };
      }

      return {
        request: {
          ...buildPreparedCastRequest(
            payload.casterCharacter.id,
            [payload.casterCharacter.id],
            0
          ),
          activityLogEntries: [
            buildEncounterActivityLogEntry(
              `Remove Summon: ${casterName} dismissed an active summon.`
            ),
          ],
          summonChanges: dismissIds.map((summonId) => ({
            operation: "dismiss" as const,
            summonId,
          })),
        },
        warnings: [],
      };
    }

    const casterParticipant =
      payload.encounterParticipants.find(
        ({ participant }) => participant.characterId === payload.casterCharacter.id
      )?.participant ?? null;
    if (!casterParticipant) {
      return { error: "The casting combatant is no longer present in the encounter." };
    }

    const summonResolution = buildSummonCastResolution({
      casterCharacter: payload.casterCharacter,
      casterParticipant,
      power: payload.selectedPower,
      selectedSummonOptionId: payload.selectedSummonOptionId ?? "",
      activeTransientCombatants,
    });
    if ("error" in summonResolution) {
      return { error: summonResolution.error };
    }

    return {
      request: {
        ...buildPreparedCastRequest(
          payload.casterCharacter.id,
          [payload.casterCharacter.id],
          summonResolution.manaCost
        ),
        activityLogEntries: [
          buildEncounterActivityLogEntry(
            `${payload.selectedPower.id === "shadow_control" ? "Shadow Soldier" : "Summon Undead"}: ${casterName} created ${summonResolution.summons.map((summon) => summon.sheet.name.trim() || summon.id).join(", ")}.`
          ),
        ],
        summonChanges: [
          ...summonResolution.dismissIds.map((summonId) => ({
            operation: "dismiss" as const,
            summonId,
          })),
          ...summonResolution.summons.map((summon, index) => ({
            operation: "spawn" as const,
            summon,
            participant: summonResolution.participants[index],
          })),
        ],
      },
      warnings: [],
    };
  }

  if (payload.selectedPower.id === "necromancy" && payload.selectedVariantId === "resurrection") {
    const targetView = finalTargetViews[0];
    const targetCharacter = finalTargets[0];
    if (!targetView || !targetCharacter) {
      return { error: "Select one valid resurrection target." };
    }

    if (targetView.transientCombatant) {
      return { error: "Resurrection only works on loaded character sheets." };
    }

    return {
      request: {
        ...buildPreparedCastRequest(payload.casterCharacter.id, [targetCharacter.id], 6),
        activityLogEntries: [
          buildEncounterActivityLogEntry(
            `Resurrection: ${casterName} restored ${targetCharacter.sheet.name.trim() || targetCharacter.id}.`
          ),
        ],
        resourceChanges: [
          {
            characterId: targetCharacter.id,
            field: "currentHp",
            operation: "set",
            value: 1,
          },
        ],
        statusTagChanges: buildStatusRemovalChanges(targetCharacter, [
          "bleeding",
          "dead",
          "dying",
          "unconscious",
        ]),
      },
      warnings: [],
    };
  }

  const builtEffects = finalTargets.map((targetCharacter) =>
    buildActivePowerEffect({
      casterCharacterId: payload.casterCharacter.id,
      casterName,
      targetCharacterId: targetCharacter.id,
      targetName: targetCharacter.sheet.name.trim() || targetCharacter.id,
      power: payload.selectedPower,
      variantId: payload.selectedVariantId,
      selectedStatId: payload.selectedStatId,
      castMode: payload.castMode,
    })
  );
  const buildError = builtEffects.find((effect) => "error" in effect);
  if (buildError && "error" in buildError) {
    return { error: buildError.error };
  }

  const effects = builtEffects.map((effect) => {
    if ("error" in effect) {
      throw new Error("Cast effect unexpectedly failed after validation.");
    }

    return effect.effect;
  });
  const expandedEffects = [...effects];

  const sourceEffect = expandedEffects.find(
    (effect) =>
      effect.effectKind === "aura_source" &&
      (effect.powerId === "light_support" || effect.shareMode === "aura")
  );

  if (sourceEffect && casterView) {
    const allyTargetIds = payload.encounterParticipants
      .filter(
        (view) =>
          view.participant.characterId !== sourceEffect.casterCharacterId &&
          isFriendlyEncounterTarget(casterView.participant, view) &&
          canEncounterTargetReceiveGroupBuff(view)
      )
      .map((view) => view.participant.characterId);
    const targetIds = Array.from(new Set([sourceEffect.casterCharacterId, ...allyTargetIds]));
    const updatedSourceEffect = {
      ...sourceEffect,
      sharedTargetCharacterIds: targetIds,
    };
    expandedEffects[expandedEffects.indexOf(sourceEffect)] = updatedSourceEffect;
    allyTargetIds.forEach((targetId) => {
      expandedEffects.push(buildAuraSharedPowerEffect(updatedSourceEffect, targetId));
    });
  }

  return {
    request: {
      ...buildPreparedCastRequest(
        payload.casterCharacter.id,
        finalTargets.map((targetCharacter) => targetCharacter.id),
        builtEffects[0] && !("error" in builtEffects[0]) ? builtEffects[0].manaCost : 0
      ),
      effects: expandedEffects,
      activityLogEntries: [
        buildEncounterActivityLogEntry(
          `${payload.selectedPower.id === "light_support" && payload.selectedVariantId === "expose_darkness"
            ? "Expose Darkness"
            : payload.selectedPower.id === "light_support"
              ? "Light Aura"
              : "Cloak of Shadow"}: ${casterName} affected ${joinTargetNames(finalTargets)}.`
        ),
      ],
      ongoingStateChanges:
        payload.selectedPower.id === "light_support" && payload.selectedVariantId === "expose_darkness"
          ? finalTargets.map((targetCharacter) => ({
              operation: "add" as const,
              state: {
                id: createTimestampedId("light-support-expose"),
                kind: "expose_darkness" as const,
                casterCharacterId: payload.casterCharacter.id,
                targetCharacterId: targetCharacter.id,
                summaryNote: "Expose Darkness concentration",
              },
            }))
          : [],
    },
    warnings: getReplacementWarnings(finalTargets, effects),
  };
}

export function getEncounterPartyMembers(
  encounterParticipants: EncounterParticipantView[],
  partyId: string | null,
  itemsById: Record<string, import("../types/items").SharedItemRecord> = {}
): EncounterPartyMemberView[] {
  return encounterParticipants.flatMap((view) => {
    if (!view.character || view.participant.partyId !== partyId) {
      return [];
    }

    const derived = buildCharacterDerivedValues(view.character.sheet, itemsById);
    return [
      {
        participant: view.participant,
        character: view.character,
        currentHp: view.character.sheet.currentHp,
        maxHp: derived.maxHp,
        hpPercent:
          derived.maxHp > 0
            ? Math.max(0, Math.min(100, (view.character.sheet.currentHp / derived.maxHp) * 100))
            : 0,
        statusSummary:
          view.character.sheet.statusTags.length > 0
            ? view.character.sheet.statusTags.map((tag) => tag.label).join(" | ")
            : null,
      },
    ];
  });
}


