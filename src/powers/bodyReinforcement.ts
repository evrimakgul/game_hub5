import { BuffSpellAction } from "../engine/actions.ts";
import { BuffEffect } from "../engine/effects.ts";
import { createEmptyPassiveProviderResult } from "./passiveSupport.ts";
import {
  buildEnvironmentLogEffects,
  getGenericBuffActionLabel,
  getReplacementWarnings,
  joinTargetNames,
} from "./runtimeSupport.ts";
import { PowerPassiveProvider, type PowerModule } from "./types.ts";
import type { ActionContext } from "../engine/context.ts";
import { buildActivePowerEffect } from "../rules/powerEffects.ts";

class EmptyPassiveProvider extends PowerPassiveProvider {
  override getResult() {
    return createEmptyPassiveProviderResult();
  }
}

class BoostPhysiqueSpellAction extends BuffSpellAction {
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
      ...buildEnvironmentLogEffects(
        context,
        `${getGenericBuffActionLabel(selectedPower.id, selectedPower.name)}: ${
          context.casterName
        } affected ${joinTargetNames([targetCharacter])}.`
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
      return new BoostPhysiqueSpellAction();
    }

    return null;
  },
};
