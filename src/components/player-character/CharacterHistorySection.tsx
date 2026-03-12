import type { GameHistoryEntry } from "../../config/characterTemplate";

type CharacterHistorySectionProps = {
  sessionNotes: string;
  isReadOnlyView: boolean;
  gameHistory: GameHistoryEntry[];
  onSessionNotesChange: (value: string) => void;
  onAppendHistory: () => void;
};

function getHistoryEntryKey(entry: GameHistoryEntry): string {
  return entry.id;
}

export function CharacterHistorySection({
  sessionNotes,
  isReadOnlyView,
  gameHistory,
  onSessionNotesChange,
  onAppendHistory,
}: CharacterHistorySectionProps) {
  return (
    <>
      <article className="sheet-card notes-card">
        <p className="section-kicker">Sheet Notes</p>
        <h2>Session Notes</h2>
        <textarea
          className="notes-input"
          value={sessionNotes}
          onChange={(event) => onSessionNotesChange(event.target.value)}
          readOnly={isReadOnlyView}
        />
        {!isReadOnlyView ? (
          <button type="button" className="notes-submit" onClick={onAppendHistory}>
            Add To Game History
          </button>
        ) : null}
      </article>

      <article className="sheet-card history-card">
        <p className="section-kicker">Session Log</p>
        <h2>Game History</h2>
        {gameHistory.length === 0 ? (
          <p className="history-empty">No submitted game history yet.</p>
        ) : (
          <div className="history-list">
            {gameHistory.map((entry) => (
              <section key={getHistoryEntryKey(entry)} className="history-entry">
                <strong>
                  {entry.actualDateTime} / {entry.gameDateTime}
                </strong>
                {entry.type === "note" ? (
                  <p>{entry.note}</p>
                ) : (
                  <>
                    <p>
                      {entry.sourcePower}: {entry.targetName}
                    </p>
                    <p>{entry.summary}</p>
                  </>
                )}
              </section>
            ))}
          </div>
        )}
      </article>
    </>
  );
}
