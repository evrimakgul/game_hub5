import type { StatSource } from "../config/characterTemplate.ts";
import type { CharacterDraft, PowerEntry } from "../config/characterTemplate.ts";
import type { SharedItemRecord } from "../types/items.ts";
import type { ActionContext } from "../engine/context.ts";
import type { Action } from "../engine/actions.ts";

export type PassiveProviderContext = {
  sheet: CharacterDraft;
  power: PowerEntry;
  itemsById: Record<string, SharedItemRecord>;
};

export type PowerPassiveProviderResult = {
  skillSources: Array<{ skillId: string; source: StatSource }>;
  utilityTraits: string[];
  manaBonus: number;
};

export abstract class PowerPassiveProvider {
  getResult(_context: PassiveProviderContext): PowerPassiveProviderResult {
    return {
      skillSources: [],
      utilityTraits: [],
      manaBonus: 0,
    };
  }
}

export type PowerModule = {
  powerId: string;
  spellIds: string[];
  passiveProvider: PowerPassiveProvider;
  createAction(context: ActionContext): Action | null;
};
