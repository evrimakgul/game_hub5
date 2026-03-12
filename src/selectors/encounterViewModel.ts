import type { CharacterEncounterSnapshot } from "../types/combatEncounter.ts";
import type {
  EncounterParticipantView,
  EncounterRollTarget,
} from "../types/combatEncounterView.ts";
import { getEncounterPartyMembers } from "../lib/combatEncounterCasting.ts";

const ROLLER_EXCLUDED_SUMMARY_IDS = new Set(["hp", "mana", "ac", "dr", "soak"]);

export type EncounterCombatantViewModel = {
  participant: EncounterParticipantView["participant"];
  character: EncounterParticipantView["character"];
  snapshot: EncounterParticipantView["snapshot"];
  statusSummary: string | null;
};

export function buildEncounterRollTargets(
  snapshot: CharacterEncounterSnapshot | null
): EncounterRollTarget[] {
  if (!snapshot) {
    return [];
  }

  return [
    ...snapshot.combatSummary
      .filter((field) => !ROLLER_EXCLUDED_SUMMARY_IDS.has(field.id) && field.selectableValue !== null)
      .map((field) => ({
        id: `summary:${field.id}`,
        label: field.label,
        value: field.selectableValue ?? 0,
        category: "summary" as const,
      })),
    ...snapshot.stats.map((field) => ({
      id: `stat:${field.id}`,
      label: field.label,
      value: Number(field.value),
      category: "stat" as const,
    })),
    ...snapshot.highlightedSkills.map((field) => ({
      id: `skill:${field.id}`,
      label: field.label,
      value: Number(field.value),
      category: "skill" as const,
    })),
  ];
}

export function buildEncounterCombatantViewModel(
  view: EncounterParticipantView
): EncounterCombatantViewModel {
  return {
    participant: view.participant,
    character: view.character,
    snapshot: view.snapshot,
    statusSummary:
      view.character && view.character.sheet.statusTags.length > 0
        ? view.character.sheet.statusTags.map((tag) => tag.label).join(" | ")
        : null,
  };
}

export { getEncounterPartyMembers };
