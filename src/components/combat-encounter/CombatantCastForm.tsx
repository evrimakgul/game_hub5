import { type CombatantCastState } from "../../hooks/useCombatantCastState";
import { getRuntimePowerAbbreviation } from "../../rules/powerData";
import {
  type CastPowerMode,
  type CastPowerVariantId,
} from "../../rules/powerEffects";
import type { CastOutcomeState } from "../../types/combatEncounterView";

type CombatantCastFormProps = {
  state: CombatantCastState;
};

export function CombatantCastForm({ state }: CombatantCastFormProps) {
  return (
    <div className="dm-combatant-tool-section">
      <p className="section-kicker">Cast Power Mechanism</p>
      <h3 className="dm-subheading">Active Power Effects</h3>
      {state.castablePowers.length === 0 ? (
        <p className="dm-summary-line">This combatant has no supported castable powers in the first slice.</p>
      ) : (
        <>
          <div className="dm-power-form">
            <label className="dm-field">
              <span>Power</span>
              <select
                value={state.selectedPower?.id ?? ""}
                onChange={(event) => state.selectPower(event.target.value)}
              >
                {state.castablePowers.map((power) => (
                  <option key={power.id} value={power.id}>
                    {getRuntimePowerAbbreviation(power.id) ?? power.name} Lv {power.level}
                  </option>
                ))}
              </select>
            </label>

            {state.shouldShowVariantField ? (
              <label className="dm-field">
                <span>Action</span>
                <select
                  value={state.resolvedVariantId}
                  onChange={(event) => state.selectVariant(event.target.value as CastPowerVariantId)}
                >
                  {state.variantOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {state.shouldShowTargetField ? (
              <label className="dm-field">
                <span>{state.targetMode === "multiple" ? "Targets" : "Target"}</span>
                {state.targetMode === "multiple" ? (
                  <>
                    <div className="dm-target-multi-grid">
                      {state.targetOptions.map(({ participant }) => {
                        const isSelected = state.selectedTargetIds.includes(participant.characterId);

                        return (
                          <button
                            key={participant.characterId}
                            type="button"
                            className={`dm-target-chip${isSelected ? " is-selected" : ""}`}
                            onClick={() => state.toggleTarget(participant.characterId)}
                          >
                            {participant.displayName}
                          </button>
                        );
                      })}
                    </div>
                    <small className="dm-field-hint">
                      Up to {state.targetLimit} target{state.targetLimit === 1 ? "" : "s"}.
                    </small>
                  </>
                ) : (
                  <select
                    value={state.resolvedSingleTargetId}
                    onChange={(event) => state.selectSingleTarget(event.target.value)}
                  >
                    {state.targetOptions.map(({ participant }) => (
                      <option key={participant.characterId} value={participant.characterId}>
                        {participant.displayName}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ) : null}

            {state.shouldShowModeField ? (
              <label className="dm-field">
                <span>Mode</span>
                <select
                  value={state.resolvedCastMode}
                  onChange={(event) =>
                    state.selectCastMode(
                      event.target.value === "aura" ? "aura" : ("self" as CastPowerMode)
                    )
                  }
                >
                  <option value="self">Self</option>
                  <option value="aura">Aura</option>
                </select>
              </label>
            ) : null}

            {state.requiresAttackOutcome ? (
              <label className="dm-field">
                <span>Touch Attack</span>
                <select
                  value={state.attackOutcome}
                  onChange={(event) =>
                    state.selectAttackOutcome(event.target.value as CastOutcomeState)
                  }
                >
                  <option value="unresolved">Resolve First</option>
                  <option value="hit">Hit</option>
                  <option value="miss">Miss</option>
                </select>
              </label>
            ) : null}

            {state.allowedStats.length > 0 ? (
              <label className="dm-field">
                <span>Stat</span>
                <select
                  value={state.resolvedSelectedStatId}
                  onChange={(event) => state.selectStat(event.target.value)}
                >
                  {state.allowedStats.map((statId) => (
                    <option key={statId} value={statId}>
                      {statId}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {state.selectedPower?.id === "healing" && state.healingTotal !== null ? (
            <div className="dm-healing-panel">
              <div className="dm-summary-box">
                <strong>Heal Pool</strong>
                <span>{state.healingTotal}</span>
              </div>
              <div className="dm-summary-box">
                <strong>Target Limit</strong>
                <span>{state.targetLimit}</span>
              </div>
              {state.shouldShowHealingAllocationEditor ? (
                <div className="dm-summary-box">
                  <strong>Allocated</strong>
                  <span>
                    {state.allocatedHealingTotal} / {state.healingTotal}
                  </span>
                </div>
              ) : null}

              {state.shouldShowHealingAllocationEditor ? (
                <div className="dm-healing-allocation-grid">
                  {state.resolvedTargetIds.map((targetId) => {
                    const targetLabel =
                      state.targetOptions.find(({ participant }) => participant.characterId === targetId)
                        ?.participant.displayName ?? targetId;

                    return (
                      <label key={targetId} className="dm-field">
                        <span>{targetLabel}</span>
                        <input
                          type="number"
                          min="0"
                          max={state.healingTotal ?? undefined}
                          value={state.healingAllocations[targetId] ?? "0"}
                          onChange={(event) =>
                            state.updateHealingAllocation(targetId, event.target.value)
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="dm-control-row">
            <button type="button" className="flow-primary" onClick={state.handleCast}>
              Cast Selected Power
            </button>
          </div>

          {state.castError ? <p className="dm-error">{state.castError}</p> : null}
        </>
      )}
    </div>
  );
}
