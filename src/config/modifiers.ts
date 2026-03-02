import type {
  Character,
} from "../types/character.ts";
import type { ItemTemplate } from "../types/items.ts";
import type {
  CustomEffect,
  DerivedStatTarget,
  EffectDefinition,
  ModifierEffect,
  ResourceTarget,
} from "../types/effects.ts";
import {
  DERIVED_STAT_TARGETS,
  RESOURCE_TARGETS,
} from "../types/effects.ts";
import {
  CORE_STAT_IDS,
  SKILL_IDS,
  STAT_CATEGORY_CHILDREN,
  STAT_CATEGORY_IDS,
  type CoreStatId,
  type SkillId,
  type StatCategoryId,
} from "../types/game.ts";
import { getPassivePowerPackage } from "./powers.ts";

type NumericModifierBucket<T extends string> = Partial<Record<T, number>>;

export type CharacterModifierSummary = {
  coreStatBonuses: NumericModifierBucket<CoreStatId>;
  skillBonuses: NumericModifierBucket<SkillId>;
  derivedBonuses: NumericModifierBucket<DerivedStatTarget>;
  resourceBonuses: NumericModifierBucket<ResourceTarget>;
  tags: string[];
};

function createModifierSummary(): CharacterModifierSummary {
  return {
    coreStatBonuses: {},
    skillBonuses: {},
    derivedBonuses: {},
    resourceBonuses: {},
    tags: [],
  };
}

function isNumericValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function addNumericModifier<T extends string>(
  bucket: NumericModifierBucket<T>,
  key: T,
  value: number
): void {
  bucket[key] = (bucket[key] ?? 0) + value;
}

function isCoreStatId(value: string): value is CoreStatId {
  return CORE_STAT_IDS.includes(value as CoreStatId);
}

function isSkillId(value: string): value is SkillId {
  return SKILL_IDS.includes(value as SkillId);
}

function isDerivedStatTarget(value: string): value is DerivedStatTarget {
  return DERIVED_STAT_TARGETS.includes(value as DerivedStatTarget);
}

function isResourceTarget(value: string): value is ResourceTarget {
  return RESOURCE_TARGETS.includes(value as ResourceTarget);
}

function isStatCategoryId(value: string): value is StatCategoryId {
  return STAT_CATEGORY_IDS.includes(value as StatCategoryId);
}

function collectEquippedItemEffects(equippedTemplates: Array<ItemTemplate | null>): EffectDefinition[] {
  const effects: EffectDefinition[] = [];

  for (const template of equippedTemplates) {
    if (!template) {
      continue;
    }

    effects.push(...template.modifiers);
    effects.push(...template.effects.filter((effect) => effect.timing === "passive" || effect.timing === "on_equip"));
  }

  return effects;
}

function applyCustomEffect(summary: CharacterModifierSummary, effect: CustomEffect): void {
  if (!summary.tags.includes(effect.key)) {
    summary.tags.push(effect.key);
  }
}

function applyModifierEffect(summary: CharacterModifierSummary, effect: ModifierEffect): void {
  if (!isNumericValue(effect.value)) {
    return;
  }

  const attribute = effect.target.attribute;

  if (!attribute) {
    return;
  }

  if (isCoreStatId(attribute)) {
    addNumericModifier(summary.coreStatBonuses, attribute, effect.value);
    return;
  }

  if (isStatCategoryId(attribute)) {
    for (const statId of STAT_CATEGORY_CHILDREN[attribute]) {
      addNumericModifier(summary.coreStatBonuses, statId, effect.value);
    }
    return;
  }

  if (isSkillId(attribute)) {
    addNumericModifier(summary.skillBonuses, attribute, effect.value);
    return;
  }

  if (isDerivedStatTarget(attribute)) {
    addNumericModifier(summary.derivedBonuses, attribute, effect.value);
    return;
  }

  if (isResourceTarget(attribute)) {
    addNumericModifier(summary.resourceBonuses, attribute, effect.value);
  }
}

function collectActiveEffects(
  character: Character,
  equippedTemplates: Array<ItemTemplate | null>
): EffectDefinition[] {
  const passivePowerPackage = getPassivePowerPackage(character.knownPowers);
  const equippedEffects = collectEquippedItemEffects(equippedTemplates);
  const statusEffects = character.statusEffects.flatMap((statusEffect) => statusEffect.effects);

  return [...passivePowerPackage.effects, ...equippedEffects, ...statusEffects];
}

export function resolveCharacterModifiers(
  character: Character,
  equippedTemplates: Array<ItemTemplate | null> = []
): CharacterModifierSummary {
  const summary = createModifierSummary();
  const passivePowerPackage = getPassivePowerPackage(character.knownPowers);

  for (const tag of passivePowerPackage.tags) {
    if (!summary.tags.includes(tag)) {
      summary.tags.push(tag);
    }
  }

  for (const effect of collectActiveEffects(character, equippedTemplates)) {
    if (effect.kind === "modifier") {
      applyModifierEffect(summary, effect);
      continue;
    }

    if (effect.kind === "custom") {
      applyCustomEffect(summary, effect);
    }
  }

  return summary;
}

export function getEffectiveCoreStat(
  character: Character,
  summary: CharacterModifierSummary,
  statId: CoreStatId
): number {
  return character.coreStats[statId] + (summary.coreStatBonuses[statId] ?? 0);
}

export function getEffectiveSkillLevel(
  character: Character,
  summary: CharacterModifierSummary,
  skillId: SkillId
): number {
  return character.skillLevels[skillId] + (summary.skillBonuses[skillId] ?? 0);
}

export function getDerivedModifierBonus(
  summary: CharacterModifierSummary,
  target: DerivedStatTarget
): number {
  return summary.derivedBonuses[target] ?? 0;
}

export function hasModifierTag(summary: CharacterModifierSummary, tag: string): boolean {
  return summary.tags.includes(tag);
}
