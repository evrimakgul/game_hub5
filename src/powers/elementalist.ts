import { POWER_USAGE_KEYS, getLongRestSelection } from "../lib/powerUsage.ts";
import { AttackSpellAction } from "../engine/actions.ts";
import { DamageEffect, HealingEffect, LogEffect, UsageCounterEffect } from "../engine/effects.ts";
import { buildDirectDamageCastResolution } from "../rules/powerEffects.ts";
import type { ActionContext } from "../engine/context.ts";
import { createEmptyPassiveProviderResult } from "./passiveSupport.ts";
import {
  blocksNecroticTouch,
  buildEncounterActivityLogEntry,
  isLivingEncounterTarget,
  isUndeadEncounterTarget,
  joinTargetNames,
} from "./runtimeSupport.ts";
import { PowerPassiveProvider, type PowerModule } from "./types.ts";

class EmptyPassiveProvider extends PowerPassiveProvider {
  override getResult() {
    return createEmptyPassiveProviderResult();
  }
}

class ElementalistSpellAction extends AttackSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    if (!selectedPower) {
      throw new Error("Select at least one valid target before casting.");
    }

    if (selectedPower.level <= 2) {
      const lockedDamageType = getLongRestSelection(
        context.casterCharacter.sheet.powerUsageState,
        POWER_USAGE_KEYS.elementalistLockedDamageType
      );

      if (lockedDamageType && context.selectedDamageType !== lockedDamageType) {
        throw new Error(`Elementalist is locked to ${lockedDamageType} until long rest.`);
      }
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

    const shouldLockDamageType =
      selectedPower.level <= 2 &&
      !getLongRestSelection(
        context.casterCharacter.sheet.powerUsageState,
        POWER_USAGE_KEYS.elementalistLockedDamageType
      ) &&
      context.selectedDamageType !== null;

    return [
      ...damageResolution.applications.map(
        (application) =>
          new DamageEffect({
            ...application,
            sourceCharacterId: context.casterCharacter.id,
          })
      ),
      ...(damageResolution.healingApplications ?? []).map(
        (application) =>
          new HealingEffect({
            targetCharacterId: application.targetCharacterId,
            amount: application.amount,
            temporaryHpCap: null,
          })
      ),
      ...(shouldLockDamageType
        ? [
            new UsageCounterEffect({
              characterId: context.casterCharacter.id,
              operation: "setSelection",
              key: POWER_USAGE_KEYS.elementalistLockedDamageType,
              value: context.selectedDamageType,
            }),
          ]
        : []),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${
            context.selectedSpellId === "elemental_cantrip"
              ? "Elemental Cantrip"
              : "Elemental Bolt"
          }: ${context.casterName} targeted ${joinTargetNames(context.finalTargets)}.`
        )
      ),
    ];
  }
}

export const elementalistModule: PowerModule = {
  powerId: "elementalist",
  spellIds: ["elemental_bolt", "elemental_cantrip"],
  passiveProvider: new EmptyPassiveProvider(),
  createAction(context) {
    if (
      context.selectedSpellId === "elemental_bolt" ||
      context.selectedSpellId === "elemental_cantrip"
    ) {
      return new ElementalistSpellAction();
    }

    return null;
  },
};
