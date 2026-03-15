import {
  getStatBreakdown,
} from "../../config/characterRuntime";
import { statGroups, type CharacterDraft } from "../../config/characterTemplate";
import { STAT_XP_BY_LEVEL } from "../../rules/xpTables";
import { getIncrementCost } from "../../lib/progressionCosts";
import type { StatId } from "../../types/character";
import type { SharedItemRecord } from "../../types/items.ts";

type CharacterStatsSectionProps = {
  sheetState: CharacterDraft;
  itemsById: Record<string, SharedItemRecord>;
  isProgressionEditMode: boolean;
  adminOverrideMode: boolean;
  editSessionStatFloor: Record<StatId, number> | null;
  xpLeftOver: number;
  onAdjustStat: (statId: StatId, direction: 1 | -1) => void;
  onAdjustStatOverride: (statId: StatId, direction: 1 | -1) => void;
};

export function CharacterStatsSection({
  sheetState,
  itemsById,
  isProgressionEditMode,
  adminOverrideMode,
  editSessionStatFloor,
  xpLeftOver,
  onAdjustStat,
  onAdjustStatOverride,
}: CharacterStatsSectionProps) {
  return (
    <article className="sheet-card stat-card">
      <p className="section-kicker">Core Build</p>
      <h2>Stats</h2>
      <div className="stat-groups">
        {statGroups.map((group) => (
          <section key={group.title} className={`stat-group stat-group-${group.accent}`}>
            <header>
              <h3>{group.title}</h3>
            </header>
            <div className="stat-list">
              {group.ids.map((statId) => {
                const stat = sheetState.statState[statId];
                const breakdown = getStatBreakdown(sheetState, statId, itemsById);
                const incrementCost = getIncrementCost(STAT_XP_BY_LEVEL, stat.base);
                const canIncrease = adminOverrideMode
                  ? stat.base < STAT_XP_BY_LEVEL.length - 1
                  : isProgressionEditMode &&
                    stat.base < STAT_XP_BY_LEVEL.length - 1 &&
                    xpLeftOver >= incrementCost;
                const floorLevel = editSessionStatFloor?.[statId] ?? stat.base;
                const canDecrease = adminOverrideMode
                  ? stat.base > 0
                  : isProgressionEditMode && stat.base > floorLevel;

                return (
                  <div key={statId} className="stat-row">
                    <div className="row-main">
                      <strong>{statId}</strong>
                      <small>{breakdown.detail}</small>
                    </div>
                    {isProgressionEditMode || adminOverrideMode ? (
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() =>
                            adminOverrideMode
                              ? onAdjustStatOverride(statId, -1)
                              : onAdjustStat(statId, -1)
                          }
                          disabled={!canDecrease}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            adminOverrideMode
                              ? onAdjustStatOverride(statId, 1)
                              : onAdjustStat(statId, 1)
                          }
                          disabled={!canIncrease}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                    <div className="row-side">
                      <span>{breakdown.summary}</span>
                      <em>{breakdown.value}</em>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}


