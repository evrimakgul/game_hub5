import type {
  CharacterId,
  CoreStatId,
  EquipmentSlot,
  ISODateString,
  ItemBodyPart,
  ItemInstanceId,
  ItemQuality,
  ItemSpec,
  ItemTemplateId,
  ItemType,
  PowerId,
  SkillId,
} from "./game";

export type DerivedItemModifierTarget =
  | "max_hp"
  | "max_mana"
  | "initiative"
  | "armor_class"
  | "damage_reduction"
  | "soak"
  | "attack_dice_pool_hit_bonus"
  | "damage_dice_pool_bonus"
  | "attack_resolution_hit_bonus"
  | "damage_resolution_bonus"
  | "successes_to_any_roll";

export type ItemModifierTarget = CoreStatId | SkillId | PowerId | DerivedItemModifierTarget | string;

export interface ItemModifier {
  target: ItemModifierTarget;
  amount?: number;
  formula?: string;
  condition?: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ItemTemplate {
  itemTemplateId: ItemTemplateId;
  name: string;
  quality: ItemQuality;
  bodyPart: ItemBodyPart;
  itemType: ItemType;
  spec: ItemSpec;
  slotCompatibility: EquipmentSlot[];
  labels: string[];
  bidCost: number | null;
  buyoutCost: number | null;
  modifiers: ItemModifier[];
  remarks: string | null;
}

export interface InventoryItem {
  itemInstanceId: ItemInstanceId;
  templateId: ItemTemplateId;
  ownerCharacterId: CharacterId;
  quantity: number;
  charges: number | null;
  durability: number | null;
  customName: string | null;
  equippedSlot: EquipmentSlot | null;
  acquiredAt: ISODateString | null;
}

export type EquipmentLoadout = Partial<Record<EquipmentSlot, ItemInstanceId>>;
