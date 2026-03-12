import type { MouseEvent as ReactMouseEvent } from "react";
import { D10Icon } from "../shared/D10Icon";
import type { CharacterEncounterSnapshot } from "../../types/combatEncounter";
import type { EncounterParticipantView, EncounterRollTarget } from "../../types/combatEncounterView";

type CustomRollModifier = {
  id: number;
  value: number;
};

type RollResult = {
  labels: string[];
  poolSize: number;
  faces: number[];
  successes: number;
  isBotch: boolean;
};

const SUMMARY_DISPLAY_EXCLUDED_IDS = new Set(["hp", "mana", "ac", "dr", "soak"]);

type EncounterRollHelperProps = {
  isDiceOpen: boolean;
  dicePosition: { x: number; y: number };
  selectedCombatant: EncounterParticipantView | null;
  selectedSnapshot: CharacterEncounterSnapshot | null;
  encounterParticipants: EncounterParticipantView[];
  summaryRollTargets: EncounterRollTarget[];
  statRollTargets: EncounterRollTarget[];
  skillRollTargets: EncounterRollTarget[];
  selectedRollIds: string[];
  selectedRollTargets: EncounterRollTarget[];
  customRollInput: string;
  customRollModifiers: CustomRollModifier[];
  selectedRollPool: number;
  lastRoll: RollResult | null;
  onDiceMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onDiceClick: () => void;
  onSelectCombatant: (characterId: string) => void;
  onToggleRollTarget: (targetId: string) => void;
  onCustomRollInputChange: (value: string) => void;
  onAddCustomRollModifier: () => void;
  onRemoveCustomRollModifier: (modifierId: number) => void;
  onRoll: () => void;
  onClear: () => void;
};

