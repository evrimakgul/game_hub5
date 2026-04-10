import {
  DAMAGE_TYPES,
  RESISTANCE_LEVELS,
} from "../../rules/resistances";
import { getResolvedResistanceLevel } from "../../config/characterRuntime";
import type { CharacterDerivedValues } from "../../config/characterRuntime";
import type { CharacterDraft } from "../../config/characterTemplate";
import type { SharedItemRecord } from "../../types/items";
import type { PowerUsageResetScope, PowerUsageSummaryEntry } from "../../types/powerUsage";

type RuntimeEditableField =
  | "currentHp"
  | "currentMana"
  | "inspiration"
  | "positiveKarma"
  | "negativeKarma";

type CharacterCombatSummaryProps = {
  sheetState: CharacterDraft;
  derived: CharacterDerivedValues;
  itemsById: Record<string, SharedItemRecord>;
  isDmRuntimeEditMode: boolean;
  canManagePowerUsage: boolean;
  powerUsageSummary: PowerUsageSummaryEntry[];
  onResetPowerUsage: (scope: PowerUsageResetScope) => void;
  onRuntimeInput: (field: RuntimeEditableField, value: string) => void;
};

export function CharacterCombatSummary({
  sheetState,
  derived,
  itemsById,
  isDmRuntimeEditMode,
  canManagePowerUsage,
  powerUsageSummary,
  onResetPowerUsage,
  onRuntimeInput,
}: CharacterCombatSummaryProps) {
  return (
    <article className="sheet-card combat-card">
      <p className="section-kicker">Derived Summary</p>
      <h2>Combat Summary</h2>
      <div className="combat-grid">
        <div>
          <span>HP</span>
          {isDmRuntimeEditMode ? (
            <input
              className="sheet-runtime-input"
              type="number"
              value={sheetState.currentHp}
              onChange={(event) => onRuntimeInput("currentHp", event.target.value)}
            />
          ) : (
            <>
              <strong>
                {sheetState.currentHp} / {derived.maxHp}
              </strong>
              {derived.temporaryHp > 0 ? <small>Temp HP +{derived.temporaryHp}</small> : null}
            </>
          )}
        </div>
        <div>
          <span>Mana</span>
          {isDmRuntimeEditMode ? (
            <input
              className="sheet-runtime-input"
              type="number"
              min="0"
              max={derived.maxMana}
              value={derived.currentMana}
              onChange={(event) => onRuntimeInput("currentMana", event.target.value)}
            />
          ) : (
            <strong>
              {derived.currentMana} / {derived.maxMana}
            </strong>
          )}
        </div>
        <div>
          <span>Initiative</span>
          <strong>{derived.initiative}</strong>
        </div>
        <div>
          <span>Movement</span>
          <strong>{derived.movement}</strong>
        </div>
        <div>
          <span>AC</span>
          <strong>{derived.armorClass}</strong>
        </div>
        <div>
          <span>DR</span>
          <strong>{derived.damageReduction}</strong>
        </div>
        <div>
          <span>Soak</span>
          <strong>{derived.soak}</strong>
        </div>
        <div>
          <span>Melee Attack</span>
          <strong>{derived.meleeAttack}</strong>
        </div>
        <div>
          <span>Ranged Attack</span>
          <strong>{derived.rangedAttack}</strong>
        </div>
        <div>
          <span>Melee Damage</span>
          <strong>{derived.meleeDamage}</strong>
        </div>
        <div>
          <span>Ranged Damage</span>
          <strong>{derived.rangedDamage}</strong>
        </div>
      </div>
      <div className="derived-summary-subsections">
        <div className="active-effects-panel">
          <p className="section-kicker">Active Effects</p>
          {derived.activePowerEffects.length === 0 ? (
            <p className="empty-block-copy">No active effects on this sheet.</p>
          ) : (
            <div className="active-effects-list">
              {derived.activePowerEffects.map((effect) => (
                <article key={effect.id} className="active-effect-card">
                  <strong>{effect.label}</strong>
                  <small>{effect.summary}</small>
                  <small>
                    {effect.casterName} {"->"} {effect.powerName}
                  </small>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="active-effects-panel">
          <p className="section-kicker">Utility Traits</p>
          {derived.utilityTraits.length === 0 ? (
            <p className="empty-block-copy">No utility traits on this sheet.</p>
          ) : (
            <div className="active-effects-list">
              {derived.utilityTraits.map((trait) => (
                <article key={trait} className="active-effect-card">
                  <strong>{trait}</strong>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="active-effects-panel">
          <p className="section-kicker">Combat Flags</p>
          <div className="resistance-grid">
            {DAMAGE_TYPES.map((damageType) => {
              const level = getResolvedResistanceLevel(sheetState, damageType.id, itemsById);
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
        </div>

        <div className="active-effects-panel">
          <p className="section-kicker">Power Tracking</p>
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
              <button
                type="button"
                className="flow-secondary"
                onClick={() => onResetPowerUsage("daily")}
              >
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
        </div>
      </div>
    </article>
  );
}
