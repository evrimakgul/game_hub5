import { getSkillBreakdown } from "../../config/characterRuntime";
import type { CharacterDraft } from "../../config/characterTemplate";
import { T1_SKILL_XP_BY_LEVEL } from "../../rules/xpTables";
import { getIncrementCost } from "../../lib/progressionCosts";

type CharacterSkillsSectionProps = {
  sheetState: CharacterDraft;
  isProgressionEditMode: boolean;
  adminOverrideMode: boolean;
  xpLeftOver: number;
  onAdjustSkill: (skillId: string, direction: 1 | -1) => void;
  onAdjustSkillOverride: (skillId: string, direction: 1 | -1) => void;
};

export function CharacterSkillsSection({
  sheetState,
  isProgressionEditMode,
  adminOverrideMode,
  xpLeftOver,
  onAdjustSkill,
  onAdjustSkillOverride,
}: CharacterSkillsSectionProps) {
  return (
    <article className="sheet-card skill-card">
      <p className="section-kicker">Roll Inputs</p>
      <h2>Skills</h2>
      <div className="skill-table">
        {sheetState.skills.map((skill) => {
          const breakdown = getSkillBreakdown(sheetState, skill.id);
          const incrementCost = getIncrementCost(T1_SKILL_XP_BY_LEVEL, skill.base);
          const canIncrease = adminOverrideMode
            ? skill.base < T1_SKILL_XP_BY_LEVEL.length - 1
            : isProgressionEditMode &&
              skill.base < T1_SKILL_XP_BY_LEVEL.length - 1 &&
              xpLeftOver >= incrementCost;
          const canDecrease = adminOverrideMode
            ? skill.base > 0
            : isProgressionEditMode && skill.base > 0;

          return (
            <div key={skill.id} className="skill-row">
              <div className="row-main">
                <strong>{skill.label}</strong>
                <small>{breakdown.detail}</small>
              </div>
              {isProgressionEditMode || adminOverrideMode ? (
                <div className="row-actions">
                  <button
                    type="button"
                    onClick={() =>
                      adminOverrideMode
                        ? onAdjustSkillOverride(skill.id, -1)
                        : onAdjustSkill(skill.id, -1)
                    }
                    disabled={!canDecrease}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      adminOverrideMode
                        ? onAdjustSkillOverride(skill.id, 1)
                        : onAdjustSkill(skill.id, 1)
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
    </article>
  );
}


