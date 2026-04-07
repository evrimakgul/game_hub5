import { buildActivePowerEffect, buildDirectDamageCastResolution, buildLinkedAuraEffectForTarget } from "../rules/powerEffects.ts";
import { buildSummonCastResolution } from "../rules/summons.ts";
import { AttackSpellAction, AuraSpellAction, SummonSpellAction, UtilitySpellAction } from "../engine/actions.ts";
import { AuraEffect, DamageEffect, LogEffect, SummonEffect } from "../engine/effects.ts";
import type { ActionContext } from "../engine/context.ts";
import { createEmptyPassiveProviderResult } from "./passiveSupport.ts";
import {
  blocksNecroticTouch,
  buildEncounterActivityLogEntry,
  buildInheritedAuraEffectsForSummons,
  getReplacementWarnings,
  isLivingEncounterTarget,
  isUndeadEncounterTarget,
  joinTargetNames,
} from "./runtimeSupport.ts";
import {
  SHADOW_CONTROL_AURA_SPELL_NAME,
  SHADOW_CONTROL_FIGHTER_SPELL_NAME,
  SHADOW_CONTROL_MANIPULATION_SPELL_NAME,
  SHADOW_CONTROL_WALK_ATTACK_SPELL_NAME,
  SHADOW_CONTROL_WALK_SPELL_NAME,
} from "./spellLabels.ts";
import { PowerPassiveProvider, type PowerModule } from "./types.ts";

class EmptyPassiveProvider extends PowerPassiveProvider {
  override getResult() {
    return createEmptyPassiveProviderResult();
  }
}

class SmolderingShadowSpellAction extends AuraSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    if (!selectedPower || !context.casterView) {
      throw new Error("Select at least one valid target before casting.");
    }

    const builtEffect = buildActivePowerEffect({
      casterCharacterId: context.casterCharacter.id,
      casterName: context.casterName,
      targetCharacterId: context.casterCharacter.id,
      targetName: context.casterCharacter.sheet.name.trim() || context.casterCharacter.id,
      power: selectedPower,
      variantId: "smoldering_shadow",
      selectedStatId: context.selectedStatId,
      castMode: context.castMode,
    });

    if ("error" in builtEffect) {
      throw new Error(builtEffect.error);
    }

    this.setManaCost(builtEffect.manaCost);
    const selectedTargetIds = Array.from(
      new Set([
        context.casterCharacter.id,
        ...context.finalTargetViews.map((targetView) => targetView.participant.characterId),
      ])
    );
    this.setTargetCharacterIds(selectedTargetIds);

    getReplacementWarnings([context.casterCharacter], [builtEffect.effect]).forEach((warning) =>
      this.addWarning(warning)
    );

    const sourceEffect = builtEffect.effect;
    const allyTargetIds =
      context.castMode === "aura"
        ? selectedTargetIds.filter((targetId) => targetId !== sourceEffect.casterCharacterId)
        : [];
    const updatedSourceEffect =
      allyTargetIds.length > 0
        ? {
            ...sourceEffect,
            sharedTargetCharacterIds: [sourceEffect.casterCharacterId, ...allyTargetIds],
          }
        : sourceEffect;

    return [
      new AuraEffect([
        updatedSourceEffect,
        ...allyTargetIds.map((targetId) =>
          buildLinkedAuraEffectForTarget(updatedSourceEffect, targetId, {
            targetDisposition: "ally",
          })
        ),
      ]),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${SHADOW_CONTROL_AURA_SPELL_NAME}: ${context.casterName} affected ${
            joinTargetNames(context.finalTargets) || context.casterName
          }.`
        )
      ),
    ];
  }
}

class ShadowWalkSpellAction extends UtilitySpellAction {
  override resolve(context: ActionContext) {
    const targetCharacter = context.finalTargets[0];
    if (!targetCharacter) {
      throw new Error("Select one living target for Shadow Walk.");
    }

    this.setManaCost(2);
    this.setTargetCharacterIds([targetCharacter.id]);

    return [
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${SHADOW_CONTROL_WALK_SPELL_NAME}: ${context.casterName} moved through ${
            targetCharacter.sheet.name.trim() || targetCharacter.id
          }'s shadow.`
        )
      ),
    ];
  }
}

