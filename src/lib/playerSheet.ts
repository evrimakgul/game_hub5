import type {
  Character,
  CoreStatLevels,
  InventoryItem,
  ItemTemplate,
  KnownPower,
  SkillLevels,
  StatusEffectState,
  TraitSelection,
} from "../types";
import { CORE_STAT_IDS, EQUIPMENT_SLOTS, SKILL_IDS, type EquipmentSlot } from "../types";
import { getSupabaseBrowserClient } from "./supabase";

type CharacterRow = {
  character_id: string;
  profile_id: string;
  display_name: string;
  is_player_character: boolean;
  age: number | null;
  biography_primary: string | null;
  biography_secondary: string | null;
  xp_used: number;
  money: number;
  inspiration: number;
  positive_karma: number;
  negative_karma: number;
  current_hp: number;
  current_mana: number;
};

type CoreStatRow = {
  stat_id: (typeof CORE_STAT_IDS)[number];
  level: number;
};

type SkillRow = {
  skill_id: (typeof SKILL_IDS)[number];
  level: number;
};

type KnownPowerRow = {
  power_id: string;
  level: number;
  learned_from: KnownPower["learnedFrom"];
  unlocked_at_xp: number | null;
};

type TraitRow = {
  selection_type: "trait" | "merit" | "flaw";
  selection_id: string;
  label: string;
  notes: string | null;
};

type StatusEffectRow = {
  status_effect_id: string;
  label: string;
  source_type: StatusEffectState["sourceType"];
  source_id: string | null;
  stacks: number;
  applied_at: string | null;
  expires_at: string | null;
  remaining_rounds: number | null;
  effects: StatusEffectState["effects"];
  payload: Record<string, unknown> | null;
};

type InventoryRow = {
  item_instance_id: string;
  template_id: string;
  owner_character_id: string;
  quantity: number;
  charges: number | null;
  durability: number | null;
  custom_name: string | null;
  equipped_slot: EquipmentSlot | null;
  acquired_at: string | null;
};

type ItemTemplateRow = {
  item_template_id: string;
  name: string;
  quality: ItemTemplate["quality"];
  body_part: ItemTemplate["bodyPart"];
  item_type: ItemTemplate["itemType"];
  spec: ItemTemplate["spec"];
  slot_compatibility: EquipmentSlot[] | null;
  labels: string[] | null;
  bid_cost: number | null;
  buyout_cost: number | null;
  modifiers: ItemTemplate["modifiers"] | null;
  effects: ItemTemplate["effects"] | null;
  remarks: string | null;
};

export type EquippedItemView = {
  slot: EquipmentSlot;
  inventoryItem: InventoryItem;
  template: ItemTemplate | null;
};

export type PlayerSheetData = {
  character: Character;
  inventoryItems: InventoryItem[];
  itemTemplatesById: Record<string, ItemTemplate>;
  equippedItems: EquippedItemView[];
};

function createEmptyCoreStats(): CoreStatLevels {
  return CORE_STAT_IDS.reduce<CoreStatLevels>((result, statId) => {
    result[statId] = 0;
    return result;
  }, {} as CoreStatLevels);
}

function createEmptySkillLevels(): SkillLevels {
  return SKILL_IDS.reduce<SkillLevels>((result, skillId) => {
    result[skillId] = 0;
    return result;
  }, {} as SkillLevels);
}

function toTraitSelection(row: TraitRow): TraitSelection {
  return {
    id: row.selection_id,
    label: row.label,
    notes: row.notes,
  };
}

function toKnownPower(row: KnownPowerRow): KnownPower {
  return {
    powerId: row.power_id as KnownPower["powerId"],
    level: row.level,
    learnedFrom: row.learned_from,
    unlockedAtXp: row.unlocked_at_xp,
  };
}

