import { getRuntimePowerLevelDefinition } from "../rules/powerData.ts";
import { createTimestampedId } from "../lib/ids.ts";
import { ControlSpellAction } from "../engine/actions.ts";
import {
  LogEffect,
  OngoingStateEffect,
  StatusEffect,
  StatusRemovalEffect,
} from "../engine/effects.ts";
import {
  buildEncounterActivityLogEntry,
  isControlledByCaster,
  normalizeStatusTagText,
  resolveCrowdControlContest,
} from "./runtimeSupport.ts";
import { createEmptyPassiveProviderResult, createSkillSource, getUnlockedCantripMechanics } from "./passiveSupport.ts";
import { PowerPassiveProvider, type PowerModule } from "./types.ts";
import type { ActionContext } from "../engine/context.ts";

class CrowdControlPassiveProvider extends PowerPassiveProvider {
  override getResult({ power }: Parameters<PowerPassiveProvider["getResult"]>[0]) {
    const result = createEmptyPassiveProviderResult();
    const mechanics = getUnlockedCantripMechanics(power);

    if (!mechanics) {
      return result;
    }

    const bonusBySkillId: Record<string, string> = {
      social: "social_skill_bonus",
      intimidation: "intimidation_skill_bonus",
      mechanics: "mechanics_skill_bonus",
      technology: "technology_skill_bonus",
    };

    Object.entries(bonusBySkillId).forEach(([skillId, key]) => {
      const bonus = mechanics[key];
      if (typeof bonus === "number" && Number.isFinite(bonus) && bonus > 0) {
        result.skillSources.push({
          skillId,
          source: createSkillSource("Crowd Control", bonus),
        });
      }
    });

    return result;
  }
}

class ReleaseControlSpellAction extends ControlSpellAction {
  override resolve(context: ActionContext) {
    const finalTargets = context.finalTargets;

    this.setManaCost(0);
    this.setTargetCharacterIds(finalTargets.map((target) => target.id));

    return [
      new StatusRemovalEffect(
        finalTargets.flatMap((targetCharacter) => [
          {
            characterId: targetCharacter.id,
            operation: "remove" as const,
            tag: {
              id: "paralyzed",
              label: "Paralyzed",
            },
          },
          {
            characterId: targetCharacter.id,
            operation: "remove" as const,
            tag: {
              id: `crowd_control:${context.casterCharacter.id}`,
              label: `Controlled by ${context.casterName}`,
            },
          },
        ])
      ),
      new OngoingStateEffect(
        finalTargets.map((targetCharacter) => ({
          operation: "releaseCrowdControl" as const,
          casterCharacterId: context.casterCharacter.id,
          targetCharacterId: targetCharacter.id,
        }))
      ),
      new LogEffect(
        buildEncounterActivityLogEntry(
          `Crowd Control released on ${finalTargets
            .map((target) => target.sheet.name.trim() || target.id)
            .join(", ")}.`
        )
      ),
    ];
  }
}

