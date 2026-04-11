import { Navigate, useNavigate } from "react-router-dom";

import { useAppFlow } from "../state/appFlow";

export function DmPage() {
  const navigate = useNavigate();
  const { roleChoice } = useAppFlow();

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>DM Dashboard</h1>
          </div>
          <div className="dm-nav-actions">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/role")}>
              Role Menu
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/")}>
              Main Menu
            </button>
          </div>
        </header>

        <section className="dm-hub-grid">
          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">Player Character Block</p>
            <h2>Player Characters</h2>
            <p className="dm-summary-line">
              Open player character sheets from the DM side.
            </p>
            <button
              type="button"
              className="flow-primary"
              onClick={() => navigate("/dm/characters")}
            >
              Open Player Characters
            </button>
          </article>

          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">NPC Creator Block</p>
            <h2>NPC Creator</h2>
            <p className="dm-summary-line">
              Open the DM-side character creation flow.
            </p>
            <button
              type="button"
              className="flow-secondary"
              onClick={() => navigate("/dm/npc-creator")}
            >
              Open NPC Creator
            </button>
          </article>

          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">Combat Dashboard</p>
            <h2>Combat Setup</h2>
            <p className="dm-summary-line">
              Manage combatants and start a combat encounter.
            </p>
            <button
              type="button"
              className="flow-primary"
              onClick={() => navigate("/dm/combat")}
            >
              Open Combat Dashboard
            </button>
          </article>

          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">Item Management</p>
            <h2>Item Management</h2>
            <p className="dm-summary-line">
              Browse item instances, edit them in detail, and manage blueprint classes.
            </p>
            <button
              type="button"
              className="flow-primary"
              onClick={() => navigate("/dm/items/edit")}
            >
              Item Editting
            </button>
            <button
              type="button"
              className="flow-secondary"
              onClick={() => navigate("/dm/items")}
            >
              Items List
            </button>
            <button
              type="button"
              className="flow-secondary"
              onClick={() => navigate("/dm/items/blueprints")}
            >
              Blueprint Management
            </button>
            <button
              type="button"
              className="flow-secondary"
              onClick={() => navigate("/dm/items/definitions")}
            >
              Definition Management
            </button>
          </article>
        </section>
      </section>
    </main>
  );
}
