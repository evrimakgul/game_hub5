import type { CharacterDraft, StatSource } from "../config/characterTemplate.ts";
import type { SharedItemRecord } from "../types/items.ts";
import {
  createEmptyPassiveProviderResult,
  createSkillSource,
  getUnlockedCantripMechanics,
} from "./passiveSupport.ts";
import { PowerPassiveProvider } from "./types.ts";

class BaseCantripPassiveProvider extends PowerPassiveProvider {
  override getResult(context: Parameters<PowerPassiveProvider["getResult"]>[0]) {
    const result = createEmptyPassiveProviderResult();
    const mechanics = getUnlockedCantripMechanics(context.power);
    const manaBonus = mechanics?.mana_bonus;

    if (typeof manaBonus === "number" && Number.isFinite(manaBonus) && manaBonus > 0) {
      result.manaBonus = Math.trunc(manaBonus);
    }

    return result;
  }
}

class AwarenessPassiveProvider extends BaseCantripPassiveProvider {
  override getResult(context: Parameters<PowerPassiveProvider["getResult"]>[0]) {
    const result = super.getResult(context);

    if (context.power.level > 0) {
      result.skillSources.push({
        skillId: "alertness",
        source: createSkillSource("Awareness", context.power.level),
      });
    }

    if (context.power.level >= 3) {
      result.utilityTraits.push("Techno-Invisibility Immunity");
    }

    return result;
  }
}

class CrowdControlPassiveProvider extends BaseCantripPassiveProvider {
  override getResult(context: Parameters<PowerPassiveProvider["getResult"]>[0]) {
    const result = super.getResult(context);
    const mechanics = getUnlockedCantripMechanics(context.power);

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

class LightSupportPassiveProvider extends BaseCantripPassiveProvider {
  override getResult(context: Parameters<PowerPassiveProvider["getResult"]>[0]) {
    const result = super.getResult(context);
    const mechanics = getUnlockedCantripMechanics(context.power);

    if (mechanics?.nightvision === true) {
      result.utilityTraits.push("Nightvision");
    }

    return result;
  }
}

class NecromancyPassiveProvider extends BaseCantripPassiveProvider {
  override getResult(context: Parameters<PowerPassiveProvider["getResult"]>[0]) {
    const result = super.getResult(context);
    const mechanics = getUnlockedCantripMechanics(context.power);
    const meleeBonus = mechanics?.melee_skill_bonus;

    if (typeof meleeBonus === "number" && Number.isFinite(meleeBonus) && meleeBonus > 0) {
      result.skillSources.push({
        skillId: "melee",
        source: createSkillSource("Necromancy", meleeBonus),
      });
    }

    if (typeof mechanics?.hostile_undead_aggro_priority === "string") {
      result.utilityTraits.push(
        mechanics.hostile_undead_aggro_priority === "ignore_unless_attacked"
          ? "Hostile Undead Ignore Unless Attacked"
          : "Hostile Undead Aggro Last"
      );
    }

    return result;
  }
}

class ShadowControlPassiveProvider extends BaseCantripPassiveProvider {
  override getResult(context: Parameters<PowerPassiveProvider["getResult"]>[0]) {
    const result = super.getResult(context);

    if (context.power.level >= 2) {
      result.utilityTraits.push(`Shadow Walk ${25 * context.power.level}m`);
    }

    if (context.power.level >= 3) {
      result.utilityTraits.push("Cosmetic Clothing / Armor Shift");
    }

    if (context.power.level >= 5) {
      result.utilityTraits.push("Minor Body Cosmetics");
    }

    return result;
  }
}

const defaultPassiveProvider = new BaseCantripPassiveProvider();
const passiveProvidersByPowerId: Record<string, PowerPassiveProvider> = {
  awareness: new AwarenessPassiveProvider(),
  body_reinforcement: defaultPassiveProvider,
  crowd_control: new CrowdControlPassiveProvider(),
  elementalist: defaultPassiveProvider,
  healing: defaultPassiveProvider,
  light_support: new LightSupportPassiveProvider(),
  necromancy: new NecromancyPassiveProvider(),
  shadow_control: new ShadowControlPassiveProvider(),
};

function getPassiveProvider(powerId: string): PowerPassiveProvider {
  return passiveProvidersByPowerId[powerId] ?? defaultPassiveProvider;
}

export function getPassiveSkillSources(
  sheet: CharacterDraft,
  skillId: string,
  itemsById: Record<string, SharedItemRecord> = {}
): StatSource[] {
  return sheet.powers.flatMap((power) =>
    getPassiveProvider(power.id)
      .getResult({ sheet, power, itemsById })
      .skillSources.filter((entry) => entry.skillId === skillId)
      .map((entry) => entry.source)
  );
}

export function getPassiveUtilityTraits(
  sheet: CharacterDraft,
  itemsById: Record<string, SharedItemRecord> = {}
): string[] {
  return sheet.powers.flatMap((power) =>
    getPassiveProvider(power.id).getResult({ sheet, power, itemsById }).utilityTraits
  );
}

export function getPassiveManaBonus(
  sheet: CharacterDraft,
  itemsById: Record<string, SharedItemRecord> = {}
): number {
  return sheet.powers.reduce(
    (total, power) =>
      total + getPassiveProvider(power.id).getResult({ sheet, power, itemsById }).manaBonus,
    0
  );
}
