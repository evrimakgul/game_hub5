import type { CharacterRecord } from "../../types/character";
import type {
  CharacterEncounterSnapshot,
  CombatEncounterParticipant,
} from "../../types/combatEncounter";
import type { PowerEntry } from "../../config/characterTemplate";
import type { CastPowerMode, CastPowerVariantId } from "../../config/powerEffects";
import type { StatId } from "../../types/character";

export type EncounterParticipantView = {
  participant: CombatEncounterParticipant;
  character: CharacterRecord | null;
  snapshot: CharacterEncounterSnapshot | null;
};

export type CharacterSheetUpdater =
  | CharacterRecord["sheet"]
  | ((current: CharacterRecord["sheet"]) => CharacterRecord["sheet"]);

export type CastOutcomeState = "unresolved" | "hit" | "miss";

export type CastRequestPayload = {
  casterCharacter: CharacterRecord;
  casterDisplayName: string;
  selectedPower: PowerEntry;
  selectedVariantId: CastPowerVariantId;
  attackOutcome: CastOutcomeState;
  selectedTargetIds: string[];
  fallbackTargetIds: string[];
  healingAllocations: Record<string, number>;
  selectedStatId: StatId | null;
  castMode: CastPowerMode;
  encounterParticipants: EncounterParticipantView[];
};
