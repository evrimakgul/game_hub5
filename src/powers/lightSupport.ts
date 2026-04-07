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
  getGenericBuffActionLabel,
  getReplacementWarnings,
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
    if (!selectedPower || !context.casterView) {
      throw new Error("Select at least one valid target before casting.");
    }

    const builtEffect = buildActivePowerEffect({
      casterCharacterId: context.casterCharacter.id,
      casterName: context.casterName,
      targetCharacterId: context.casterCharacter.id,
      targetName: context.casterCharacter.sheet.name.trim() || context.casterCharacter.id,
      power: selectedPower,
      variantId: "let_there_be_light",
      selectedStatId: context.selectedStatId,
      castMode: "aura",
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
    const allyTargetIds = selectedTargetIds.filter(
      (targetId) => targetId !== sourceEffect.casterCharacterId
    );
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
          `${LIGHT_SUPPORT_AURA_SPELL_NAME}: ${context.casterName} affected ${
            joinTargetNames(context.finalTargets) || context.casterName
          }.`
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

    const selectedTargetIds = Array.from(
      new Set(context.finalTargetViews.map((view) => view.participant.characterId))
    ).filter((targetId) => targetId !== context.casterCharacter.id);
    if (selectedTargetIds.length === 0) {
      throw new Error("Select at least one target for Lessen Darkness.");
    }

    this.setManaCost(0);
    this.setTargetCharacterIds(selectedTargetIds);

    const existingTargetIds = sourceEffect.sharedTargetCharacterIds ?? [sourceEffect.casterCharacterId];
    const updatedSourceEffect = {
      ...sourceEffect,
      sharedTargetCharacterIds: Array.from(
        new Set([sourceEffect.casterCharacterId, ...existingTargetIds, ...selectedTargetIds])
      ),
    };
    const selectedTargetSet = new Set(selectedTargetIds);

    return [
      new AuraEffect([
        updatedSourceEffect,
        ...updatedSourceEffect.sharedTargetCharacterIds
          .filter((targetId) => targetId !== updatedSourceEffect.casterCharacterId)
          .map((targetId) =>
            buildLinkedAuraEffectForTarget(updatedSourceEffect, targetId, {
              targetDisposition: selectedTargetSet.has(targetId) ? "enemy" : "ally",
            })
          ),
      ]),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${LIGHT_SUPPORT_DARKNESS_SPELL_NAME}: ${context.casterName} weakened ${selectedTargetIds.length} target(s).`
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
