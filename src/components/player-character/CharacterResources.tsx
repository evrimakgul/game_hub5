import type { CharacterDerivedValues } from "../../config/characterRuntime";
import type { CharacterDraft } from "../../config/characterTemplate";

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
  onRuntimeInput: (field: RuntimeEditableField, value: string) => void;
};

export function CharacterResources({
  sheetState,
  derived,
  isDmRuntimeEditMode,
  onRuntimeInput,
}: CharacterResourcesProps) {
  return (
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
                {derived.temporaryInspiration > 0 ? ` + Temp ${derived.temporaryInspiration}` : ""}
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
  );
}


