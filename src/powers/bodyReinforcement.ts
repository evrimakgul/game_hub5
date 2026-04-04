import { BuffSpellAction, RestorationSpellAction } from "../engine/actions.ts";
import { BuffEffect, LogEffect, ResourceEffect, UsageCounterEffect } from "../engine/effects.ts";
import { createEmptyPassiveProviderResult } from "./passiveSupport.ts";
import { buildEncounterActivityLogEntry, getGenericBuffActionLabel, getReplacementWarnings, joinTargetNames } from "./runtimeSupport.ts";
import { PowerPassiveProvider, type PowerModule } from "./types.ts";
import type { ActionContext } from "../engine/context.ts";
import { buildActivePowerEffect } from "../rules/powerEffects.ts";
import { getBodyReinforcementReviveState } from "../lib/combatEncounterSpecialActions.ts";
import { POWER_USAGE_KEYS } from "../lib/powerUsage.ts";

class EmptyPassiveProvider extends PowerPassiveProvider {
  override getResult() {
    return createEmptyPassiveProviderResult();
  }
}

class BodyReinforcementSpellAction extends BuffSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    const targetCharacter = context.finalTargets[0];

    if (!selectedPower || !targetCharacter) {
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

    return [
      new BuffEffect(builtEffect.effect),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${getGenericBuffActionLabel(selectedPower.id, selectedPower.name)}: ${
            context.casterName
          } affected ${joinTargetNames([targetCharacter])}.`
        )
      ),
    ];
  }
}

export class BodyReinforcementReviveSpellAction extends RestorationSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower =
      context.selectedPower ??
      context.casterCharacter.sheet.powers.find((power) => power.id === "body_reinforcement") ??
      null;
    const reviveState = getBodyReinforcementReviveState(context.casterCharacter);

    if (!selectedPower) {
      throw new Error("Body Reinforcement is not available.");
    }

    if (!reviveState.isAvailable || !reviveState.isEligible) {
      throw new Error(reviveState.statusText);
    }

    this.setManaCost(0);
    this.setTargetCharacterIds([context.casterCharacter.id]);

    return [
      new ResourceEffect({
        characterId: context.casterCharacter.id,
        field: "currentHp",
        operation: "set",
        value: reviveState.reviveHp,
      }),
      new UsageCounterEffect({
        characterId: context.casterCharacter.id,
        operation: "increment",
        scope: "daily",
        key: POWER_USAGE_KEYS.bodyReinforcementRevive,
        targetCharacterId: null,
        amount: 1,
      }),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `Body Reinforcement revived ${
            context.casterCharacter.sheet.name.trim() || context.casterCharacter.id
          } to ${reviveState.reviveHp} HP.`
        )
      ),
    ];
  }
}

export const bodyReinforcementModule: PowerModule = {
  powerId: "body_reinforcement",
  spellIds: ["default"],
  passiveProvider: new EmptyPassiveProvider(),
  createAction(context) {
    if (context.selectedSpellId === "default") {
      return new BodyReinforcementSpellAction();
    }

    return null;
  },
};