class ControlTargetSpellAction extends ControlSpellAction {
  override resolve(context: ActionContext) {
    const selectedPower = context.selectedPower;
    if (!selectedPower) {
      throw new Error("Select at least one valid target before casting.");
    }

    const runtimeLevel = getRuntimePowerLevelDefinition(selectedPower.id, selectedPower.level);
    const mechanics = runtimeLevel?.mechanics ?? {};
    const allowedTargetTypes = Array.isArray(mechanics.allowed_target_types)
      ? mechanics.allowed_target_types.filter((value): value is string => typeof value === "string")
      : ["living"];
    const maxControlledTargets = Math.max(
      1,
      Math.trunc(Number(mechanics.max_controlled_targets ?? 1))
    );
    const currentlyControlledTargetIds = new Set(
      context.encounterParticipants.flatMap((view) =>
        isControlledByCaster(view, context.casterCharacter.id) ? [view.participant.characterId] : []
      )
    );
    const invalidTargets = context.finalTargetViews.filter((targetView) => {
      const isLiving =
        targetView.transientCombatant === null &&
        !targetView.character?.sheet.statusTags.some((tag) =>
          ["undead", "shadow", "incorporeal", "construct", "non_living"].includes(
            normalizeStatusTagText(tag.id)
          ) ||
          ["undead", "shadow", "incorporeal", "construct", "non_living"].includes(
            normalizeStatusTagText(tag.label)
          )
        );

      if (isLiving) {
        return !allowedTargetTypes.includes("living");
      }

      if (targetView.transientCombatant) {
        return true;
      }

      return !allowedTargetTypes.includes("non_living_except_other_occult_summons");
    });

    if (invalidTargets.length > 0) {
      throw new Error(
        selectedPower.level >= 5
          ? "At least one target is an unsupported summon for Crowd Control."
          : "Crowd Control can only target living creatures at this level."
      );
    }

    const newControlledTargetCount = context.finalTargets.filter(
      (targetCharacter) => !currentlyControlledTargetIds.has(targetCharacter.id)
    ).length;
    if (currentlyControlledTargetIds.size + newControlledTargetCount > maxControlledTargets) {
      throw new Error(
        `Crowd Control can maintain at most ${maxControlledTargets} controlled target(s) at this level.`
      );
    }

    if (
      context.finalTargets.some((targetCharacter) =>
        targetCharacter.sheet.statusTags.some(
          (tag) => normalizeStatusTagText(tag.id) === "crowd_control_immunity"
        )
      )
    ) {
      throw new Error("At least one target is currently immune to Crowd Control.");
    }

    const contestResults = context.finalTargets.map((targetCharacter) =>
      resolveCrowdControlContest(context.casterCharacter, targetCharacter, context.itemsById)
    );
    const successfulTargets = contestResults
      .filter((result) => result.didSucceed)
      .map((result) => result.targetCharacter);

    this.setManaCost(0);
    this.setTargetCharacterIds(context.finalTargets.map((target) => target.id));

    return [
      ...successfulTargets.flatMap((targetCharacter) => [
        new StatusEffect({
          characterId: targetCharacter.id,
          operation: "add" as const,
          tag: {
            id: "paralyzed",
            label: "Paralyzed",
          },
        }),
        new StatusEffect({
          characterId: targetCharacter.id,
          operation: "add" as const,
          tag: {
            id: `crowd_control:${context.casterCharacter.id}`,
            label: `Controlled by ${context.casterName}`,
          },
        }),
      ]),
      new OngoingStateEffect(
        successfulTargets.map((targetCharacter) => ({
          operation: "add" as const,
          state: {
            id: createTimestampedId("crowd-control"),
            kind: "crowd_control" as const,
            casterCharacterId: context.casterCharacter.id,
            targetCharacterId: targetCharacter.id,
            powerLevel: selectedPower.level,
            maintenanceManaCost:
              typeof mechanics.maintenance_mana_cost_per_target_per_turn === "number"
                ? mechanics.maintenance_mana_cost_per_target_per_turn
                : typeof mechanics.maintenance_mana_cost_per_turn === "number"
                  ? mechanics.maintenance_mana_cost_per_turn
                  : 1,
            breaksOnDamageFromCaster: mechanics.breaks_on_damage_from_caster !== false,
            breaksOnDamageFromOthers: mechanics.breaks_on_damage_from_others !== false,
            commandActionType:
              mechanics.command_action_type === "bonus" || mechanics.command_action_type === "free"
                ? mechanics.command_action_type
                : null,
            summaryNote: null,
          },
        }))
      ),
      ...contestResults.map((result) =>
        new LogEffect(
          buildEncounterActivityLogEntry(
            `Crowd Control: ${context.casterName} ${result.casterSuccesses} vs ${
              result.targetCharacter.sheet.name.trim() || result.targetCharacter.id
            } ${result.targetSuccesses} (${result.didSucceed ? "success" : "failure"}).`
          )
        )
      ),
    ];
  }
}

export const crowdControlModule: PowerModule = {
  powerId: "crowd_control",
  spellIds: ["crowd_control", "release_control"],
  passiveProvider: new CrowdControlPassiveProvider(),
  createAction(context) {
    if (context.selectedSpellId === "release_control") {
      return new ReleaseControlSpellAction();
    }

    if (context.selectedSpellId === "crowd_control") {
      return new ControlTargetSpellAction();
    }

    return null;
  },
};
