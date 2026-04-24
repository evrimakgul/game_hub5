import type { CharacterDraft } from "../../config/characterTemplate";

type CharacterIdentitySectionProps = {
  sheetState: CharacterDraft;
  isSheetEditMode: boolean;
  canEditApparelMode: boolean;
  onUpdateField: <K extends keyof CharacterDraft>(field: K, value: CharacterDraft[K]) => void;
};

export function CharacterIdentitySection({
  sheetState,
  isSheetEditMode,
  canEditApparelMode,
  onUpdateField,
}: CharacterIdentitySectionProps) {
  const apparelModeLabel =
    sheetState.apparelMode === "humanoid"
      ? "Humanoid (+3 Initiative when body slot is empty)"
      : "None";

  return (
    <article className="sheet-card biography-card">
      <p className="section-kicker">Identity</p>
      <h2>Biography</h2>
      {isSheetEditMode ? (
        <div className="bio-edit-stack">
          {canEditApparelMode ? (
            <label className="bio-edit-input">
              <span>Unarmored Baseline</span>
              <select
                className="sheet-meta-input"
                value={sheetState.apparelMode}
                onChange={(event) =>
                  onUpdateField("apparelMode", event.target.value as CharacterDraft["apparelMode"])
                }
              >
                <option value="humanoid">Humanoid (+3 Initiative when body slot is empty)</option>
                <option value="none">None</option>
              </select>
            </label>
          ) : null}
          <textarea
            className="bio-edit-input"
            value={sheetState.biographyPrimary}
            onChange={(event) => onUpdateField("biographyPrimary", event.target.value)}
            placeholder="Primary bio"
          />
          <textarea
            className="bio-edit-input"
            value={sheetState.biographySecondary}
            onChange={(event) => onUpdateField("biographySecondary", event.target.value)}
            placeholder="Secondary bio"
          />
        </div>
      ) : (
        <>
          <p>Unarmored Baseline: {apparelModeLabel}</p>
          <p>{sheetState.biographyPrimary || "No primary biography yet."}</p>
          <p>{sheetState.biographySecondary || "No secondary biography yet."}</p>
        </>
      )}
    </article>
  );
}
