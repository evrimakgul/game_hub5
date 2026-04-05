export const BODY_REINFORCEMENT_BUFF_SPELL_NAME = "Boost Physique";
export const BODY_REINFORCEMENT_CANTRIP_SPELL_NAME = "Brute Defiance";
export const CROWD_CONTROL_SPELL_NAME = "Control Entity";
export const ELEMENTALIST_BOLT_SPELL_NAME = "Elemental Bolt";
export const ELEMENTALIST_CANTRIP_SPELL_NAME = "Elemental Cantrip";
export const ELEMENTALIST_SPLIT_SPELL_NAME = "Elemental Split";
export const HEALING_MAIN_SPELL_NAME = "Heal Living";
export const HEALING_PURGE_SPELL_NAME = "Holy Purge";
export const HEALING_TOUCH_SPELL_NAME = "Healing Touch";
export const LIGHT_SUPPORT_AURA_SPELL_NAME = "Let There Be Light";
export const LIGHT_SUPPORT_DARKNESS_SPELL_NAME = "Lessen Darkness";
export const LIGHT_SUPPORT_RESTORE_SPELL_NAME = "Luminous Restoration";
export const NECROMANCY_SKELETON_SPELL_NAME = "Non-Living Skeleton";
export const NECROMANCY_SKELETON_KING_SPELL_NAME = "Non-Living Skeleton King";
export const NECROMANCY_ZOMBIE_SPELL_NAME = "Non-Living Zombie";
export const NECROMANCY_TOUCH_SPELL_NAME = "Necrotic Touch";
export const NECROMANCY_BLESS_SPELL_NAME = "Necromancer's Bless";
export const SHADOW_CONTROL_AURA_SPELL_NAME = "Smoldering Shadow";
export const SHADOW_CONTROL_WALK_SPELL_NAME = "Shadow Walk";
export const SHADOW_CONTROL_WALK_ATTACK_SPELL_NAME = "Shadow Walk and Attack";
export const SHADOW_CONTROL_MANIPULATION_SPELL_NAME = "Shadow Manipulation";
export const SHADOW_CONTROL_FIGHTER_SPELL_NAME = "Shadow Fighter";

export function getBoostPhysiqueSourceLabel(level: number): string {
  return `${BODY_REINFORCEMENT_BUFF_SPELL_NAME} Lv ${level}`;
}
