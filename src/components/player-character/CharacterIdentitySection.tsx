import type { CharacterDraft } from "../../config/characterTemplate";

type CharacterIdentitySectionProps = {
  sheetState: CharacterDraft;
  isSheetEditMode: boolean;
  onUpdateField: <K extends keyof CharacterDraft>(field: K, value: CharacterDraft[K]) => void;
};

export function CharacterIdentitySection({
  sheetState,
  isSheetEditMode,
  onUpdateField,
}: CharacterIdentitySectionProps) {
  return (
    <article className="sheet-card biography-card">
      <p className="section-kicker">Identity</p>
      <h2>Biography</h2>
      {isSheetEditMode ? (
        <div className="bio-edit-stack">
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
          <p>{sheetState.biographyPrimary || "No primary biography yet."}</p>
          <p>{sheetState.biographySecondary || "No secondary biography yet."}</p>
        </>
      )}
    </article>
  );
}
