import { getRuntimePowerLevelDefinition } from "../rules/powerData.ts";
import { buildDirectDamageCastResolution } from "../rules/powerEffects.ts";
import { buildSummonCastResolution } from "../rules/summons.ts";
import {
  AttackSpellAction,
  RestorationSpellAction,
  SummonSpellAction,
} from "../engine/actions.ts";
import {
  AuraEffect,
  DamageEffect,
  HealingEffect,
  LogEffect,
  ResourceEffect,
  StatusRemovalEffect,
  SummonEffect,
} from "../engine/effects.ts";
import type { ActionContext } from "../engine/context.ts";
import { createEmptyPassiveProviderResult } from "./passiveSupport.ts";
import {
  blocksNecroticTouch,
  buildEncounterActivityLogEntry,
  buildInheritedAuraEffectsForSummons,
  buildStatusRemovalChanges,
  isLivingEncounterTarget,
  isUndeadEncounterTarget,
  joinTargetNames,
} from "./runtimeSupport.ts";
import {
  NECROMANCY_BLESS_SPELL_NAME,
  NECROMANCY_SKELETON_KING_SPELL_NAME,
  NECROMANCY_SKELETON_SPELL_NAME,
  NECROMANCY_TOUCH_SPELL_NAME,
  NECROMANCY_ZOMBIE_SPELL_NAME,
} from "./spellLabels.ts";
import { PowerPassiveProvider, type PowerModule } from "./types.ts";

class EmptyPassiveProvider extends PowerPassiveProvider {
  override getResult() {
    return createEmptyPassiveProviderResult();
  }
}

class NecroticTouchSpellAction extends AttackSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    if (!selectedPower) {
      throw new Error("Select at least one valid target before casting.");
    }

    if (context.attackOutcome === "unresolved") {
      throw new Error("Resolve the touch attack outcome first.");
    }

    if (context.attackOutcome === "miss") {
      const runtimeLevel = getRuntimePowerLevelDefinition(selectedPower.id, selectedPower.level);
      const necroticTouch =
        runtimeLevel?.mechanics?.necrotic_touch &&
        typeof runtimeLevel.mechanics.necrotic_touch === "object"
          ? (runtimeLevel.mechanics.necrotic_touch as Record<string, unknown>)
          : null;

      this.setManaCost(
        typeof necroticTouch?.mana_cost === "number"
          ? necroticTouch.mana_cost
          : runtimeLevel?.mana_cost ?? 0
      );
      this.setTargetCharacterIds(context.finalTargets.map((target) => target.id));

      return [
        new LogEffect(
          buildEncounterActivityLogEntry(
            `${NECROMANCY_TOUCH_SPELL_NAME} missed ${joinTargetNames(context.finalTargets)}.`
          )
        ),
      ];
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
      new HealingEffect({
        targetCharacterId: context.casterCharacter.id,
        amount: selectedPower.level,
        temporaryHpCap: null,
      }),
      ...(damageResolution.healingApplications ?? []).map(
        (application) =>
          new HealingEffect({
            targetCharacterId: application.targetCharacterId,
            amount: application.amount,
            temporaryHpCap: null,
          })
      ),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${NECROMANCY_TOUCH_SPELL_NAME}: ${context.casterName} targeted ${joinTargetNames(
            context.finalTargets
          )}.`
        )
      ),
    ];
  }
}

abstract class BaseNecromancySummonSpellAction extends SummonSpellAction {
  protected abstract readonly summonVariantId:
    | "non_living_skeleton"
    | "non_living_skeleton_king"
    | "non_living_zombie";

  protected abstract readonly spellLabel: string;

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
            entry.sourcePowerId === selectedPower.id
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
      selectedSummonOptionId: context.selectedSummonOptionId ?? `${this.summonVariantId}:1:0`,
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
          `${this.spellLabel}: ${context.casterName} created ${summonResolution.summons
            .map((summon) => summon.sheet.name.trim() || summon.id)
            .join(", ")}.`
        )
      ),
    ];
  }
}

class NonLivingSkeletonSpellAction extends BaseNecromancySummonSpellAction {
  protected readonly summonVariantId = "non_living_skeleton" as const;
  protected readonly spellLabel = NECROMANCY_SKELETON_SPELL_NAME;
}

class NonLivingSkeletonKingSpellAction extends BaseNecromancySummonSpellAction {
  protected readonly summonVariantId = "non_living_skeleton_king" as const;
  protected readonly spellLabel = NECROMANCY_SKELETON_KING_SPELL_NAME;
}

class NonLivingZombieSpellAction extends BaseNecromancySummonSpellAction {
  protected readonly summonVariantId = "non_living_zombie" as const;
  protected readonly spellLabel = NECROMANCY_ZOMBIE_SPELL_NAME;
}

class NecromancersBlessSpellAction extends RestorationSpellAction {
  override resolve(context: ActionContext) {
    const targetView = context.finalTargetViews[0];
    const targetCharacter = context.finalTargets[0];

    if (!targetView || !targetCharacter) {
      throw new Error("Select one valid resurrection target.");
    }

    if (targetView.transientCombatant) {
      throw new Error("Resurrection only works on loaded character sheets.");
    }

    this.setManaCost(6);
    this.setTargetCharacterIds([targetCharacter.id]);

    return [
      new ResourceEffect({
        characterId: targetCharacter.id,
        field: "currentHp",
        operation: "set",
        value: 1,
      }),
      new StatusRemovalEffect(
        buildStatusRemovalChanges(targetCharacter, ["bleeding", "dead", "dying", "unconscious"])
      ),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `${NECROMANCY_BLESS_SPELL_NAME}: ${context.casterName} restored ${
            targetCharacter.sheet.name.trim() || targetCharacter.id
          }.`
        )
      ),
    ];
  }
}

export const necromancyModule: PowerModule = {
  powerId: "necromancy",
  spellIds: [
    "non_living_skeleton",
    "non_living_skeleton_king",
    "non_living_zombie",
    "necrotic_touch",
    "necromancers_bless",
  ],
  passiveProvider: new EmptyPassiveProvider(),
  createAction(context) {
    if (context.selectedSpellId === "necrotic_touch") {
      return new NecroticTouchSpellAction();
    }

    if (context.selectedSpellId === "non_living_skeleton") {
      return new NonLivingSkeletonSpellAction();
    }

    if (context.selectedSpellId === "non_living_skeleton_king") {
      return new NonLivingSkeletonKingSpellAction();
    }

    if (context.selectedSpellId === "non_living_zombie") {
      return new NonLivingZombieSpellAction();
    }

    if (context.selectedSpellId === "dismiss_summon") {
      return new NonLivingSkeletonSpellAction();
    }

    if (
      context.selectedSpellId === "necromancers_bless" ||
      context.selectedSpellId === "resurrection"
    ) {
      return new NecromancersBlessSpellAction();
    }

    return null;
  },
};
