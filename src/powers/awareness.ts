import { buildCharacterDerivedValues } from "../config/characterRuntime.ts";
import { getCrAndRankFromXpUsed } from "../rules/xpTables.ts";
import { KnowledgeSpellAction } from "../engine/actions.ts";
import { HistoryEffect } from "../engine/effects.ts";
import {
  buildAssessEntityHistoryEntry,
  buildEnvironmentLogEffects,
} from "./runtimeSupport.ts";
import { createEmptyPassiveProviderResult, createSkillSource } from "./passiveSupport.ts";
import { PowerPassiveProvider, type PowerModule } from "./types.ts";
import type { ActionContext } from "../engine/context.ts";

class AwarenessPassiveProvider extends PowerPassiveProvider {
  override getResult({ power }: Parameters<PowerPassiveProvider["getResult"]>[0]) {
    const result = createEmptyPassiveProviderResult();

    if (power.level > 0) {
      result.skillSources.push({
        skillId: "alertness",
        source: createSkillSource("Awareness", power.level),
      });
    }

    if (power.level >= 3) {
      result.utilityTraits.push("Techno-Invisibility Immunity");
    }

    return result;
  }
}

class AssessEntitySpellAction extends KnowledgeSpellAction {
  override resolve(context: ActionContext) {
    const targetCharacter = context.finalTargets[0];
    const selectedPower = context.selectedPower;

    if (!selectedPower || !targetCharacter) {
      throw new Error("Select one target for Assess Entity.");
    }

    const casterPerception = buildCharacterDerivedValues(
      context.casterCharacter.sheet,
      context.itemsById
    ).currentStats.PER;
    const crCaps = [0, 6, 9, 12, 15, 18];
    const allowedCr = Math.min(
      casterPerception + selectedPower.level,
      crCaps[selectedPower.level] ?? 18
    );
    const targetCr = getCrAndRankFromXpUsed(targetCharacter.sheet.xpUsed).cr;

    if (targetCr > allowedCr) {
      throw new Error(
        `Assess Entity limit is CR ${allowedCr}, but ${
          targetCharacter.sheet.name.trim() || targetCharacter.id
        } is CR ${targetCr}.`
      );
    }

    const now = new Date();

    this.setTargetCharacterIds([targetCharacter.id]);
    this.setManaCost(0);

    return [
      ...buildEnvironmentLogEffects(
        context,
        `Assess Entity: ${context.casterName} read ${
          targetCharacter.sheet.name.trim() || targetCharacter.id
        }.`
      ),
      new HistoryEffect({
        characterId: context.casterCharacter.id,
        entry: buildAssessEntityHistoryEntry(
          context.casterCharacter.sheet,
          targetCharacter,
          `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
          context.itemsById
        ),
      }),
    ];
  }
}

export const awarenessModule: PowerModule = {
  powerId: "awareness",
  spellIds: ["assess_entity"],
  passiveProvider: new AwarenessPassiveProvider(),
  createAction(context) {
    if (
      context.selectedSpellId === "assess_entity" ||
      context.selectedSpellId === "assess_character"
    ) {
      return new AssessEntitySpellAction();
    }

    return null;
  },
};
