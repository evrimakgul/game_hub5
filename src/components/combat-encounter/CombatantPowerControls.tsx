import { useEffect, useRef, useState } from "react";

import { useAuraEffectManager } from "../../hooks/useAuraEffectManager";
import { useCombatantCastState } from "../../hooks/useCombatantCastState";
import { isControlledByCaster } from "../../powers/runtimeSupport.ts";
import type {
  CastRequestPayload,
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../../types/combatEncounterView";
import type { SharedItemRecord } from "../../types/items";
import { CROWD_CONTROL_SPELL_NAME } from "../../powers/spellLabels.ts";
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
  requestControlRelease: (payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
  }) => string | null;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

export function CombatantPowerControls({
  view,
  encounterParticipants,
  itemsById,
  requestCast,
  requestPhysicalAttack,
  requestControlRelease,
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
  const [releaseControlError, setReleaseControlError] = useState<string | null>(null);
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

  const crowdControlPower =
    character.sheet.powers.find((power) => power.id === "crowd_control" && power.level > 0) ?? null;
  const controlledTargets = crowdControlPower
    ? encounterParticipants.filter((targetView) => isControlledByCaster(targetView, character.id))
    : [];

  function handleReleaseControl(targetView: EncounterParticipantView): void {
    setReleaseControlError(
      requestControlRelease({
        casterView: view,
        targetView,
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
              {controlledTargets.length > 0 ? (
                <div className="dm-combatant-tool-subsection">
                  <p className="section-kicker">{CROWD_CONTROL_SPELL_NAME}</p>
                  <p className="dm-summary-line">Release currently controlled targets here.</p>
                  <div className="dm-target-multi-grid">
                    {controlledTargets.map((targetView) => (
                      <button
                        key={targetView.participant.characterId}
                        type="button"
                        className="dm-target-chip"
                        onClick={() => handleReleaseControl(targetView)}
                      >
                        Release {targetView.participant.displayName}
                      </button>
                    ))}
                  </div>
                  {releaseControlError ? (
                    <p className="dm-error">{releaseControlError}</p>
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
