import {
  DAMAGE_TYPES,
  RESISTANCE_LEVELS,
} from "../../rules/resistances";
import type { CharacterDerivedValues } from "../../config/characterRuntime";
import type { CharacterDraft } from "../../config/characterTemplate";
import type { PowerUsageResetScope, PowerUsageSummaryEntry } from "../../types/powerUsage";

type RuntimeEditableField =
  | "currentHp"
  | "currentMana"
  | "inspiration"
  | "positiveKarma"
  | "negativeKarma";

type CharacterResourcesProps = {
  sheetState: CharacterDraft;
  derived: CharacterDerivedValues;
  isDmRuntimeEditMode: boolean;
  canManagePowerUsage: boolean;
  powerUsageSummary: PowerUsageSummaryEntry[];
  onResetPowerUsage: (scope: PowerUsageResetScope) => void;
  onRuntimeInput: (field: RuntimeEditableField, value: string) => void;
};

export function CharacterResources({
  sheetState,
  derived,
  isDmRuntimeEditMode,
  canManagePowerUsage,
  powerUsageSummary,
  onResetPowerUsage,
  onRuntimeInput,
}: CharacterResourcesProps) {
  return (
    <>
      <article className="sheet-card resource-card">
        <p className="section-kicker">Stored State</p>
        <h2>Resources</h2>
        <div className="resource-strip">
          <div>
            <span>Inspiration</span>
            {isDmRuntimeEditMode ? (
              <input
                className="sheet-runtime-input"
                type="number"
                min="0"
                value={sheetState.inspiration}
                onChange={(event) => onRuntimeInput("inspiration", event.target.value)}
              />
            ) : (
              <>
                <strong>{derived.totalInspiration}</strong>
                <small>
                  Base {derived.permanentInspiration}
                  {derived.temporaryInspiration > 0
                    ? ` + Temp ${derived.temporaryInspiration}`
                    : ""}
                </small>
              </>
            )}
          </div>
          <div>
            <span>Karma</span>
            {isDmRuntimeEditMode ? (
              <div className="runtime-split-inputs">
                <input
                  className="sheet-runtime-input"
                  type="number"
                  min="0"
                  value={sheetState.negativeKarma}
                  onChange={(event) => onRuntimeInput("negativeKarma", event.target.value)}
                />
                <input
                  className="sheet-runtime-input"
                  type="number"
                  min="0"
                  value={sheetState.positiveKarma}
                  onChange={(event) => onRuntimeInput("positiveKarma", event.target.value)}
                />
              </div>
            ) : (
              <strong>
                -{sheetState.negativeKarma} / +{sheetState.positiveKarma}
              </strong>
            )}
          </div>
        </div>
      </article>

      <article className="sheet-card status-card">
        <p className="section-kicker">Combat Flags</p>
        <h2>Resistances</h2>
        <div className="resistance-grid">
          {DAMAGE_TYPES.map((damageType) => {
            const level = sheetState.resistances[damageType.id];
            const rule = RESISTANCE_LEVELS[level];

            return (
              <div key={damageType.id} className="resistance-entry">
                <span>{damageType.label}</span>
                <strong>{rule.label}</strong>
                <small>(x{rule.damageMultiplier})</small>
              </div>
            );
          })}
        </div>
      </article>

      <article className="sheet-card status-card">
        <p className="section-kicker">Power Tracking</p>
        <h2>Usage Counters</h2>
        {powerUsageSummary.length === 0 ? (
          <p className="empty-block-copy">No reset-tracked power counters on this sheet yet.</p>
        ) : (
          <div className="resistance-grid">
            {powerUsageSummary.map((entry) => (
              <div key={entry.id} className="resistance-entry">
                <span>{entry.label}</span>
                <strong>{entry.resetLabel}</strong>
                <small>{entry.detail}</small>
              </div>
            ))}
          </div>
        )}
        {canManagePowerUsage ? (
          <div className="dm-control-row">
            <button type="button" className="flow-secondary" onClick={() => onResetPowerUsage("daily")}>
              Reset Daily Uses
            </button>
            <button
              type="button"
              className="flow-secondary"
              onClick={() => onResetPowerUsage("longRest")}
            >
              Reset Long Rest Uses
            </button>
          </div>
        ) : null}
      </article>
    </>
  );
}


