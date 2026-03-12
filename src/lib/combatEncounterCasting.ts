import { buildCharacterEncounterSnapshot } from "../config/combatEncounter.ts";
import { buildCharacterDerivedValues, getCurrentSkillValue } from "../config/characterRuntime.ts";
import {
  buildActivePowerEffect,
  buildAuraSharedPowerEffect,
  buildDirectDamageCastResolution,
  buildHealingCastResolution,
  doesActivePowerEffectConflict,
  isAuraSharedEffect,
} from "../config/powerEffects.ts";
import { getRuntimePowerLevelDefinition } from "../config/powerData.ts";
import type { GameHistoryEntry } from "../config/characterTemplate.ts";
import { getCrAndRankFromXpUsed } from "../config/xpTables.ts";
import type { ActivePowerEffect } from "../types/activePowerEffects.ts";
import type { CharacterRecord } from "../types/character.ts";
import type {
  CastRequestPayload,
  EncounterParticipantView,
  EncounterPartyMemberView,
  PreparedCastRequest,
} from "../types/combatEncounterView.ts";
import { createTimestampedId } from "./ids.ts";

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
  actualDateTime: string
): GameHistoryEntry {
  const targetDerived = buildCharacterDerivedValues(targetCharacter.sheet);
  const targetSnapshot = buildCharacterEncounterSnapshot(targetCharacter.sheet);
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
        value: getCurrentSkillValue(targetCharacter.sheet, skill.id),
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
  const resolvedTargets = payload.selectedTargetIds
    .map(
      (targetId) =>
        payload.encounterParticipants.find(({ participant }) => participant.characterId === targetId)
          ?.character ?? null
    )
    .filter((targetCharacter): targetCharacter is CharacterRecord => targetCharacter !== null);
  const fallbackTargets = payload.fallbackTargetIds
    .map(
      (targetId) =>
        payload.encounterParticipants.find(({ participant }) => participant.characterId === targetId)
          ?.character ?? null
    )
    .filter((targetCharacter): targetCharacter is CharacterRecord => targetCharacter !== null);
  const finalTargets = resolvedTargets.length > 0 ? resolvedTargets : fallbackTargets;

  if (finalTargets.length === 0) {
    return { error: "Select at least one valid target before casting." };
  }

  if (payload.selectedPower.id === "awareness" && payload.selectedVariantId === "assess_character") {
    const targetCharacter = finalTargets[0];
    if (!targetCharacter) {
      return { error: "Select one target for Assess Character." };
    }

    const awarenessLevel = payload.selectedPower.level;
    const casterPerception = buildCharacterDerivedValues(payload.casterCharacter.sheet).currentStats.PER;
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
        casterCharacterId: payload.casterCharacter.id,
        targetCharacterIds: [targetCharacter.id],
        manaCost: 0,
        effects: [],
        historyEntries: [
          {
            characterId: payload.casterCharacter.id,
            entry: buildAssessCharacterHistoryEntry(
              payload.casterCharacter.sheet,
              targetCharacter,
              `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`
            ),
          },
        ],
        healingApplications: [],
        damageApplications: [],
      },
      warnings: [],
    };
  }

  if (payload.selectedPower.id === "healing") {
    const healingResolution = buildHealingCastResolution({
      casterSheet: payload.casterCharacter.sheet,
      power: payload.selectedPower,
      targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
      allocations: payload.healingAllocations,
    });
    if ("error" in healingResolution) {
      return { error: healingResolution.error };
    }

    return {
      request: {
        casterCharacterId: payload.casterCharacter.id,
        targetCharacterIds: healingResolution.applications.map(
          (application) => application.targetCharacterId
        ),
        manaCost: healingResolution.manaCost,
        effects: [],
        historyEntries: [],
        healingApplications: healingResolution.applications,
        damageApplications: [],
      },
      warnings: [],
    };
  }

  if (payload.selectedPower.id === "shadow_control" && payload.selectedVariantId === "shadow_manipulation") {
    const damageResolution = buildDirectDamageCastResolution({
      casterSheet: payload.casterCharacter.sheet,
      power: payload.selectedPower,
      variantId: payload.selectedVariantId,
      targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
    });
    if ("error" in damageResolution) {
      return { error: damageResolution.error };
    }

    return {
      request: {
        casterCharacterId: payload.casterCharacter.id,
        targetCharacterIds: damageResolution.applications.map(
          (application) => application.targetCharacterId
        ),
        manaCost: damageResolution.manaCost,
        effects: [],
        historyEntries: [],
        healingApplications: [],
        damageApplications: damageResolution.applications,
      },
      warnings: [],
    };
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
          casterCharacterId: payload.casterCharacter.id,
          targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
          manaCost:
            typeof necroticTouch?.mana_cost === "number"
              ? necroticTouch.mana_cost
              : (runtimeLevel?.mana_cost ?? 0),
          effects: [],
          historyEntries: [],
          healingApplications: [],
          damageApplications: [],
        },
        warnings: [],
      };
    }

    const damageResolution = buildDirectDamageCastResolution({
      casterSheet: payload.casterCharacter.sheet,
      power: payload.selectedPower,
      variantId: payload.selectedVariantId,
      targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
    });
    if ("error" in damageResolution) {
      return { error: damageResolution.error };
    }

    return {
      request: {
        casterCharacterId: payload.casterCharacter.id,
        targetCharacterIds: damageResolution.applications.map(
          (application) => application.targetCharacterId
        ),
        manaCost: damageResolution.manaCost,
        effects: [],
        historyEntries: [],
        healingApplications: [
          {
            targetCharacterId: payload.casterCharacter.id,
            amount: payload.selectedPower.level,
          },
        ],
        damageApplications: damageResolution.applications,
      },
      warnings: [],
    };
  }

  const builtEffects = finalTargets.map((targetCharacter) =>
    buildActivePowerEffect({
      casterCharacterId: payload.casterCharacter.id,
      casterName: payload.casterCharacter.sheet.name.trim() || payload.casterDisplayName,
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

  return {
    request: {
      casterCharacterId: payload.casterCharacter.id,
      targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
      manaCost: builtEffects[0] && !("error" in builtEffects[0]) ? builtEffects[0].manaCost : 0,
      effects,
      historyEntries: [],
      healingApplications: [],
      damageApplications: [],
    },
    warnings: getReplacementWarnings(finalTargets, effects),
  };
}

export function getEncounterPartyMembers(
  encounterParticipants: EncounterParticipantView[],
  partyId: string | null
): EncounterPartyMemberView[] {
  return encounterParticipants.flatMap((view) => {
    if (!view.character || view.participant.partyId !== partyId) {
      return [];
    }

    const derived = buildCharacterDerivedValues(view.character.sheet);
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
