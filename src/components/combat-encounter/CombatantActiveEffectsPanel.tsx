import { type AuraEffectManagerState } from "../../hooks/useAuraEffectManager";
import {
  canSelectAuraTargets,
  isAuraSourceEffect,
} from "../../rules/powerEffects";
import type { CharacterRecord } from "../../types/character";
import type { EncounterParticipantView } from "../../types/combatEncounterView";
import { AuraTargetPopover } from "./AuraTargetPopover";

type CombatantActiveEffectsPanelProps = {
  character: CharacterRecord;
  encounterParticipants: EncounterParticipantView[];
  state: AuraEffectManagerState;
};

export function CombatantActiveEffectsPanel({
  character,
  encounterParticipants,
  state,
}: CombatantActiveEffectsPanelProps) {
  return (
    <div className="dm-combatant-tool-section">
      <p className="section-kicker">Applied Effects</p>
      {character.sheet.activePowerEffects.length === 0 ? (
        <p className="dm-summary-line">No active power effects on this combatant.</p>
      ) : (
        <div className="dm-effect-list">
          {character.sheet.activePowerEffects.map((effect) => (
            <article key={effect.id} className="dm-effect-card">
              <div>
                <strong>{effect.label}</strong>
                <small>{effect.summary}</small>
                <small>
                  {effect.casterName} {"->"} {effect.powerName}
                </small>
              </div>
              <div
                className="dm-effect-actions"
                ref={state.openAuraEffectId === effect.id ? state.auraPopoverRef : null}
              >
                {isAuraSourceEffect(effect) ? (
                  <button
                    type="button"
                    className="flow-secondary"
                    disabled={!canSelectAuraTargets(effect)}
                    onClick={() =>
                      canSelectAuraTargets(effect) ? state.toggleAuraPopover(effect.id) : null
                    }
                  >
                    Affected Targets
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flow-secondary"
                  onClick={() => state.handleRemoveEffect(effect)}
                >
                  Remove
                </button>
                {state.openAuraEffectId === effect.id && canSelectAuraTargets(effect) ? (
                  <AuraTargetPopover
                    effect={effect}
                    encounterParticipants={encounterParticipants}
                    isTargetSelected={(targetId) => state.isAuraTargetSelected(effect, targetId)}
                    onToggleTarget={(targetId) => state.toggleAuraTarget(effect, targetId)}
                    onApplyAllAllies={() => state.applyAuraToAllAllies(effect)}
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
