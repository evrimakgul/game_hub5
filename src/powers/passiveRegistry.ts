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
    const result = createEmptyPassiveProviderResult();
    result.skillSources.push({
      skillId: "social",
      source: createSkillSource("Crowd Management", context.power.level),
    });

    if (context.power.level >= 5) {
      result.utilityTraits.push("Compulsion Guard");
    }

    return result;
  }
}

class LightSupportPassiveProvider extends BaseCantripPassiveProvider {
  override getResult(context: Parameters<PowerPassiveProvider["getResult"]>[0]) {
    const result = createEmptyPassiveProviderResult();
    result.manaBonus = context.power.level;

    const nightvisionTargetsByLevel: Record<number, string> = {
      1: "Nightvision: Self",
      2: "Nightvision: Self + 1",
      3: "Nightvision: Self + 3",
      4: "Nightvision: Self + 3",
      5: "Nightvision: Self + 4",
    };
    result.utilityTraits.push(
      nightvisionTargetsByLevel[context.power.level] ?? "Nightvision: Self"
    );

    return result;
  }
}

class NecromancyPassiveProvider extends BaseCantripPassiveProvider {
  override getResult(context: Parameters<PowerPassiveProvider["getResult"]>[0]) {
    const result = createEmptyPassiveProviderResult();
    const meleeBonus =
      context.power.level >= 5
        ? 3
        : context.power.level >= 3
          ? 2
          : context.power.level >= 1
            ? 1
            : 0;

    if (meleeBonus > 0) {
      result.skillSources.push({
        skillId: "melee",
        source: createSkillSource("Necromancer's Deception", meleeBonus),
      });
    }

    if (context.power.level >= 4) {
      result.utilityTraits.push("Hostile Undead Ignore Unless Attacked");
    } else if (context.power.level >= 2) {
      result.utilityTraits.push("Hostile Undead Aggro Last");
    }

    return result;
  }
}

class ShadowControlPassiveProvider extends BaseCantripPassiveProvider {
  override getResult(context: Parameters<PowerPassiveProvider["getResult"]>[0]) {
    const result = createEmptyPassiveProviderResult();

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
