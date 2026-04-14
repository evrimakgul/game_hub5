import type { PowerEntry } from "../config/characterTemplate.ts";
import type { ActivePowerEffect } from "../types/activePowerEffects.ts";
import type { CharacterRecord, StatId } from "../types/character.ts";
import type {
  CastOutcomeState,
  EncounterParticipantView,
  PreparedCastRequest,
} from "../types/combatEncounterView.ts";
import type { SharedItemRecord } from "../types/items.ts";
import type { CastPowerMode, CastPowerVariantId } from "../powers/spellTypes.ts";
import type { PowerUseEnvironment } from "../lib/powerCasting.ts";
import type { DamageTypeId } from "../rules/resistances.ts";

export type ActionContext = {
  environment: PowerUseEnvironment;
  payload: unknown;
  casterCharacter: CharacterRecord;
  casterName: string;
  selectedPower: PowerEntry | null;
  selectedSpellId: CastPowerVariantId;
  encounterParticipants: EncounterParticipantView[];
  itemsById: Record<string, SharedItemRecord>;
  casterView: EncounterParticipantView | null;
  validTargetViews: EncounterParticipantView[];
  selectedTargetViews: EncounterParticipantView[];
  fallbackTargetViews: EncounterParticipantView[];
  finalTargetViews: EncounterParticipantView[];
  finalTargets: CharacterRecord[];
  attackOutcome: CastOutcomeState;
  healingAllocations: Record<string, number>;
  selectedStatId: StatId | null;
  castMode: CastPowerMode;
  selectedDamageType: DamageTypeId | null;
  bonusManaSpend: number;
  selectedSummonOptionId: string | null;
};

export class EffectContext {
  readonly request: PreparedCastRequest;

  constructor(casterCharacterId: string, targetCharacterIds: string[], manaCost = 0) {
    this.request = {
      casterCharacterId,
      targetCharacterIds,
      manaCost,
      effects: [],
      historyEntries: [],
      activityLogEntries: [],
      healingApplications: [],
      damageApplications: [],
      resourceChanges: [],
      statusTagChanges: [],
      usageCounterChanges: [],
      summonChanges: [],
      ongoingStateChanges: [],
    };
  }

  addActiveEffect(effect: ActivePowerEffect): void {
    this.request.effects.push(effect);
  }
}
