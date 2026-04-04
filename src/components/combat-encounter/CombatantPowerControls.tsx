import { useEffect, useRef, useState } from "react";

import { useAuraEffectManager } from "../../hooks/useAuraEffectManager";
import { useCombatantCastState } from "../../hooks/useCombatantCastState";
import { getBruteDefianceState } from "../../lib/combatEncounterSpecialActions.ts";
import type {
  CastRequestPayload,
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../../types/combatEncounterView";
import type { SharedItemRecord } from "../../types/items";
import { BODY_REINFORCEMENT_CANTRIP_SPELL_NAME } from "../../powers/spellLabels.ts";
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
  requestBruteDefiance: (payload: {
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
  requestBruteDefiance,
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
  const [bruteDefianceError, setBruteDefianceError] = useState<string | null>(null);
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

  const bruteDefianceState = getBruteDefianceState(character);

  function handleBruteDefiance(): void {
    setBruteDefianceError(
      requestBruteDefiance({
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
              {bruteDefianceState.isAvailable ? (
                <div className="dm-combatant-tool-subsection">
                  <p className="section-kicker">{BODY_REINFORCEMENT_CANTRIP_SPELL_NAME}</p>
                  <p className="dm-summary-line">{bruteDefianceState.statusText}</p>
                  <div className="dm-control-row">
                    <button
                      type="button"
                      className="flow-secondary"
                      onClick={handleBruteDefiance}
                      disabled={!bruteDefianceState.isEligible}
                    >
                      Trigger {BODY_REINFORCEMENT_CANTRIP_SPELL_NAME}
                    </button>
                  </div>
                  {bruteDefianceError ? (
                    <p className="dm-error">{bruteDefianceError}</p>
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
