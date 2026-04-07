import { buildCharacterEncounterSnapshot } from "../rules/combatEncounter.ts";
import { resolveDicePool } from "../rules/combat.ts";
import { isUndeadSheet } from "../rules/combatResolution.ts";
import {
  buildCharacterDerivedValues,
  getCurrentSkillValue,
  getCurrentStatValue,
} from "../config/characterRuntime.ts";
import {
  buildLinkedAuraEffectForTarget,
  buildAuraSharedPowerEffect,
  doesActivePowerEffectConflict,
  getAuraShareMode,
  getCastPowerTargetModeForVariant,
  isAuraSourceEffect,
  isAuraSharedEffect,
} from "../rules/powerEffects.ts";
import type { GameHistoryEntry } from "../config/characterTemplate.ts";
import { getCrAndRankFromXpUsed } from "../rules/xpTables.ts";
import type { ActivePowerEffect } from "../types/activePowerEffects.ts";
import type { CharacterRecord } from "../types/character.ts";
import type {
  CastRequestPayload,
  EncounterParticipantView,
  EncounterPartyMemberView,
} from "../types/combatEncounterView.ts";
import { createTimestampedId } from "../lib/ids.ts";
import { rollD10Faces } from "../lib/dice.ts";
import type { CastPowerMode, CastPowerVariantId } from "./spellTypes.ts";
import type { SharedItemRecord } from "../types/items.ts";
import {
  BODY_REINFORCEMENT_BUFF_SPELL_NAME,
  LIGHT_SUPPORT_AURA_SPELL_NAME,
  SHADOW_CONTROL_AURA_SPELL_NAME,
} from "./spellLabels.ts";

export function buildEncounterActivityLogEntry(summary: string) {
  return {
    id: createTimestampedId("encounter-log"),
    createdAt: new Date().toISOString(),
    summary,
  };
}

export function joinTargetNames(targets: CharacterRecord[]): string {
  return targets.map((target) => target.sheet.name.trim() || target.id).join(", ");
}

export function getGenericBuffActionLabel(
  powerId: CastRequestPayload["selectedPower"]["id"],
  powerName: string
): string {
  if (powerId === "body_reinforcement") {
    return BODY_REINFORCEMENT_BUFF_SPELL_NAME;
  }

  if (powerId === "light_support") {
    return LIGHT_SUPPORT_AURA_SPELL_NAME;
  }

  if (powerId === "shadow_control") {
    return SHADOW_CONTROL_AURA_SPELL_NAME;
  }

  return powerName;
}

type CrowdControlContestResult = {
  targetCharacter: CharacterRecord;
  casterPool: number;
  casterFaces: number[];
  casterSuccesses: number;
  targetPool: number;
  targetFaces: number[];
  targetSuccesses: number;
  didSucceed: boolean;
};

export function resolveCrowdControlContest(
  casterCharacter: CharacterRecord,
  targetCharacter: CharacterRecord,
  itemsById: Record<string, SharedItemRecord> = {}
): CrowdControlContestResult {
  const casterCrowdControlLevel =
    casterCharacter.sheet.powers.find((power) => power.id === "crowd_control")?.level ?? 0;
  const casterCrowdControlBonus =
    casterCrowdControlLevel >= 4 ? Math.max(0, casterCrowdControlLevel) : 0;
  const casterPool = Math.max(
    0,
    getCurrentStatValue(casterCharacter.sheet, "CHA", itemsById) +
      getCurrentStatValue(casterCharacter.sheet, "INT", itemsById) +
      casterCrowdControlBonus
  );
  const compulsionGuardBonus =
    (targetCharacter.sheet.powers.find((power) => power.id === "crowd_control")?.level ?? 0) >= 5
      ? Math.max(0, getCurrentSkillValue(targetCharacter.sheet, "social", itemsById))
      : 0;
  const targetPool = Math.max(
    0,
    getCurrentStatValue(targetCharacter.sheet, "CHA", itemsById) +
      getCurrentStatValue(targetCharacter.sheet, "WITS", itemsById) +
      compulsionGuardBonus
  );
  const casterFaces = rollD10Faces(casterPool);
  const targetFaces = rollD10Faces(targetPool);
  const casterSuccesses = resolveDicePool(casterFaces, casterPool).successes;
  const targetSuccesses = resolveDicePool(targetFaces, targetPool).successes;

  return {
    targetCharacter,
    casterPool,
    casterFaces,
    casterSuccesses,
    targetPool,
    targetFaces,
    targetSuccesses,
    didSucceed: casterSuccesses > targetSuccesses,
  };
}

