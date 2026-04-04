import { getRuntimePowerLevelDefinition } from "../rules/powerData.ts";
import { buildActivePowerEffect, buildLinkedAuraEffectForTarget } from "../rules/powerEffects.ts";
import { getCurrentStatValue } from "../config/characterRuntime.ts";
import { POWER_USAGE_KEYS, getPowerUsageCount } from "../lib/powerUsage.ts";
import { AuraSpellAction, RestorationSpellAction } from "../engine/actions.ts";
import { AuraEffect, LogEffect, ManaEffect, UsageCounterEffect } from "../engine/effects.ts";
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
import { PowerPassiveProvider, type PowerModule } from "./types.ts";

class EmptyPassiveProvider extends PowerPassiveProvider {
  override getResult() {
    return createEmptyPassiveProviderResult();
  }
}

class LightAuraSpellAction extends AuraSpellAction {
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
      variantId: context.selectedSpellId,
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
    const enemyTargetIds =
      sourceEffect.sourceLevel >= 5
        ? context.encounterParticipants
            .filter((view) => isEnemyEncounterTarget(context.casterView!.participant, view))
            .map((view) => view.participant.characterId)
        : [];
    const targetIds = Array.from(
      new Set([sourceEffect.casterCharacterId, ...allyTargetIds, ...enemyTargetIds])
    );
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
        ...enemyTargetIds.map((targetId) =>
          buildLinkedAuraEffectForTarget(updatedSourceEffect, targetId, {
            targetDisposition: "enemy",
          })
        ),
      ]),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${getGenericBuffActionLabel(selectedPower.id, selectedPower.name)}: ${
            context.casterName
          } affected ${joinTargetNames(context.finalTargets)}.`
        )
      ),
    ];
  }
}

class ManaRestoreSpellAction extends RestorationSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    const targetCharacter = context.finalTargets[0];
    const runtimeLevel = selectedPower
      ? getRuntimePowerLevelDefinition(selectedPower.id, selectedPower.level)
      : null;
    const manaRestore =
      runtimeLevel?.mechanics?.mana_restore &&
      typeof runtimeLevel.mechanics.mana_restore === "object"
        ? (runtimeLevel.mechanics.mana_restore as Record<string, unknown>)
        : null;

    if (!selectedPower || !targetCharacter || !runtimeLevel || !manaRestore) {
      throw new Error("Mana Restore data is missing for this Light Support level.");
    }

    if (
      getPowerUsageCount(
        context.casterCharacter.sheet.powerUsageState,
        "longRest",
        POWER_USAGE_KEYS.lightSupportManaRestore
      ) >= 1
    ) {
      throw new Error("Light Support mana restore is already spent for this long rest.");
    }

    const restoreAmount = Math.max(
      0,
      getCurrentStatValue(context.casterCharacter.sheet, "APP", context.itemsById) *
        Math.max(
          1,
          Math.trunc(
            Number((manaRestore.max_amount_formula as { multiplier?: number })?.multiplier ?? 1)
          )
        )
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
      new UsageCounterEffect({
        characterId: context.casterCharacter.id,
        operation: "increment",
        scope: "longRest",
        key: POWER_USAGE_KEYS.lightSupportManaRestore,
        targetCharacterId: null,
        amount: 1,
      }),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `Mana Restore: ${context.casterName} restored mana to ${
            targetCharacter.sheet.name.trim() || targetCharacter.id
          }.`
        )
      ),
    ];
  }
}

export const lightSupportModule: PowerModule = {
  powerId: "light_support",
  spellIds: ["default", "mana_restore"],
  passiveProvider: new EmptyPassiveProvider(),
  createAction(context) {
    if (context.selectedSpellId === "mana_restore") {
      return new ManaRestoreSpellAction();
    }

    if (context.selectedSpellId === "default") {
      return new LightAuraSpellAction();
    }

    return null;
  },
};
