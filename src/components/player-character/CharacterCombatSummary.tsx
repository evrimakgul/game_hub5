import type { CharacterDerivedValues } from "../../config/characterRuntime";
import type { CharacterDraft } from "../../config/characterTemplate";

type RuntimeEditableField =
  | "currentHp"
  | "currentMana"
  | "inspiration"
  | "positiveKarma"
  | "negativeKarma";

type CharacterCombatSummaryProps = {
  sheetState: CharacterDraft;
  derived: CharacterDerivedValues;
  isDmRuntimeEditMode: boolean;
  onRuntimeInput: (field: RuntimeEditableField, value: string) => void;
};

export function CharacterCombatSummary({
  sheetState,
  derived,
  isDmRuntimeEditMode,
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
      {derived.activePowerEffects.length > 0 ? (
        <div className="active-effects-panel">
          <p className="section-kicker">Active Effects</p>
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
        </div>
      ) : null}
    </article>
  );
}
