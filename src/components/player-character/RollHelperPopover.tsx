import type { MouseEvent as ReactMouseEvent } from "react";

import { D10Icon } from "../shared/D10Icon";
import type { PlayerRollTarget } from "../../selectors/playerCharacterViewModel";

type RollResult = {
  labels: string[];
  poolSize: number;
  faces: number[];
  successes: number;
  isBotch: boolean;
};

type CustomRollModifier = {
  id: number;
  value: number;
};

type RollHelperPopoverProps = {
  isDiceOpen: boolean;
  dicePosition: { x: number; y: number };
  statRollTargets: PlayerRollTarget[];
  skillRollTargets: PlayerRollTarget[];
  selectedRollIds: string[];
  selectedRollTargets: PlayerRollTarget[];
  customRollInput: string;
  customRollModifiers: CustomRollModifier[];
  selectedRollPool: number;
  lastRoll: RollResult | null;
  onDiceMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onDiceClick: () => void;
  onToggleRollTarget: (targetId: string) => void;
  onCustomRollInputChange: (value: string) => void;
  onAddCustomRollModifier: () => void;
  onRemoveCustomRollModifier: (modifierId: number) => void;
  onRoll: () => void;
  onClear: () => void;
};

export function RollHelperPopover({
  isDiceOpen,
  dicePosition,
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
  onToggleRollTarget,
  onCustomRollInputChange,
  onAddCustomRollModifier,
  onRemoveCustomRollModifier,
  onRoll,
  onClear,
}: RollHelperPopoverProps) {
  return (
    <>
      <button
        type="button"
        className="floating-dice"
        style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y}px` }}
        onMouseDown={onDiceMouseDown}
        onClick={onDiceClick}
        aria-label="Open roll helper"
      >
        <D10Icon />
        <span className="sr-only">Open roll helper</span>
      </button>

      {isDiceOpen ? (
        <aside
          className="dice-popover"
          style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y + 72}px` }}
        >
          <div className="dice-popover-head">
            <D10Icon />
            <p className="section-kicker">Roll Helper</p>
          </div>
          <h2>Dice Pool</h2>
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
                    inputMode="numeric"
                    value={customRollInput}
                    onChange={(event) => onCustomRollInputChange(event.target.value)}
                    placeholder="+2"
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
        </aside>
      ) : null}
    </>
  );
}
