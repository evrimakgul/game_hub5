import type { EncounterActivityLogEntry } from "../../types/combatEncounter";

type EncounterActivityLogPanelProps = {
  activityLog: EncounterActivityLogEntry[];
};

function formatLogTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }

  return date.toLocaleTimeString();
}

export function EncounterActivityLogPanel({
  activityLog,
}: EncounterActivityLogPanelProps) {
  return (
    <article className="sheet-card dm-log-card">
      <p className="section-kicker">Encounter Activity</p>
      <h2>History</h2>
      {activityLog.length === 0 ? (
        <p className="dm-summary-line">No encounter actions have been recorded yet.</p>
      ) : (
        <div className="dm-log-list dm-encounter-activity-log">
          {activityLog.map((entry) => (
            <div key={entry.id} className="dm-log-row">
              <strong>{entry.summary}</strong>
              <small>{formatLogTime(entry.createdAt)}</small>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
