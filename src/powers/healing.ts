import { isUndeadSheet } from "../rules/combatResolution.ts";
import { getCurrentStatValue } from "../config/characterRuntime.ts";
import { POWER_USAGE_KEYS, getPerTargetDailyPowerUsageCount } from "../lib/powerUsage.ts";
import { buildGameHistoryNoteEntry } from "../lib/historyEntries.ts";
import { RestorationSpellAction } from "../engine/actions.ts";
import {
  DamageEffect,
  HealingEffect,
  HistoryEffect,
  LogEffect,
  StatusRemovalEffect,
  UsageCounterEffect,
} from "../engine/effects.ts";
import { buildHealingCastResolution } from "../rules/powerEffects.ts";
import type { ActionContext } from "../engine/context.ts";
import { createEmptyPassiveProviderResult } from "./passiveSupport.ts";
import {
  buildEncounterActivityLogEntry,
  buildStatusRemovalChanges,
  joinTargetNames,
} from "./runtimeSupport.ts";
import {
  HEALING_MAIN_SPELL_NAME,
  HEALING_PURGE_SPELL_NAME,
  HEALING_TOUCH_SPELL_NAME,
} from "./spellLabels.ts";
import { PowerPassiveProvider, type PowerModule } from "./types.ts";

class EmptyPassiveProvider extends PowerPassiveProvider {
  override getResult() {
    return createEmptyPassiveProviderResult();
  }
}

abstract class BaseHealingSpellAction extends RestorationSpellAction {
  protected abstract readonly spellId: "heal_living" | "holy_purge" | "healing_touch";
  protected abstract readonly spellLabel: string;

  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    if (!selectedPower) {
      throw new Error("Select at least one valid target before casting.");
    }

    const healingResolution = buildHealingCastResolution({
      casterSheet: context.casterCharacter.sheet,
      power: selectedPower,
      variantId: this.spellId,
      targetCharacterIds: context.finalTargets.map((targetCharacter) => targetCharacter.id),
      allocations: context.healingAllocations,
      itemsById: context.itemsById,
    });

    if ("error" in healingResolution) {
      throw new Error(healingResolution.error);
    }

    const perTargetDailyLimit = healingResolution.perTargetDailyLimit;

    if (
      perTargetDailyLimit !== null &&
      healingResolution.applications.some(
        (application) =>
          getPerTargetDailyPowerUsageCount(
            context.casterCharacter.sheet.powerUsageState,
            POWER_USAGE_KEYS.healingCantrip,
            application.targetCharacterId
          ) >= perTargetDailyLimit
      )
    ) {
      throw new Error("Healing cantrip uses for at least one target are already exhausted today.");
    }

    this.setManaCost(healingResolution.manaCost);
    this.setTargetCharacterIds(
      healingResolution.applications.map((application) => application.targetCharacterId)
    );

    const nonUndeadTargets = context.finalTargets.filter(
      (targetCharacter) => !isUndeadSheet(targetCharacter.sheet)
    );
    const healingChanges = healingResolution.applications.flatMap((application) => {
      const targetCharacter = context.finalTargets.find(
        (target) => target.id === application.targetCharacterId
      );

      if (!targetCharacter || isUndeadSheet(targetCharacter.sheet)) {
        return [];
      }

      if (!healingResolution.overhealCapStat) {
        return [application];
      }

      const alreadyUsed =
        getPerTargetDailyPowerUsageCount(
          context.casterCharacter.sheet.powerUsageState,
          POWER_USAGE_KEYS.healingOverheal,
          targetCharacter.id
        ) >= 1;

      return [
        {
          ...application,
          temporaryHpCap: !alreadyUsed
            ? getCurrentStatValue(
                targetCharacter.sheet,
                healingResolution.overhealCapStat,
                context.itemsById
              )
            : null,
        },
      ];
    });

    return [
      ...healingChanges.map((change) => new HealingEffect(change)),
      ...healingResolution.applications.flatMap((application) => {
        const targetCharacter = context.finalTargets.find(
          (target) => target.id === application.targetCharacterId
        );
        if (!targetCharacter || !isUndeadSheet(targetCharacter.sheet) || application.amount <= 0) {
          return [];
        }

        return [
          new DamageEffect({
            targetCharacterId: targetCharacter.id,
            rawAmount: application.amount,
            damageType: "radiant",
            mitigationChannel: "soak",
            sourceCharacterId: context.casterCharacter.id,
            sourceLabel: `${selectedPower.name} Lv ${selectedPower.level}`,
            sourceSummary: `Healing Reversal (${application.amount} radiant)`,
          }),
        ];
      }),
      ...(nonUndeadTargets.length > 0
        ? [
            new StatusRemovalEffect(
              nonUndeadTargets.flatMap((targetCharacter) =>
                buildStatusRemovalChanges(targetCharacter, healingResolution.removedStatuses)
              )
            ),
          ]
        : []),
      ...nonUndeadTargets.flatMap((targetCharacter) =>
        healingResolution.canRegrowLimbs
          ? [
              new HistoryEffect({
                characterId: targetCharacter.id,
                entry: buildGameHistoryNoteEntry(
                  "Regrowth-capable healing applied. Restore missing limbs if relevant.",
                  targetCharacter.sheet.gameDateTime
                ),
              }),
            ]
          : []
      ),
      ...healingResolution.applications.flatMap((application) =>
        perTargetDailyLimit !== null
          ? [
              new UsageCounterEffect({
                characterId: context.casterCharacter.id,
                operation: "increment",
                scope: "perTargetDaily",
                key: POWER_USAGE_KEYS.healingCantrip,
                targetCharacterId: application.targetCharacterId,
                amount: 1,
              }),
            ]
          : []
      ),
      ...healingChanges.flatMap((change) =>
        change.temporaryHpCap !== null
          ? [
              new UsageCounterEffect({
                characterId: context.casterCharacter.id,
                operation: "increment",
                scope: "perTargetDaily",
                key: POWER_USAGE_KEYS.healingOverheal,
                targetCharacterId: change.targetCharacterId,
                amount: 1,
              }),
            ]
          : []
      ),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${this.spellLabel}: ${context.casterName} affected ${joinTargetNames(
            context.finalTargets
          )}.`
        )
      ),
    ];
  }
}

class HealLivingSpellAction extends BaseHealingSpellAction {
  protected readonly spellId = "heal_living" as const;
  protected readonly spellLabel = HEALING_MAIN_SPELL_NAME;
}

class HolyPurgeSpellAction extends BaseHealingSpellAction {
  protected readonly spellId = "holy_purge" as const;
  protected readonly spellLabel = HEALING_PURGE_SPELL_NAME;
}

class HealingTouchSpellAction extends BaseHealingSpellAction {
  protected readonly spellId = "healing_touch" as const;
  protected readonly spellLabel = HEALING_TOUCH_SPELL_NAME;
}

export const healingModule: PowerModule = {
  powerId: "healing",
  spellIds: ["heal_living", "holy_purge", "healing_touch"],
  passiveProvider: new EmptyPassiveProvider(),
  createAction(context) {
    if (context.selectedSpellId === "heal_living") {
      return new HealLivingSpellAction();
    }

    if (context.selectedSpellId === "holy_purge") {
      return new HolyPurgeSpellAction();
    }

    if (context.selectedSpellId === "healing_touch") {
      return new HealingTouchSpellAction();
    }

    return null;
  },
};
