import type { CharacterDraft } from "../config/characterTemplate.ts";
import { createTimestampedId } from "./ids.ts";
import type { DamageTypeId } from "../rules/resistances";
import type { StatId } from "../types/character.ts";
import type {
  BonusProfile,
  CharacterEquipmentReference,
  ItemBlueprintId,
  ItemCategory,
  ItemModifierSource,
  ItemSubtype,
  SharedItemRecord,
} from "../types/items.ts";

type ItemProfile = BonusProfile;

type ItemBlueprintDefinition = {
  id: ItemBlueprintId;
  category: ItemCategory;
  subtype: ItemSubtype;
  label: string;
  defaultName: string;
  baseVisibleStats: string[];
  baseProfile: ItemProfile;
};

function createEmptyProfile(): ItemProfile {
  return {
    statBonuses: {},
    skillBonuses: {},
    derivedBonuses: {},
    resistanceBonuses: {},
    utilityTraits: [],
    notes: [],
    powerBonuses: {},
  };
}

function cloneProfile(profile: ItemProfile): ItemProfile {
  return {
    statBonuses: { ...profile.statBonuses },
    skillBonuses: { ...profile.skillBonuses },
    derivedBonuses: { ...profile.derivedBonuses },
    resistanceBonuses: { ...profile.resistanceBonuses },
    utilityTraits: [...profile.utilityTraits],
    notes: [...profile.notes],
    powerBonuses: { ...profile.powerBonuses },
  };
}

function mergeProfiles(base: ItemProfile, extra: ItemProfile): ItemProfile {
  return {
    statBonuses: { ...base.statBonuses, ...extra.statBonuses },
    skillBonuses: { ...base.skillBonuses, ...extra.skillBonuses },
    derivedBonuses: { ...base.derivedBonuses, ...extra.derivedBonuses },
    resistanceBonuses: { ...base.resistanceBonuses, ...extra.resistanceBonuses },
    utilityTraits: [...base.utilityTraits, ...extra.utilityTraits],
    notes: [...base.notes, ...extra.notes],
    powerBonuses: { ...base.powerBonuses, ...extra.powerBonuses },
  };
}

abstract class Item {
  abstract readonly blueprint: ItemBlueprintDefinition;

  createRecord(
    overrides: Partial<
      Pick<
        SharedItemRecord,
        "id" | "name" | "itemLevel" | "qualityTier" | "baseDescription" | "bonusProfile" | "knowledge"
      >
    > = {}
  ): SharedItemRecord {
    return {
      id: overrides.id ?? createTimestampedId("item"),
      name: overrides.name?.trim() || this.blueprint.defaultName,
      itemLevel: Math.max(1, Math.trunc(overrides.itemLevel ?? 1)),
      qualityTier: overrides.qualityTier ?? null,
      category: this.blueprint.category,
      subtype: this.blueprint.subtype,
      baseDescription: overrides.baseDescription?.trim() ?? "",
      bonusProfile: normalizeBonusProfile(overrides.bonusProfile),
      knowledge: normalizeItemKnowledgeState(overrides.knowledge),
    };
  }

  getBaseVisibleStats(item: SharedItemRecord): string[] {
    return item.baseDescription.trim()
      ? [...this.blueprint.baseVisibleStats, item.baseDescription.trim()]
      : [...this.blueprint.baseVisibleStats];
  }

  getBaseProfile(): ItemProfile {
    return cloneProfile(this.blueprint.baseProfile);
  }
}

abstract class Weapon extends Item {}
abstract class Armor extends Item {}
abstract class Jewel extends Item {}
abstract class Mystic extends Item {}

class BrawlWeapon extends Weapon {
  readonly blueprint = {
    id: "weapon:brawl",
    category: "weapon",
    subtype: "brawl",
    label: "Weapon / Brawl",
    defaultName: "Brawl Weapon",
    baseVisibleStats: ["Damage: STR", "Attacks: 2"],
    baseProfile: createEmptyProfile(),
  } satisfies ItemBlueprintDefinition;
}

class OneHandedWeapon extends Weapon {
  readonly blueprint = {
    id: "weapon:one_handed",
    category: "weapon",
    subtype: "one_handed",
    label: "Weapon / One-Handed",
    defaultName: "One-Handed Weapon",
    baseVisibleStats: ["Damage: STR + 2", "Attacks: 1"],
    baseProfile: createEmptyProfile(),
  } satisfies ItemBlueprintDefinition;
}

