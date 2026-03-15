import { useEffect, useRef, useState } from "react";

import { useAuraEffectManager } from "../../hooks/useAuraEffectManager";
import { useCombatantCastState } from "../../hooks/useCombatantCastState";
import { getBodyReinforcementReviveState } from "../../lib/combatEncounterSpecialActions.ts";
import type {
  CastRequestPayload,
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../../types/combatEncounterView";
import type { SharedItemRecord } from "../../types/items";
import { CombatantActiveEffectsPanel } from "./CombatantActiveEffectsPanel";
import { CombatantCastForm } from "./CombatantCastForm";
import { CombatantPhysicalAttackForm } from "./CombatantPhysicalAttackForm";

type CombatantPowerControlsProps = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  itemsById: Record<string, SharedItemRecord>;
  requestCast: (payload: CastRequestPayload) => string | null;
  requestPhysicalAttack: (payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
  }) => string | null;
  requestBodyReinforcementRevive: (payload: {
    view: EncounterParticipantView;
  }) => string | null;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

export function CombatantPowerControls({
  view,
  encounterParticipants,
  itemsById,
  requestCast,
  requestPhysicalAttack,
  requestBodyReinforcementRevive,
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
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [bodyReinforcementError, setBodyReinforcementError] = useState<string | null>(null);
  const actionsPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isActionsOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      if (!actionsPopoverRef.current?.contains(event.target as Node)) {
        setIsActionsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsActionsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isActionsOpen]);

  if (!character) {
    return null;
  }

  const bodyReinforcementState = getBodyReinforcementReviveState(character);

  function handleBodyReinforcementRevive(): void {
    setBodyReinforcementError(
      requestBodyReinforcementRevive({
        view,
      })
    );
  }

  return (
    <>
      <div className="dm-combatant-tool-section">
        <p className="section-kicker">Actions</p>
        <div className="dm-actions-popover-anchor" ref={actionsPopoverRef}>
          <button
            type="button"
            className="flow-secondary"
            onClick={() => setIsActionsOpen((open) => !open)}
          >
            {isActionsOpen ? "Close Actions" : "Open Actions"}
          </button>
          {isActionsOpen ? (
            <div className="dm-actions-popover">
              <div className="dm-combatant-tool-subsection">
                <p className="section-kicker">Physical Attack</p>
                <CombatantPhysicalAttackForm
                  embedded
                  view={view}
                  encounterParticipants={encounterParticipants}
                  itemsById={itemsById}
                  requestPhysicalAttack={requestPhysicalAttack}
                />
              </div>
              <div className="dm-combatant-tool-subsection">
                <p className="section-kicker">Cast Power</p>
                <CombatantCastForm embedded state={castState} />
              </div>
              {bodyReinforcementState.isAvailable ? (
                <div className="dm-combatant-tool-subsection">
                  <p className="section-kicker">Body Reinforcement</p>
                  <p className="dm-summary-line">{bodyReinforcementState.statusText}</p>
                  <div className="dm-control-row">
                    <button
                      type="button"
                      className="flow-secondary"
                      onClick={handleBodyReinforcementRevive}
                      disabled={!bodyReinforcementState.isEligible}
                    >
                      Trigger Body Reinforcement
                    </button>
                  </div>
                  {bodyReinforcementError ? (
                    <p className="dm-error">{bodyReinforcementError}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <CombatantActiveEffectsPanel
        character={character}
        encounterParticipants={encounterParticipants}
        state={auraState}
      />
    </>
  );
}