function toInventoryItem(row: InventoryRow): InventoryItem {
  return {
    itemInstanceId: row.item_instance_id,
    templateId: row.template_id,
    ownerCharacterId: row.owner_character_id,
    quantity: row.quantity,
    charges: row.charges,
    durability: row.durability,
    customName: row.custom_name,
    equippedSlot: row.equipped_slot,
    acquiredAt: row.acquired_at,
  };
}

function toItemTemplate(row: ItemTemplateRow): ItemTemplate {
  return {
    itemTemplateId: row.item_template_id,
    name: row.name,
    quality: row.quality,
    bodyPart: row.body_part,
    itemType: row.item_type,
    spec: row.spec,
    slotCompatibility: row.slot_compatibility ?? [],
    labels: row.labels ?? [],
    bidCost: row.bid_cost,
    buyoutCost: row.buyout_cost,
    modifiers: row.modifiers ?? [],
    effects: row.effects ?? [],
    remarks: row.remarks,
  };
}

function buildCharacter(
  characterRow: CharacterRow,
  coreStatRows: CoreStatRow[],
  skillRows: SkillRow[],
  knownPowerRows: KnownPowerRow[],
  traitRows: TraitRow[],
  statusEffectRows: StatusEffectRow[],
  inventoryItems: InventoryItem[]
): Character {
  const coreStats = createEmptyCoreStats();
  const skillLevels = createEmptySkillLevels();

  for (const row of coreStatRows) {
    coreStats[row.stat_id] = row.level;
  }

  for (const row of skillRows) {
    skillLevels[row.skill_id] = row.level;
  }

  const traits = traitRows.filter((row) => row.selection_type === "trait").map(toTraitSelection);
  const merits = traitRows.filter((row) => row.selection_type === "merit").map(toTraitSelection);
  const flaws = traitRows.filter((row) => row.selection_type === "flaw").map(toTraitSelection);
  const equippedItems = inventoryItems.reduce<Character["equippedItems"]>((result, item) => {
    if (item.equippedSlot) {
      result[item.equippedSlot] = item.itemInstanceId;
    }

    return result;
  }, {});

  return {
    characterId: characterRow.character_id,
    profileId: characterRow.profile_id,
    displayName: characterRow.display_name,
    isPlayerCharacter: characterRow.is_player_character,
    age: characterRow.age,
    biographyPrimary: characterRow.biography_primary,
    biographySecondary: characterRow.biography_secondary,
    xpUsed: characterRow.xp_used,
    money: characterRow.money,
    inspiration: characterRow.inspiration,
    positiveKarma: characterRow.positive_karma,
    negativeKarma: characterRow.negative_karma,
    currentHp: characterRow.current_hp,
    currentMana: characterRow.current_mana,
    coreStats,
    skillLevels,
    knownPowers: knownPowerRows.map(toKnownPower),
    traits,
    merits,
    flaws,
    equippedItems,
    statusEffects: statusEffectRows.map((row) => ({
      statusEffectId: row.status_effect_id,
      label: row.label,
      sourceType: row.source_type,
      sourceId: row.source_id,
      stacks: row.stacks,
      appliedAt: row.applied_at,
      expiresAt: row.expires_at,
      remainingRounds: row.remaining_rounds,
      effects: row.effects,
      payload: row.payload ?? {},
    })),
  };
}

function buildEquippedItemViews(
  inventoryItems: InventoryItem[],
  itemTemplatesById: Record<string, ItemTemplate>
): EquippedItemView[] {
  const slotOrder = new Map<EquipmentSlot, number>(EQUIPMENT_SLOTS.map((slot, index) => [slot, index]));

  return inventoryItems
    .filter((item) => item.equippedSlot !== null)
    .map((inventoryItem) => ({
      slot: inventoryItem.equippedSlot as EquipmentSlot,
      inventoryItem,
      template: itemTemplatesById[inventoryItem.templateId] ?? null,
    }))
    .sort((left, right) => (slotOrder.get(left.slot) ?? 999) - (slotOrder.get(right.slot) ?? 999));
}