class TwoHandedWeapon extends Weapon {
  readonly blueprint = {
    id: "weapon:two_handed",
    category: "weapon",
    subtype: "two_handed",
    label: "Weapon / Two-Handed",
    defaultName: "Two-Handed Weapon",
    baseVisibleStats: ["Damage: STR + 6", "Attacks: 1"],
    baseProfile: createEmptyProfile(),
  } satisfies ItemBlueprintDefinition;
}

class OversizedWeapon extends Weapon {
  readonly blueprint = {
    id: "weapon:oversized",
    category: "weapon",
    subtype: "oversized",
    label: "Weapon / Oversized",
    defaultName: "Oversized Weapon",
    baseVisibleStats: ["Damage: STR + 9", "Attacks: 1"],
    baseProfile: createEmptyProfile(),
  } satisfies ItemBlueprintDefinition;
}

class BowWeapon extends Weapon {
  readonly blueprint = {
    id: "weapon:bow",
    category: "weapon",
    subtype: "bow",
    label: "Weapon / Bow",
    defaultName: "Bow",
    baseVisibleStats: ["Damage: 5", "Attacks: 1"],
    baseProfile: createEmptyProfile(),
  } satisfies ItemBlueprintDefinition;
}

class LightArmor extends Armor {
  readonly blueprint = {
    id: "armor:light",
    category: "armor",
    subtype: "light",
    label: "Armor / Light",
    defaultName: "Light Armor",
    baseVisibleStats: ["Armor: +2 AC", "Protection: +1 DR"],
    baseProfile: {
      ...createEmptyProfile(),
      derivedBonuses: {
        armor_class: 2,
        damage_reduction: 1,
      },
    },
  } satisfies ItemBlueprintDefinition;
}

class HeavyArmor extends Armor {
  readonly blueprint = {
    id: "armor:heavy",
    category: "armor",
    subtype: "heavy",
    label: "Armor / Heavy",
    defaultName: "Heavy Armor",
    baseVisibleStats: ["Protection: +3 DR"],
    baseProfile: {
      ...createEmptyProfile(),
      derivedBonuses: {
        damage_reduction: 3,
      },
    },
  } satisfies ItemBlueprintDefinition;
}

class JewelItem extends Jewel {
  readonly blueprint = {
    id: "jewel:jewel",
    category: "jewel",
    subtype: "jewel",
    label: "Jewel",
    defaultName: "Jewel",
    baseVisibleStats: [],
    baseProfile: createEmptyProfile(),
  } satisfies ItemBlueprintDefinition;
}

class MysticItem extends Mystic {
  readonly blueprint = {
    id: "mystic:mystic",
    category: "mystic",
    subtype: "mystic",
    label: "Mystic Item",
    defaultName: "Mystic Item",
    baseVisibleStats: [],
    baseProfile: createEmptyProfile(),
  } satisfies ItemBlueprintDefinition;
}

const ITEM_BLUEPRINTS = [
  new BrawlWeapon(),
  new OneHandedWeapon(),
  new TwoHandedWeapon(),
  new OversizedWeapon(),
  new BowWeapon(),
  new LightArmor(),
  new HeavyArmor(),
  new JewelItem(),
  new MysticItem(),
] as const;

const ITEM_BY_BLUEPRINT_ID = new Map(
  ITEM_BLUEPRINTS.map((definition) => [definition.blueprint.id, definition] as const)
);

const ITEM_BY_CATEGORY_AND_SUBTYPE = new Map(
  ITEM_BLUEPRINTS.map((definition) => [
    `${definition.blueprint.category}:${definition.blueprint.subtype}`,
    definition,
  ] as const)
);

export const ITEM_BLUEPRINT_OPTIONS = ITEM_BLUEPRINTS.map((definition) => ({
  id: definition.blueprint.id,
  category: definition.blueprint.category,
  subtype: definition.blueprint.subtype,
  label: definition.blueprint.label,
}));

export function createEmptyBonusProfile(): BonusProfile {
  return createEmptyProfile();
}