export function EncounterRollHelper({
  isDiceOpen,
  dicePosition,
  selectedCombatant,
  selectedSnapshot,
  encounterParticipants,
  summaryRollTargets,
  statRollTargets,
  skillRollTargets,
  selectedRollIds,
  selectedRollTargets,
  customRollInput,
  customRollModifiers,
  selectedRollPool,
  lastRoll,
  onDiceMouseDown,
  onDiceClick,
  onSelectCombatant,
  onToggleRollTarget,
  onCustomRollInputChange,
  onAddCustomRollModifier,
  onRemoveCustomRollModifier,
  onRoll,
  onClear,
}: EncounterRollHelperProps) {
  return (
    <>
      <button
        type="button"
        className="floating-dice"
        style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y}px` }}
        onMouseDown={onDiceMouseDown}
        onClick={onDiceClick}
        aria-label="Open dice roller"
      >
        <D10Icon />
        <span className="sr-only">Open dice roller</span>
      </button>

      {isDiceOpen ? (
        <aside
          className="dice-popover"
          style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y + 72}px` }}
        >
          <div className="dice-popover-head">
            <D10Icon />
            <p className="section-kicker">10 Roll Helper</p>
          </div>
          <h2>Dice Roller</h2>

          <label className="dm-field dice-popover-field">
            <span>Combatant</span>
            <select
              value={selectedCombatant?.participant.characterId ?? ""}
              onChange={(event) => onSelectCombatant(event.target.value)}
            >
              {encounterParticipants.map(({ participant }, index) => (
                <option key={participant.characterId} value={participant.characterId}>
                  {index + 1}. {participant.displayName}
                </option>
              ))}
            </select>
          </label>

          {selectedCombatant && selectedSnapshot ? (
            <>
              <div className="dice-summary">
                <span>Initiative</span>
                <strong>
                  Pool {selectedCombatant.participant.initiativePool} | Roll{" "}
                  {selectedCombatant.participant.initiativeFaces.join(", ")} | Successes{" "}
                  {selectedCombatant.participant.initiativeSuccesses}
                </strong>
              </div>

              <div className="dm-summary-mini-grid dice-summary-grid">
                {selectedSnapshot.combatSummary
                  .filter((field) => !SUMMARY_DISPLAY_EXCLUDED_IDS.has(field.id))
                  .map((field) => (
                    <div key={field.id}>
                      <span>{field.label}</span>
                      <strong>{field.value}</strong>
                    </div>
                  ))}
                <div>
                  <span>Inspiration</span>
                  <strong>{selectedSnapshot.inspiration}</strong>
                  <small>{selectedSnapshot.inspirationDetail}</small>
                </div>
              </div>

              <div className="dice-summary">
                <span>Selected</span>
                <strong>
                  {selectedRollTargets.length > 0 || customRollModifiers.length > 0
                    ? [
                        ...selectedRollTargets.map((target) => target.label),
                        ...customRollModifiers.map(
                          (modifier) => `Custom ${modifier.value >= 0 ? "+" : ""}${modifier.value}`
                        ),
                      ].join(" + ")
                    : "None"}
                </strong>
              </div>
              <div className="dice-summary">
                <span>Pool</span>
                <strong>{selectedRollPool}</strong>
              </div>

              <section className="dice-summary-section">
                <h3>Combat Summary</h3>
                <div className="dice-summary-targets">
                  {summaryRollTargets.map((target) => {
                    const isSelected = selectedRollIds.includes(target.id);
                    const wouldExceedLimit = !isSelected && selectedRollIds.length >= 9;

                    return (
                      <button
                        key={target.id}
                        type="button"
                        className={`dice-target${isSelected ? " is-selected" : ""}`}
                        onClick={() => onToggleRollTarget(target.id)}
                        disabled={wouldExceedLimit}
                      >
                        <span>{target.label}</span>
                        <strong>{target.value}</strong>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="dice-columns">
                <section className="dice-column">
                  <h3>Stats</h3>
                  <div className="dice-targets">
                    {statRollTargets.map((target) => {
                      const isSelected = selectedRollIds.includes(target.id);
                      const wouldExceedLimit = !isSelected && selectedRollIds.length >= 9;

                      return (
                        <button
                          key={target.id}
                          type="button"
                          className={`dice-target${isSelected ? " is-selected" : ""}`}
                          onClick={() => onToggleRollTarget(target.id)}
                          disabled={wouldExceedLimit}
                        >
                          <span>{target.label}</span>
                          <strong>{target.value}</strong>
                        </button>
                      );
                    })}
                  </div>

                  <div className="dice-custom-add">
                    <span>Add</span>
                    <div className="dice-custom-row">
                      <input
                        type="number"
                        value={customRollInput}
                        onChange={(event) => onCustomRollInputChange(event.target.value)}
                        placeholder="+/-"
                      />
                      <button type="button" onClick={onAddCustomRollModifier}>
                        Add
                      </button>
                    </div>
                    {customRollModifiers.length > 0 ? (
                      <div className="dice-custom-list">
                        {customRollModifiers.map((modifier) => (
                          <button
                            key={modifier.id}
                            type="button"
                            className="dice-custom-chip"
                            onClick={() => onRemoveCustomRollModifier(modifier.id)}
                          >
                            {modifier.value >= 0 ? "+" : ""}
                            {modifier.value}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="dice-column">
                  <h3>Skills</h3>
                  <div className="dice-targets">
                    {skillRollTargets.map((target) => {
                      const isSelected = selectedRollIds.includes(target.id);
                      const wouldExceedLimit = !isSelected && selectedRollIds.length >= 9;

                      return (
                        <button
                          key={target.id}
                          type="button"
                          className={`dice-target${isSelected ? " is-selected" : ""}`}
                          onClick={() => onToggleRollTarget(target.id)}
                          disabled={wouldExceedLimit}
                        >
                          <span>{target.label}</span>
                          <strong>{target.value}</strong>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="dice-actions">
                <button
                  type="button"
                  onClick={onRoll}
                  disabled={selectedRollTargets.length === 0 && customRollModifiers.length === 0}
                >
                  Roll
                </button>
                <button type="button" onClick={onClear}>
                  Clear
                </button>
              </div>

              {lastRoll ? (
                <div className="roll-result">
                  <span>Last Roll</span>
                  <strong>
                    {lastRoll.successes} successes{lastRoll.isBotch ? " (botch)" : ""}
                  </strong>
                  <small>{lastRoll.labels.join(" + ")}</small>
                  <small>{lastRoll.faces.join(", ")}</small>
                </div>
              ) : null}
            </>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