export async function loadPlayerSheetForProfile(profileId: string): Promise<PlayerSheetData | null> {
  const client = getSupabaseBrowserClient();

  const { data: characterRow, error: characterError } = await client
    .from("characters")
    .select(
      "character_id, profile_id, display_name, is_player_character, age, biography_primary, biography_secondary, xp_used, money, inspiration, positive_karma, negative_karma, current_hp, current_mana"
    )
    .eq("profile_id", profileId)
    .eq("is_player_character", true)
    .limit(1)
    .maybeSingle<CharacterRow>();

  if (characterError) {
    throw characterError;
  }

  if (!characterRow) {
    return null;
  }

  const characterId = characterRow.character_id;

  const [
    coreStatsResponse,
    skillLevelsResponse,
    knownPowersResponse,
    traitsResponse,
    statusEffectsResponse,
    inventoryItemsResponse,
  ] = await Promise.all([
    client
      .from("character_core_stats")
      .select("stat_id, level")
      .eq("character_id", characterId)
      .returns<CoreStatRow[]>(),
    client
      .from("character_skill_levels")
      .select("skill_id, level")
      .eq("character_id", characterId)
      .returns<SkillRow[]>(),
    client
      .from("character_known_powers")
      .select("power_id, level, learned_from, unlocked_at_xp")
      .eq("character_id", characterId)
      .returns<KnownPowerRow[]>(),
    client
      .from("character_traits")
      .select("selection_type, selection_id, label, notes")
      .eq("character_id", characterId)
      .order("sort_order", { ascending: true })
      .returns<TraitRow[]>(),
    client
      .from("character_status_effects")
      .select(
        "status_effect_id, label, source_type, source_id, stacks, applied_at, expires_at, remaining_rounds, effects, payload"
      )
      .eq("character_id", characterId)
      .returns<StatusEffectRow[]>(),
    client
      .from("inventory_items")
      .select(
        "item_instance_id, template_id, owner_character_id, quantity, charges, durability, custom_name, equipped_slot, acquired_at"
      )
      .eq("owner_character_id", characterId)
      .returns<InventoryRow[]>(),
  ]);

  const errors = [
    coreStatsResponse.error,
    skillLevelsResponse.error,
    knownPowersResponse.error,
    traitsResponse.error,
    statusEffectsResponse.error,
    inventoryItemsResponse.error,
  ].filter((error): error is NonNullable<typeof coreStatsResponse.error> => Boolean(error));

  if (errors.length > 0) {
    throw errors[0];
  }

  const inventoryItems = (inventoryItemsResponse.data ?? []).map(toInventoryItem);
  const templateIds = [...new Set(inventoryItems.map((item) => item.templateId))];

  let itemTemplatesById: Record<string, ItemTemplate> = {};

  if (templateIds.length > 0) {
    const { data: templateRows, error: templateError } = await client
      .from("item_templates")
      .select(
        "item_template_id, name, quality, body_part, item_type, spec, slot_compatibility, labels, bid_cost, buyout_cost, modifiers, effects, remarks"
      )
      .in("item_template_id", templateIds)
      .returns<ItemTemplateRow[]>();

    if (templateError) {
      throw templateError;
    }

    itemTemplatesById = Object.fromEntries(
      (templateRows ?? []).map((row) => {
        const template = toItemTemplate(row);
        return [template.itemTemplateId, template];
      })
    );
  }

  const character = buildCharacter(
    characterRow,
    coreStatsResponse.data ?? [],
    skillLevelsResponse.data ?? [],
    knownPowersResponse.data ?? [],
    traitsResponse.data ?? [],
    statusEffectsResponse.data ?? [],
    inventoryItems
  );

  return {
    character,
    inventoryItems,
    itemTemplatesById,
    equippedItems: buildEquippedItemViews(inventoryItems, itemTemplatesById),
  };
}