export function normalizeBonusProfile(value: Partial<BonusProfile> | null | undefined): BonusProfile {
  const statBonuses = value?.statBonuses ?? {};
  const skillBonuses = value?.skillBonuses ?? {};
  const derivedBonuses = value?.derivedBonuses ?? {};
  const resistanceBonuses = value?.resistanceBonuses ?? {};
  const utilityTraits = Array.isArray(value?.utilityTraits)
    ? value.utilityTraits.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const notes = Array.isArray(value?.notes)
    ? value.notes.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const powerBonuses = value?.powerBonuses ?? {};

  return {
    statBonuses: Object.fromEntries(
      Object.entries(statBonuses).flatMap(([key, entry]) =>
        typeof entry === "number" && Number.isFinite(entry)
          ? [[key, Math.trunc(entry)]]
          : []
      )
    ) as Partial<Record<StatId, number>>,
    skillBonuses: Object.fromEntries(
      Object.entries(skillBonuses).flatMap(([key, entry]) =>
        typeof entry === "number" && Number.isFinite(entry)
          ? [[key, Math.trunc(entry)]]
          : []
      )
    ),
    derivedBonuses: Object.fromEntries(
      Object.entries(derivedBonuses).flatMap(([key, entry]) =>
        typeof entry === "number" && Number.isFinite(entry)
          ? [[key, Math.trunc(entry)]]
          : []
      )
    ) as BonusProfile["derivedBonuses"],
    resistanceBonuses: Object.fromEntries(
      Object.entries(resistanceBonuses).flatMap(([key, entry]) =>
        typeof entry === "number" && Number.isFinite(entry)
          ? [[key, Math.trunc(entry)]]
          : []
      )
    ) as Partial<Record<DamageTypeId, number>>,
    utilityTraits: [...new Set(utilityTraits.map((entry) => entry.trim()))],
    notes: [...new Set(notes.map((entry) => entry.trim()))],
    powerBonuses: Object.fromEntries(
      Object.entries(powerBonuses).flatMap(([key, entry]) =>
        typeof entry === "number" && Number.isFinite(entry)
          ? [[key, Math.trunc(entry)]]
          : []
      )
    ),
  };
}

export function createEmptyItemKnowledgeState() {
  return {
    learnedCharacterIds: [],
    visibleCharacterIds: [],
  };
}

export function normalizeItemKnowledgeState(
  value: Partial<SharedItemRecord["knowledge"]> | null | undefined
): SharedItemRecord["knowledge"] {
  const learnedCharacterIds = Array.isArray(value?.learnedCharacterIds)
    ? value.learnedCharacterIds.filter((entry): entry is string => typeof entry === "string")
    : [];
  const visibleCharacterIds = Array.isArray(value?.visibleCharacterIds)
    ? value.visibleCharacterIds.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    learnedCharacterIds: [...new Set(learnedCharacterIds)],
    visibleCharacterIds: [...new Set(visibleCharacterIds.filter((entry) => learnedCharacterIds.includes(entry)))],
  };
}

export function createSharedItemRecord(
  blueprintId: ItemBlueprintId,
  overrides: Partial<
    Pick<
      SharedItemRecord,
      "id" | "name" | "itemLevel" | "qualityTier" | "baseDescription" | "bonusProfile" | "knowledge"
    >
  > = {}
): SharedItemRecord {
  const definition = ITEM_BY_BLUEPRINT_ID.get(blueprintId) ?? ITEM_BLUEPRINTS.at(-1);
  return definition!.createRecord(overrides);
}

export function hydrateSharedItemRecord(value: unknown): SharedItemRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const category = typeof record.category === "string" ? record.category : "mystic";
  const subtype = typeof record.subtype === "string" ? record.subtype : "mystic";
  const blueprintKey = `${category}:${subtype}` as ItemBlueprintId;
  const blueprint = ITEM_BY_CATEGORY_AND_SUBTYPE.get(blueprintKey) ?? ITEM_BLUEPRINTS.at(-1);

  return blueprint!.createRecord({
    id: typeof record.id === "string" ? record.id : createTimestampedId("item"),
    name: typeof record.name === "string" ? record.name : undefined,
    itemLevel:
      typeof record.itemLevel === "number" && Number.isFinite(record.itemLevel)
        ? Math.max(1, Math.trunc(record.itemLevel))
        : inferItemLevelFromQualityTier(
            typeof record.qualityTier === "string" ? record.qualityTier : null
          ),
    qualityTier: typeof record.qualityTier === "string" ? record.qualityTier : null,
    baseDescription: typeof record.baseDescription === "string" ? record.baseDescription : "",
    bonusProfile: normalizeBonusProfile(record.bonusProfile as Partial<BonusProfile> | undefined),
    knowledge: normalizeItemKnowledgeState(
      record.knowledge as Partial<SharedItemRecord["knowledge"]> | undefined
    ),
  });
}

