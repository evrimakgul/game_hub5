import {
  buildActivePowerEffect,
  buildLinkedAuraEffectForTarget,
  isAuraSourceEffect,
} from "../rules/powerEffects.ts";
import { getCurrentStatValue } from "../config/characterRuntime.ts";
import { AuraSpellAction, RestorationSpellAction } from "../engine/actions.ts";
import { AuraEffect, LogEffect, ManaEffect } from "../engine/effects.ts";
import type { ActionContext } from "../engine/context.ts";
import { createEmptyPassiveProviderResult } from "./passiveSupport.ts";
import {
  buildEncounterActivityLogEntry,
  canEncounterTargetReceiveGroupBuff,
  getGenericBuffActionLabel,
  getReplacementWarnings,
  isEnemyEncounterTarget,
  isFriendlyEncounterTarget,
  joinTargetNames,
} from "./runtimeSupport.ts";
import {
  LIGHT_SUPPORT_AURA_SPELL_NAME,
  LIGHT_SUPPORT_DARKNESS_SPELL_NAME,
  LIGHT_SUPPORT_RESTORE_SPELL_NAME,
} from "./spellLabels.ts";
import { PowerPassiveProvider, type PowerModule } from "./types.ts";

class EmptyPassiveProvider extends PowerPassiveProvider {
  override getResult() {
    return createEmptyPassiveProviderResult();
  }
}

class LetThereBeLightSpellAction extends AuraSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    const targetCharacter = context.finalTargets[0];
    if (!selectedPower || !targetCharacter || !context.casterView) {
      throw new Error("Select at least one valid target before casting.");
    }

    const builtEffect = buildActivePowerEffect({
      casterCharacterId: context.casterCharacter.id,
      casterName: context.casterName,
      targetCharacterId: targetCharacter.id,
      targetName: targetCharacter.sheet.name.trim() || targetCharacter.id,
      power: selectedPower,
      variantId: "let_there_be_light",
      selectedStatId: context.selectedStatId,
      castMode: context.castMode,
    });

    if ("error" in builtEffect) {
      throw new Error(builtEffect.error);
    }

    this.setManaCost(builtEffect.manaCost);
    this.setTargetCharacterIds([targetCharacter.id]);

    getReplacementWarnings([targetCharacter], [builtEffect.effect]).forEach((warning) =>
      this.addWarning(warning)
    );

    const sourceEffect = builtEffect.effect;
    const allyTargetIds = context.encounterParticipants
      .filter(
        (view) =>
          view.participant.characterId !== sourceEffect.casterCharacterId &&
          isFriendlyEncounterTarget(context.casterView!.participant, view) &&
          canEncounterTargetReceiveGroupBuff(view)
      )
      .map((view) => view.participant.characterId);
    const targetIds = Array.from(new Set([sourceEffect.casterCharacterId, ...allyTargetIds]));
    const updatedSourceEffect = {
      ...sourceEffect,
      sharedTargetCharacterIds: targetIds,
    };

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
          `${LIGHT_SUPPORT_AURA_SPELL_NAME}: ${context.casterName} affected ${joinTargetNames(
            context.finalTargets
          )}.`
        )
      ),
    ];
  }
}

class LessenDarknessSpellAction extends AuraSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    if (!selectedPower || !context.casterView) {
      throw new Error("Lessen Darkness requires an active Let There Be Light source.");
    }

    const sourceEffect =
      (context.casterCharacter.sheet.activePowerEffects ?? []).find(
        (effect) =>
          effect.powerId === "light_support" &&
          effect.targetCharacterId === context.casterCharacter.id &&
          isAuraSourceEffect(effect)
      ) ?? null;

    if (!sourceEffect || selectedPower.level < 5) {
      throw new Error("Lessen Darkness requires an active Let There Be Light source.");
    }

    this.setManaCost(0);
    this.setTargetCharacterIds([context.casterCharacter.id]);

    const enemyTargetIds = context.encounterParticipants
      .filter((view) => isEnemyEncounterTarget(context.casterView!.participant, view))
      .map((view) => view.participant.characterId);

    return [
      new AuraEffect(
        enemyTargetIds.map((targetId) =>
          buildLinkedAuraEffectForTarget(sourceEffect, targetId, {
            targetDisposition: "enemy",
          })
        )
      ),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${LIGHT_SUPPORT_DARKNESS_SPELL_NAME}: ${context.casterName} weakened ${enemyTargetIds.length} enemy target(s).`
        )
      ),
    ];
  }
}

class LuminousRestorationSpellAction extends RestorationSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    const targetCharacter = context.finalTargets[0];

    if (!selectedPower || !targetCharacter || selectedPower.level < 3) {
      throw new Error("Luminous Restoration is unavailable at this level.");
    }

    const multiplier =
      selectedPower.level >= 5 ? 3 : selectedPower.level >= 4 ? 2 : 1;
    const restoreAmount = Math.max(
      0,
      getCurrentStatValue(context.casterCharacter.sheet, "APP", context.itemsById) * multiplier
    );

    this.setManaCost(0);
    this.setTargetCharacterIds([targetCharacter.id]);

    return [
      new ManaEffect({
        characterId: targetCharacter.id,
        field: "currentMana",
        operation: "adjust",
        value: restoreAmount,
      }),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${LIGHT_SUPPORT_RESTORE_SPELL_NAME}: ${context.casterName} restored mana to ${
            targetCharacter.sheet.name.trim() || targetCharacter.id
          }.`
        )
      ),
    ];
  }
}

export const lightSupportModule: PowerModule = {
  powerId: "light_support",
  spellIds: ["let_there_be_light", "lessen_darkness", "luminous_restoration"],
  passiveProvider: new EmptyPassiveProvider(),
  createAction(context) {
    if (
      context.selectedSpellId === "luminous_restoration" ||
      context.selectedSpellId === "mana_restore"
    ) {
      return new LuminousRestorationSpellAction();
    }

    if (context.selectedSpellId === "lessen_darkness" || context.selectedSpellId === "expose_darkness") {
      return new LessenDarknessSpellAction();
    }

    if (
      context.selectedSpellId === "let_there_be_light" ||
      context.selectedSpellId === "default"
    ) {
      return new LetThereBeLightSpellAction();
    }

    return null;
  },
};