class ShadowWalkAndAttackSpellAction extends UtilitySpellAction {
  override resolve(context: ActionContext) {
    const targetCharacter = context.finalTargets[0];
    if (!targetCharacter) {
      throw new Error("Select one living target for Shadow Walk and Attack.");
    }

    this.setManaCost(2);
    this.setTargetCharacterIds([targetCharacter.id]);

    return [
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${SHADOW_CONTROL_WALK_ATTACK_SPELL_NAME}: ${context.casterName} ambushed ${
            targetCharacter.sheet.name.trim() || targetCharacter.id
          } through their shadow.`
        )
      ),
    ];
  }
}

class ShadowManipulationSpellAction extends AttackSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    if (!selectedPower) {
      throw new Error("Select at least one valid target before casting.");
    }

    const damageResolution = buildDirectDamageCastResolution({
      casterSheet: context.casterCharacter.sheet,
      power: selectedPower,
      variantId: context.selectedSpellId,
      targetCharacterIds: context.finalTargets.map((targetCharacter) => targetCharacter.id),
      selectedDamageType: context.selectedDamageType,
      bonusManaSpend: context.bonusManaSpend,
      targetMetadata: context.finalTargetViews.map((targetView) => ({
        characterId: targetView.participant.characterId,
        isLiving: isLivingEncounterTarget(targetView),
        isUndead: isUndeadEncounterTarget(targetView),
        blocksNecroticTouch: blocksNecroticTouch(targetView),
      })),
      itemsById: context.itemsById,
    });

    if ("error" in damageResolution) {
      throw new Error(damageResolution.error);
    }

    this.setManaCost(damageResolution.manaCost);
    this.setTargetCharacterIds(context.finalTargets.map((target) => target.id));

    return [
      ...damageResolution.applications.map(
        (application) =>
          new DamageEffect({
            ...application,
            sourceCharacterId: context.casterCharacter.id,
          })
      ),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${SHADOW_CONTROL_MANIPULATION_SPELL_NAME}: ${context.casterName} targeted ${joinTargetNames(
            context.finalTargets
          )}.`
        )
      ),
    ];
  }
}

class ShadowFighterSpellAction extends SummonSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    if (!selectedPower) {
      throw new Error("Select at least one valid target before casting.");
    }

    const activeTransientCombatants = context.encounterParticipants.flatMap((targetView) =>
      targetView.transientCombatant ? [targetView.transientCombatant] : []
    );

    if (context.selectedSpellId === "dismiss_summon") {
      const dismissIds = activeTransientCombatants
        .filter(
          (entry) =>
            entry.controllerCharacterId === context.casterCharacter.id &&
            entry.sourcePowerId === selectedPower.id &&
            (!context.selectedSummonOptionId || entry.id === context.selectedSummonOptionId)
        )
        .map((entry) => entry.id);

      if (dismissIds.length === 0) {
        throw new Error("There is no active summon to remove for this power.");
      }

      this.setManaCost(0);
      this.setTargetCharacterIds([context.casterCharacter.id]);

      return [
        new SummonEffect(
          dismissIds.map((summonId) => ({
            operation: "dismiss" as const,
            summonId,
          }))
        ),
        new LogEffect(
          buildEncounterActivityLogEntry(
            `Remove Summon: ${context.casterName} dismissed an active summon.`
          )
        ),
      ];
    }

    if (!context.casterView) {
      throw new Error("The casting combatant is no longer present in the encounter.");
    }

    const summonResolution = buildSummonCastResolution({
      casterCharacter: context.casterCharacter,
      casterParticipant: context.casterView.participant,
      power: selectedPower,
      selectedSummonOptionId: context.selectedSummonOptionId ?? "shadow_fighter:1:4",
      activeTransientCombatants,
    });

    if ("error" in summonResolution) {
      throw new Error(summonResolution.error);
    }

    this.setManaCost(summonResolution.manaCost);
    this.setTargetCharacterIds([context.casterCharacter.id]);

    const inheritedAuraEffects = buildInheritedAuraEffectsForSummons({
      casterEffects: context.casterCharacter.sheet.activePowerEffects ?? [],
      summons: summonResolution.summons,
    });

    return [
      new SummonEffect([
        ...summonResolution.dismissIds.map((summonId) => ({
          operation: "dismiss" as const,
          summonId,
        })),
        ...summonResolution.summons.map((summon, index) => ({
          operation: "spawn" as const,
          summon,
          participant: summonResolution.participants[index],
        })),
      ]),
      ...(inheritedAuraEffects.length > 0 ? [new AuraEffect(inheritedAuraEffects)] : []),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${SHADOW_CONTROL_FIGHTER_SPELL_NAME}: ${context.casterName} created ${summonResolution.summons
            .map((summon) => summon.sheet.name.trim() || summon.id)
            .join(", ")}.`
        )
      ),
    ];
  }
}

export const shadowControlModule: PowerModule = {
  powerId: "shadow_control",
  spellIds: [
    "smoldering_shadow",
    "shadow_walk",
    "shadow_walk_attack",
    "shadow_manipulation",
    "shadow_fighter",
    "dismiss_summon",
  ],
  passiveProvider: new EmptyPassiveProvider(),
  createAction(context) {
    if (context.selectedSpellId === "shadow_walk") {
      return new ShadowWalkSpellAction();
    }

    if (context.selectedSpellId === "shadow_walk_attack") {
      return new ShadowWalkAndAttackSpellAction();
    }

    if (context.selectedSpellId === "shadow_manipulation") {
      return new ShadowManipulationSpellAction();
    }

    if (
      context.selectedSpellId === "shadow_fighter" ||
      context.selectedSpellId === "dismiss_summon"
    ) {
      return new ShadowFighterSpellAction();
    }

    if (
      context.selectedSpellId === "default" ||
      context.selectedSpellId === "shadow_cloak" ||
      context.selectedSpellId === "smoldering_shadow"
    ) {
      return new SmolderingShadowSpellAction();
    }

    return null;
  },
};
