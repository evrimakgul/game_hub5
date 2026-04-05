import type { GameHistoryEntry } from "../../config/characterTemplate";
import type { KnowledgeState } from "../../types/knowledge.ts";
import { getKnowledgeEntityById, getKnowledgeRevisionById } from "../../lib/knowledge.ts";
import { KnowledgeCardView } from "./KnowledgeCardView.tsx";

type CharacterHistorySectionProps = {
  sessionNotes: string;
  isReadOnlyView: boolean;
  gameHistory: GameHistoryEntry[];
  knowledgeState: KnowledgeState;
  onSessionNotesChange: (value: string) => void;
  onAppendHistory: () => void;
  onOpenKnowledgeRevision: (revisionId: string) => void;
};

function getHistoryEntryKey(entry: GameHistoryEntry): string {
  return entry.id;
}

export function CharacterHistorySection({
  sessionNotes,
  isReadOnlyView,
  gameHistory,
  knowledgeState,
  onSessionNotesChange,
  onAppendHistory,
  onOpenKnowledgeRevision,
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
              <HistoryEntryRow
                key={getHistoryEntryKey(entry)}
                entry={entry}
                knowledgeState={knowledgeState}
                onOpenKnowledgeRevision={onOpenKnowledgeRevision}
              />
            ))}
          </div>
        )}
      </article>
    </>
  );
}

function HistoryEntryRow({
  entry,
  knowledgeState,
  onOpenKnowledgeRevision,
}: {
  entry: GameHistoryEntry;
  knowledgeState: KnowledgeState;
  onOpenKnowledgeRevision: (revisionId: string) => void;
}) {
  const knowledgeLink = entry.knowledgeLink ?? null;
  const knowledgeRevision = knowledgeLink
    ? getKnowledgeRevisionById(knowledgeState, knowledgeLink.knowledgeRevisionId)
    : null;
  const knowledgeEntity =
    knowledgeRevision !== null
      ? getKnowledgeEntityById(knowledgeState, knowledgeRevision.entityId)
      : null;

  return (
    <section className="history-entry">
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

      {knowledgeLink && knowledgeRevision && knowledgeEntity ? (
        <div className="history-knowledge-link-wrap">
          <button
            type="button"
            className="history-knowledge-link"
            onClick={() => onOpenKnowledgeRevision(knowledgeRevision.id)}
          >
            {knowledgeLink.knowledgeLabel}
          </button>
          <div className="history-knowledge-preview">
            <KnowledgeCardView entity={knowledgeEntity} revision={knowledgeRevision} mode="preview" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
