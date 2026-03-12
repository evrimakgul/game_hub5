import { getPowerBenefits } from "../../config/characterTemplate";
import type { CharacterDraft } from "../../config/characterTemplate";
import { T1_POWER_XP_BY_LEVEL } from "../../config/xpTables";
import { getIncrementCost } from "../../lib/progressionCosts";

type CharacterPowersSectionProps = {
  sheetState: CharacterDraft;
  availablePowerOptions: Array<{ id: string; name: string }>;
  pendingPowerId: string;
  xpLeftOver: number;
  isProgressionEditMode: boolean;
  adminOverrideMode: boolean;
  onPendingPowerIdChange: (value: string) => void;
  onAddPower: () => void;
  onAddPowerOverride: () => void;
  onAdjustPower: (powerId: string, direction: 1 | -1) => void;
  onAdjustPowerOverride: (powerId: string, direction: 1 | -1) => void;
};

export function CharacterPowersSection({
  sheetState,
  availablePowerOptions,
  pendingPowerId,
  xpLeftOver,
  isProgressionEditMode,
  adminOverrideMode,
  onPendingPowerIdChange,
  onAddPower,
  onAddPowerOverride,
  onAdjustPower,
  onAdjustPowerOverride,
}: CharacterPowersSectionProps) {
  return (
    <article className="sheet-card power-card">
      <p className="section-kicker">T1 Powers</p>
      <h2>Known Powers</h2>
      {isProgressionEditMode || adminOverrideMode ? (
        <div className="power-add-row">
          <select value={pendingPowerId} onChange={(event) => onPendingPowerIdChange(event.target.value)}>
            <option value="">Add Level 1 Power</option>
            {availablePowerOptions.map((power) => (
              <option key={power.id} value={power.id}>
                {power.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={adminOverrideMode ? onAddPowerOverride : onAddPower}
            disabled={
              !pendingPowerId ||
              (!adminOverrideMode && xpLeftOver < getIncrementCost(T1_POWER_XP_BY_LEVEL, 0))
            }
          >
            Add
          </button>
        </div>
      ) : null}
      <div className="power-list">
        {sheetState.powers.length === 0 ? (
          <p className="empty-block-copy">No powers learned yet.</p>
        ) : (
          sheetState.powers.map((power) => {
            const incrementCost = getIncrementCost(T1_POWER_XP_BY_LEVEL, power.level);
            const canIncrease = adminOverrideMode
              ? power.level < T1_POWER_XP_BY_LEVEL.length - 1
              : isProgressionEditMode &&
                power.level < T1_POWER_XP_BY_LEVEL.length - 1 &&
                xpLeftOver >= incrementCost;
            const canDecrease = adminOverrideMode
              ? power.level > 0
              : isProgressionEditMode && power.level > 0;

            return (
              <div key={power.id} className="power-row">
                <div className="row-main">
                  <strong>
                    {power.name} Lv {power.level}
                  </strong>
                  <ul className="power-benefits">
                    {getPowerBenefits(power.id, power.level).map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                </div>
                {isProgressionEditMode || adminOverrideMode ? (
                  <div className="row-actions">
                    <button
                      type="button"
                      onClick={() =>
                        adminOverrideMode
                          ? onAdjustPowerOverride(power.id, -1)
                          : onAdjustPower(power.id, -1)
                      }
                      disabled={!canDecrease}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adminOverrideMode
                          ? onAdjustPowerOverride(power.id, 1)
                          : onAdjustPower(power.id, 1)
                      }
                      disabled={!canIncrease}
                    >
                      +
                    </button>
                  </div>
                ) : null}
                <div className="row-side">
                  <span>Base {power.level}</span>
                  <em>{power.governingStat}</em>
                </div>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}
