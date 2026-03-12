import { useAuraEffectManager } from "../../hooks/useAuraEffectManager";
import { useCombatantCastState } from "../../hooks/useCombatantCastState";
import type {
  CastRequestPayload,
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../../types/combatEncounterView";
import { CombatantActiveEffectsPanel } from "./CombatantActiveEffectsPanel";
import { CombatantCastForm } from "./CombatantCastForm";

type CombatantPowerControlsProps = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  requestCast: (payload: CastRequestPayload) => string | null;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

export function CombatantPowerControls({
  view,
  encounterParticipants,
  requestCast,
  updateCharacter,
}: CombatantPowerControlsProps) {
  const castState = useCombatantCastState({
    view,
    encounterParticipants,
    requestCast,
  });
  const auraState = useAuraEffectManager({
    view,
    encounterParticipants,
    updateCharacter,
  });
  const character = view.character;

  if (!character) {
    return null;
  }

  return (
    <>
      <CombatantCastForm state={castState} />
      <CombatantActiveEffectsPanel
        character={character}
        encounterParticipants={encounterParticipants}
        state={auraState}
      />
    </>
  );
}
