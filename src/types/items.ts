import type {
  CharacterId,
  EquipmentSlot,
  ISODateString,
  ItemBodyPart,
  ItemInstanceId,
  ItemQuality,
  ItemSpec,
  ItemTemplateId,
  ItemType,
} from "./game";
import type { EffectDefinition, ModifierEffect } from "./effects";

export type ItemModifier = ModifierEffect;

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
  effects: EffectDefinition[];
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
