import { useAuraEffectManager } from "../../hooks/useAuraEffectManager";
import { useCombatantCastState } from "../../hooks/useCombatantCastState";
import type { PhysicalAttackProfileId } from "../../lib/combatEncounterPhysicalAttacks";
import type {
  CastRequestPayload,
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../../types/combatEncounterView";
import { CombatantActiveEffectsPanel } from "./CombatantActiveEffectsPanel";
import { CombatantCastForm } from "./CombatantCastForm";
import { CombatantPhysicalAttackForm } from "./CombatantPhysicalAttackForm";

type CombatantPowerControlsProps = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  requestCast: (payload: CastRequestPayload) => string | null;
  requestPhysicalAttack: (payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
    profileId: PhysicalAttackProfileId;
    landedHits: number;
  }) => string | null;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

export function CombatantPowerControls({
  view,
  encounterParticipants,
  requestCast,
  requestPhysicalAttack,
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
      <CombatantPhysicalAttackForm
        view={view}
        encounterParticipants={encounterParticipants}
        requestPhysicalAttack={requestPhysicalAttack}
      />
      <CombatantCastForm state={castState} />
      <CombatantActiveEffectsPanel
        character={character}
        encounterParticipants={encounterParticipants}
        state={auraState}
      />
    </>
  );
}
