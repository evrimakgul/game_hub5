export const BODY_REINFORCEMENT_BUFF_SPELL_NAME = "Boost Physique";
export const BODY_REINFORCEMENT_CANTRIP_SPELL_NAME = "Brute Defiance";

export function getBoostPhysiqueSourceLabel(level: number): string {
  return `${BODY_REINFORCEMENT_BUFF_SPELL_NAME} Lv ${level}`;
}