export function getItemBlueprintLabel(item: SharedItemRecord): string {
  return (
    ITEM_BY_CATEGORY_AND_SUBTYPE.get(`${item.category}:${item.subtype}`)?.blueprint.label ??
    "Mystic Item"
  );
}

export function getItemBlueprintId(item: SharedItemRecord): ItemBlueprintId {
  return (
    ITEM_BY_CATEGORY_AND_SUBTYPE.get(`${item.category}:${item.subtype}`)?.blueprint.id ??
    "mystic:mystic"
  );
}

export function retypeSharedItemRecord(
  item: SharedItemRecord,
  blueprintId: ItemBlueprintId
): SharedItemRecord {
  const next = createSharedItemRecord(blueprintId, {
    id: item.id,
    name: item.name,
    itemLevel: item.itemLevel,
    qualityTier: item.qualityTier,
    baseDescription: item.baseDescription,
    bonusProfile: item.bonusProfile,
    knowledge: item.knowledge,
  });

  return {
    ...next,
    bonusProfile: normalizeBonusProfile(item.bonusProfile),
    knowledge: normalizeItemKnowledgeState(item.knowledge),
  };
}

export function getItemBaseVisibleStats(item: SharedItemRecord): string[] {
  return (
    ITEM_BY_CATEGORY_AND_SUBTYPE.get(`${item.category}:${item.subtype}`)?.getBaseVisibleStats(item) ??
    (item.baseDescription.trim() ? [item.baseDescription.trim()] : [])
  );
}

export function getItemResolvedProfile(item: SharedItemRecord): BonusProfile {
  const blueprint =
    ITEM_BY_CATEGORY_AND_SUBTYPE.get(`${item.category}:${item.subtype}`) ?? ITEM_BLUEPRINTS.at(-1);
  return mergeProfiles(blueprint!.getBaseProfile(), normalizeBonusProfile(item.bonusProfile));
}

export function buildItemIndex(items: SharedItemRecord[]): Record<string, SharedItemRecord> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export function getEquippedItemIds(sheet: CharacterDraft): string[] {
  return (sheet.equipment ?? [])
    .map((entry: CharacterEquipmentReference) => entry.itemId)
    .filter((itemId): itemId is string => typeof itemId === "string" && itemId.length > 0);
}

export function getApplicableItemIds(sheet: CharacterDraft): string[] {
  return [...new Set([...getEquippedItemIds(sheet), ...(sheet.activeItemIds ?? [])])];
}

export function buildCharacterItemModifierSources(
  sheet: CharacterDraft,
  itemsById: Record<string, SharedItemRecord>
): ItemModifierSource[] {
  const itemIds = getApplicableItemIds(sheet);
  const sources: ItemModifierSource[] = [];

  itemIds.forEach((itemId) => {
    const item = itemsById[itemId];
    if (!item) {
      return;
    }

    const profile = getItemResolvedProfile(item);
    const sourceLabel = item.name.trim() || getItemBlueprintLabel(item);

    Object.entries(profile.statBonuses).forEach(([targetId, value]) => {
      if (typeof value === "number" && value !== 0) {
        sources.push({
          targetType: "stat",
          targetId,
          value,
          sourceLabel,
        });
      }
    });

    Object.entries(profile.skillBonuses).forEach(([targetId, value]) => {
      if (typeof value === "number" && value !== 0) {
        sources.push({
          targetType: "skill",
          targetId,
          value,
          sourceLabel,
        });
      }
    });

    Object.entries(profile.derivedBonuses).forEach(([targetId, value]) => {
      if (typeof value === "number" && value !== 0) {
        sources.push({
          targetType: "derived",
          targetId,
          value,
          sourceLabel,
        });
      }
    });

    Object.entries(profile.resistanceBonuses).forEach(([targetId, value]) => {
      if (typeof value === "number" && value !== 0) {
        sources.push({
          targetType: "resistance",
          targetId,
          value,
          sourceLabel,
        });
      }
    });
  });

  return sources;
}

