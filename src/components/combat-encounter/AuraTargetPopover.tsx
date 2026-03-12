import type { ActivePowerEffect } from "../../types/activePowerEffects";
import type { EncounterParticipantView } from "../../types/combatEncounterView";

type AuraTargetPopoverProps = {
  effect: ActivePowerEffect;
  encounterParticipants: EncounterParticipantView[];
  isTargetSelected: (targetId: string) => boolean;
  onToggleTarget: (targetId: string) => void;
  onApplyAllAllies: () => void;
};

export function AuraTargetPopover({
  effect,
  encounterParticipants,
  isTargetSelected,
  onToggleTarget,
  onApplyAllAllies,
}: AuraTargetPopoverProps) {
  return (
    <div className="dm-aura-popover">
      <div className="dm-aura-popover-head">
        <p className="section-kicker">Affected Targets</p>
        <button type="button" className="flow-secondary" onClick={onApplyAllAllies}>
          All Allies
        </button>
      </div>
      <div className="dm-target-multi-grid">
        {encounterParticipants
          .filter(({ character }) => character !== null)
          .map(({ participant }) => {
            const isSelf = participant.characterId === effect.casterCharacterId;
            const isSelected = isSelf || isTargetSelected(participant.characterId);

            return (
              <button
                key={participant.characterId}
                type="button"
                className={`dm-target-chip${isSelected ? " is-selected" : ""}`}
                aria-pressed={isSelf ? undefined : isSelected}
                disabled={isSelf}
                onClick={() => onToggleTarget(participant.characterId)}
              >
                {isSelf ? "Self" : participant.displayName}
              </button>
            );
          })}
      </div>
    </div>
  );
}
