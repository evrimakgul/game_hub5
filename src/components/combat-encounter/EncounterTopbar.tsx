type EncounterTopbarProps = {
  currentRound: number;
  activeCombatantLabel: string | null;
  onAdvanceTurn: () => void;
  onOpenCombatDashboard: () => void;
  onOpenDmDashboard: () => void;
};

export function EncounterTopbar({
  currentRound,
  activeCombatantLabel,
  onAdvanceTurn,
  onOpenCombatDashboard,
  onOpenDmDashboard,
}: EncounterTopbarProps) {
  return (
    <header className="dm-topbar">
      <div>
        <p className="section-kicker">Dungeon Master</p>
        <h1>Combat Encounter</h1>
        <small>
          Round {currentRound}
          {activeCombatantLabel ? ` | Active: ${activeCombatantLabel}` : ""}
        </small>
      </div>
      <div className="dm-nav-actions">
        <button type="button" className="sheet-nav-button" onClick={onAdvanceTurn}>
          Advance Turn
        </button>
        <button type="button" className="sheet-nav-button" onClick={onOpenCombatDashboard}>
          Combat Dashboard
        </button>
        <button type="button" className="sheet-nav-button" onClick={onOpenDmDashboard}>
          DM Dashboard
        </button>
      </div>
    </header>
  );
}