export function getCharacterItemUtilityTraits(
  sheet: CharacterDraft,
  itemsById: Record<string, SharedItemRecord>
): string[] {
  const traits = new Set<string>();

  getApplicableItemIds(sheet).forEach((itemId) => {
    const item = itemsById[itemId];
    if (!item) {
      return;
    }

    getItemResolvedProfile(item).utilityTraits.forEach((trait) => {
      if (trait.trim()) {
        traits.add(trait.trim());
      }
    });
  });

  return [...traits];
}

export function getCharacterArtifactAppraisalLevel(sheet: CharacterDraft): number {
  return sheet.powers.find((power) => power.id === "awareness")?.level ?? 0;
}

export function canCharacterIdentifyItem(
  item: SharedItemRecord,
  artifactAppraisalLevel: number
): boolean {
  return artifactAppraisalLevel >= item.itemLevel;
}

export function hasCharacterLearnedItem(item: SharedItemRecord, characterId: string): boolean {
  return item.knowledge.learnedCharacterIds.includes(characterId);
}

export function isItemBonusVisibleToCharacter(item: SharedItemRecord, characterId: string): boolean {
  return item.knowledge.visibleCharacterIds.includes(characterId);
}

export function identifyItemForCharacter(item: SharedItemRecord, characterId: string): SharedItemRecord {
  const learnedCharacterIds = [...new Set([...item.knowledge.learnedCharacterIds, characterId])];
  const visibleCharacterIds = [...new Set([...item.knowledge.visibleCharacterIds, characterId])];

  return {
    ...item,
    knowledge: {
      learnedCharacterIds,
      visibleCharacterIds,
    },
  };
}

export function maskItemForCharacter(item: SharedItemRecord, characterId: string): SharedItemRecord {
  if (!hasCharacterLearnedItem(item, characterId)) {
    return item;
  }

  return {
    ...item,
    knowledge: {
      ...item.knowledge,
      visibleCharacterIds: item.knowledge.visibleCharacterIds.filter((entry) => entry !== characterId),
    },
  };
}

export function shareItemKnowledge(
  item: SharedItemRecord,
  sourceCharacterId: string,
  targetCharacterId: string
): SharedItemRecord {
  if (!hasCharacterLearnedItem(item, sourceCharacterId)) {
    return item;
  }

  return identifyItemForCharacter(item, targetCharacterId);
}

export function getVisibleItemBonusNotes(
  item: SharedItemRecord,
  characterId: string
): string[] {
  return isItemBonusVisibleToCharacter(item, characterId)
    ? [...normalizeBonusProfile(item.bonusProfile).notes]
    : [];
}

export function inferItemLevelFromQualityTier(qualityTier: string | null): number {
  const normalized = qualityTier?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return 1;
  }

  if (normalized.includes("myth") || normalized.includes("celestial") || normalized.includes("demonic")) {
    return 5;
  }

  if (normalized.includes("legendary")) {
    return 4;
  }

  if (normalized.includes("epic")) {
    return 3;
  }

  if (normalized.includes("rare")) {
    return 2;
  }

  return 1;
}

export function inferItemBlueprintId(
  itemName: string,
  categoryText: string,
  slotText = ""
): ItemBlueprintId {
  const combined = `${itemName} ${categoryText} ${slotText}`.trim().toLowerCase();

  if (combined.includes("bow")) {
    return "weapon:bow";
  }

  if (combined.includes("two") && combined.includes("hand")) {
    return "weapon:two_handed";
  }

  if (combined.includes("oversized")) {
    return "weapon:oversized";
  }

  if (combined.includes("light armor") || combined.includes("light_armor")) {
    return "armor:light";
  }

  if (combined.includes("heavy armor") || combined.includes("heavy_armor")) {
    return "armor:heavy";
  }

  if (combined.includes("weapon") || combined.includes("sword") || combined.includes("mace") || combined.includes("blade")) {
    return "weapon:one_handed";
  }

  if (combined.includes("armor") || combined.includes("shield")) {
    return "armor:light";
  }

  if (combined.includes("ring") || combined.includes("necklace") || combined.includes("jewel")) {
    return "jewel:jewel";
  }

  if (combined.includes("brawl") || combined.includes("fist") || combined.includes("gauntlet")) {
    return "weapon:brawl";
  }

  return "mystic:mystic";
}