export function normalizeStatusTagText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function hasStatusTagId(
  view: EncounterParticipantView | CharacterRecord,
  statusId: string
): boolean {
  const tags =
    "character" in view
      ? view.transientCombatant?.sheet.statusTags ?? view.character?.sheet.statusTags ?? []
      : view.sheet.statusTags ?? [];
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

export function isUndeadEncounterTarget(view: EncounterParticipantView): boolean {
  const sheet = view.transientCombatant?.sheet ?? view.character?.sheet ?? null;
  return sheet ? isUndeadSheet(sheet) : false;
}

export function canEncounterTargetReceiveHealing(view: EncounterParticipantView): boolean {
  return isUndeadEncounterTarget(view) || (view.transientCombatant ? view.transientCombatant.buffRules.canBeHealed : true);
}

export function canEncounterTargetReceiveSingleBuff(view: EncounterParticipantView): boolean {
  return view.transientCombatant ? view.transientCombatant.buffRules.canReceiveSingleBuffs : true;
}

export function canEncounterTargetReceiveGroupBuff(view: EncounterParticipantView): boolean {
  return view.transientCombatant ? view.transientCombatant.buffRules.canReceiveGroupBuffs : true;
}

export function isFriendlyEncounterTarget(
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

export function isEnemyEncounterTarget(
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

export function isControlledByCaster(
  targetView: EncounterParticipantView,
  casterCharacterId: string
): boolean {
  return hasStatusTagId(targetView, `crowd_control:${casterCharacterId}`);
}

export function isLivingEncounterTarget(view: EncounterParticipantView): boolean {
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

export function buildInheritedAuraEffectsForSummons(args: {
  casterEffects: ActivePowerEffect[];
  summons: Array<{
    id: string;
    buffRules: {
      canReceiveGroupBuffs: boolean;
    };
  }>;
}): ActivePowerEffect[] {
  const { casterEffects, summons } = args;

  return casterEffects.flatMap((effect) => {
    if (!isAuraSourceEffect(effect) || getAuraShareMode(effect) !== "aura") {
      return [];
    }

    const summonTargetIds = summons
      .filter((summon) => summon.buffRules.canReceiveGroupBuffs)
      .map((summon) => summon.id)
      .filter((summonId) => !getAuraSelectedTargetIds(effect).includes(summonId));

    if (summonTargetIds.length === 0) {
      return [];
    }

    const updatedSourceEffect = {
      ...effect,
      sharedTargetCharacterIds: [...getAuraSelectedTargetIds(effect), ...summonTargetIds],
    };

    return [
      updatedSourceEffect,
      ...summonTargetIds.map((summonId) =>
        buildLinkedAuraEffectForTarget(updatedSourceEffect, summonId, {
          targetDisposition: "ally",
        })
      ),
    ];
  });
}

export function blocksNecroticTouch(view: EncounterParticipantView): boolean {
  const tags = view.transientCombatant?.sheet.statusTags ?? view.character?.sheet.statusTags ?? [];

  return tags.some((tag) =>
    ["shadow", "incorporeal"].includes(normalizeStatusTagText(tag.id)) ||
    ["shadow", "incorporeal"].includes(normalizeStatusTagText(tag.label))
  );
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
    (
      selectedVariantId === "summon_undead" ||
      selectedVariantId === "dismiss_summon" ||
      selectedVariantId === "non_living_skeleton" ||
      selectedVariantId === "non_living_skeleton_king" ||
      selectedVariantId === "non_living_zombie"
    )
  ) {
    return encounterParticipants.filter(
      ({ participant }) => participant.characterId === casterParticipant.characterId
    );
  }

  if (
    selectedPower.id === "shadow_control" &&
    (
      selectedVariantId === "shadow_soldier" ||
      selectedVariantId === "dismiss_summon" ||
      selectedVariantId === "shadow_fighter"
    )
  ) {
    return encounterParticipants.filter(
      ({ participant }) => participant.characterId === casterParticipant.characterId
    );
  }

  if (
    selectedPower.id === "shadow_control" &&
    (selectedVariantId === "shadow_walk" || selectedVariantId === "shadow_walk_attack")
  ) {
    return encounterParticipants.filter(
      (view) =>
        view.participant.characterId !== casterParticipant.characterId && isLivingEncounterTarget(view)
    );
  }

  if (selectedPower.id === "crowd_control" && selectedVariantId === "release_control") {
    return encounterParticipants.filter((view) => isControlledByCaster(view, casterParticipant.characterId));
  }

  if (
    selectedPower.id === "light_support" &&
    (selectedVariantId === "let_there_be_light" || selectedVariantId === "lessen_darkness")
  ) {
    if (selectedVariantId === "lessen_darkness") {
      return encounterParticipants.filter(
        (view) =>
          view.participant.characterId !== casterParticipant.characterId &&
          view.character !== null
      );
    }

    return [
      ...encounterParticipants.filter(
        ({ participant }) => participant.characterId === casterParticipant.characterId
      ),
      ...encounterParticipants.filter(
        (view) =>
          view.participant.characterId !== casterParticipant.characterId &&
          view.character !== null &&
          canEncounterTargetReceiveGroupBuff(view)
      ),
    ];
  }

  if (
    selectedPower.id === "shadow_control" &&
    selectedVariantId === "smoldering_shadow" &&
    args.castMode === "aura"
  ) {
    return [
      ...encounterParticipants.filter(
        ({ participant }) => participant.characterId === casterParticipant.characterId
      ),
      ...encounterParticipants.filter(
        (view) =>
          view.participant.characterId !== casterParticipant.characterId &&
          view.character !== null &&
          canEncounterTargetReceiveGroupBuff(view)
      ),
    ];
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

  if (selectedPower.id === "light_support" && selectedVariantId === "luminous_restoration") {
    return encounterParticipants.filter((view) => isFriendlyEncounterTarget(casterParticipant, view));
  }

  if (selectedPower.id === "body_reinforcement") {
    if (selectedPower.level === 1) {
      return encounterParticipants.filter(
        ({ participant }) => participant.characterId === casterParticipant.characterId
      );
    }

    return encounterParticipants.filter(
      (view) =>
        isFriendlyEncounterTarget(casterParticipant, view) && canEncounterTargetReceiveSingleBuff(view)
    );
  }

  if (
    selectedPower.id === "elementalist" ||
    (selectedPower.id === "shadow_control" && selectedVariantId === "shadow_walk_attack") ||
    (selectedPower.id === "shadow_control" && selectedVariantId === "shadow_manipulation") ||
    (selectedPower.id === "necromancy" && selectedVariantId === "necrotic_touch")
  ) {
    return encounterParticipants.filter((view) => isEnemyEncounterTarget(casterParticipant, view));
  }

  if (
    selectedPower.id === "necromancy" &&
    (selectedVariantId === "resurrection" || selectedVariantId === "necromancers_bless")
  ) {
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

export function buildStatusRemovalChanges(
  targetCharacter: CharacterRecord,
  statusIds: string[]
) {
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
  itemsById: Record<string, SharedItemRecord> = {}
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

export function getEncounterPartyMembers(
  encounterParticipants: EncounterParticipantView[],
  partyId: string | null,
  itemsById: Record<string, SharedItemRecord> = {}
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
