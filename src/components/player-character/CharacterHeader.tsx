import type { CharacterDraft } from "../../config/characterTemplate";

type CharacterHeaderProps = {
  sheetState: CharacterDraft;
  actualDate: string;
  progression: { rank: string; cr: number };
  xpLeftOver: number;
  isSheetEditMode: boolean;
  isDmView: boolean;
  isDmEditableView: boolean;
  isDmReadOnlyView: boolean;
  isEditMode: boolean;
  dmEditMode: boolean;
  adminOverrideMode: boolean;
  dmEditReason: string;
  adminOverrideReason: string;
  adminOverrideError: string | null;
  onNavigateMainMenu: () => void;
  onNavigateBack: () => void;
  onUpdateField: <K extends keyof CharacterDraft>(field: K, value: CharacterDraft[K]) => void;
  onToggleEditMode: () => void;
  onToggleDmEditMode: () => void;
  onToggleAdminOverrideMode: () => void;
  onDmEditReasonChange: (value: string) => void;
  onAdminOverrideReasonChange: (value: string) => void;
};

export function CharacterHeader({
  sheetState,
  actualDate,
  progression,
  xpLeftOver,
  isSheetEditMode,
  isDmView,
  isDmEditableView,
  isDmReadOnlyView,
  isEditMode,
  dmEditMode,
  adminOverrideMode,
  dmEditReason,
  adminOverrideReason,
  adminOverrideError,
  onNavigateMainMenu,
  onNavigateBack,
  onUpdateField,
  onToggleEditMode,
  onToggleDmEditMode,
  onToggleAdminOverrideMode,
  onDmEditReasonChange,
  onAdminOverrideReasonChange,
}: CharacterHeaderProps) {
  return (
    <>
      <div className="sheet-top-nav">
        <button type="button" className="sheet-nav-button" onClick={onNavigateMainMenu}>
          Main Menu
        </button>
        <button type="button" className="sheet-nav-button" onClick={onNavigateBack}>
          {isDmEditableView ? "NPC Creator" : isDmReadOnlyView ? "Player Characters" : "Player Menu"}
        </button>
      </div>

      <header className="sheet-header">
        <div className="sheet-header-copy">
          <p className="sheet-kicker">Convergence Character Sheet Draft</p>
          {isSheetEditMode ? (
            <div className="identity-edit-stack">
              <input
                className="sheet-name-input"
                value={sheetState.name}
                onChange={(event) => onUpdateField("name", event.target.value)}
                placeholder="Character Name"
              />
              <div className="identity-edit-row">
                <input
                  className="sheet-meta-input"
                  value={sheetState.concept}
                  onChange={(event) => onUpdateField("concept", event.target.value)}
                  placeholder="Concept"
                />
                <input
                  className="sheet-meta-input"
                  value={sheetState.faction}
                  onChange={(event) => onUpdateField("faction", event.target.value)}
                  placeholder="Faction"
                />
              </div>
            </div>
          ) : (
            <>
              <h1>{sheetState.name.trim() || "Unnamed Character"}</h1>
              <p className="sheet-concept">
                {sheetState.concept || "No concept"} | {sheetState.faction || "No faction"}
              </p>
            </>
          )}
        </div>

        <div className="sheet-badges">
          <div>
            <span>Rank</span>
            <strong>{progression.rank}</strong>
          </div>
          <div>
            <span>CR</span>
            <strong>{progression.cr}</strong>
          </div>
          <div>
            <span>Age</span>
            {isSheetEditMode ? (
              <input
                className="badge-input"
                type="number"
                min="0"
                value={sheetState.age ?? ""}
                onChange={(event) =>
                  onUpdateField(
                    "age",
                    event.target.value === "" ? null : Number.parseInt(event.target.value, 10)
                  )
                }
                placeholder="Age"
              />
            ) : (
              <strong>{sheetState.age ?? "-"}</strong>
            )}
          </div>
        </div>
      </header>

      <section className="sheet-banner">
        <div className="banner-date-block">
          <div>
            <span>Actual Date</span>
            <strong>{actualDate}</strong>
          </div>
          <div>
            <span>Game Date-Time</span>
            <strong>{sheetState.gameDateTime}</strong>
          </div>
        </div>
        <div>
          <span>XP Block</span>
          <div className="xp-block-grid">
            <span>Earned</span>
            <span>Used</span>
            <span>Left-Over</span>
            <strong>{sheetState.xpEarned}</strong>
            <strong>{sheetState.xpUsed}</strong>
            <strong>{xpLeftOver}</strong>
          </div>
        </div>
        <div className="edit-card">
          <span>Edit Sheet</span>
          {isDmView ? (
            <div className="dm-edit-controls">
              <div className="dm-edit-toggle-row">
                <button type="button" onClick={onToggleDmEditMode}>
                  {dmEditMode ? "DM Edit: On" : "DM Edit: Off"}
                </button>
                <button type="button" onClick={onToggleAdminOverrideMode}>
                  {adminOverrideMode ? "Override: On" : "Override: Off"}
                </button>
              </div>
              <div className="dm-edit-reasons">
                {dmEditMode ? (
                  <input
                    className="sheet-meta-input"
                    value={dmEditReason}
                    onChange={(event) => onDmEditReasonChange(event.target.value)}
                    placeholder="DM reason (optional)"
                  />
                ) : null}
                {adminOverrideMode ? (
                  <>
                    <input
                      className="sheet-meta-input"
                      value={adminOverrideReason}
                      onChange={(event) => onAdminOverrideReasonChange(event.target.value)}
                      placeholder="Admin reason (required)"
                    />
                    {adminOverrideError ? (
                      <strong className="edit-mode-indicator">{adminOverrideError}</strong>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <button type="button" className="edit-trigger" onClick={onToggleEditMode}>
              {isEditMode ? "Lock" : "Edit"}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
