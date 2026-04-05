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
import {
  ELEMENTALIST_BOLT_SPELL_NAME,
  ELEMENTALIST_CANTRIP_SPELL_NAME,
  ELEMENTALIST_SPLIT_SPELL_NAME,
} from "./spellLabels.ts";
import { PowerPassiveProvider, type PowerModule } from "./types.ts";

class EmptyPassiveProvider extends PowerPassiveProvider {
  override getResult() {
    return createEmptyPassiveProviderResult();
  }
}

abstract class BaseElementalistSpellAction extends AttackSpellAction {
  protected abstract readonly spellId:
    | "elemental_bolt"
    | "elemental_cantrip"
    | "elemental_split";

  protected abstract readonly spellLabel: string;

  protected allowDamageTypeLock(_context: ActionContext): boolean {
    return false;
  }

  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    if (!selectedPower) {
      throw new Error("Select at least one valid target before casting.");
    }

    if (this.allowDamageTypeLock(context) && selectedPower.level <= 2) {
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
      variantId: this.spellId,
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
      this.allowDamageTypeLock(context) &&
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
          `${this.spellLabel}: ${context.casterName} targeted ${joinTargetNames(
            context.finalTargets
          )}.`
        )
      ),
    ];
  }
}

class ElementalBoltSpellAction extends BaseElementalistSpellAction {
  protected readonly spellId = "elemental_bolt" as const;
  protected readonly spellLabel = ELEMENTALIST_BOLT_SPELL_NAME;

  protected override allowDamageTypeLock(): boolean {
    return true;
  }
}

class ElementalCantripSpellAction extends BaseElementalistSpellAction {
  protected readonly spellId = "elemental_cantrip" as const;
  protected readonly spellLabel = ELEMENTALIST_CANTRIP_SPELL_NAME;
}

class ElementalSplitSpellAction extends BaseElementalistSpellAction {
  protected readonly spellId = "elemental_split" as const;
  protected readonly spellLabel = ELEMENTALIST_SPLIT_SPELL_NAME;
}

export const elementalistModule: PowerModule = {
  powerId: "elementalist",
  spellIds: ["elemental_bolt", "elemental_cantrip", "elemental_split"],
  passiveProvider: new EmptyPassiveProvider(),
  createAction(context) {
    if (context.selectedSpellId === "elemental_bolt") {
      return new ElementalBoltSpellAction();
    }

    if (context.selectedSpellId === "elemental_cantrip") {
      return new ElementalCantripSpellAction();
    }

    if (context.selectedSpellId === "elemental_split") {
      return new ElementalSplitSpellAction();
    }

    return null;
  },
};
