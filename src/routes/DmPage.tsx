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
            <p className="section-kicker">Live Table</p>
            <h2>DM Screen</h2>
            <p className="dm-summary-line">
              Manage live sessions, secret rolls, sharing, rewards, notes, and active table context.
            </p>
            <button
              type="button"
              className="flow-primary"
              onClick={() => navigate("/dm/screen")}
            >
              Open DM Screen
            </button>
          </article>

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
            <p className="section-kicker">Mob Library</p>
            <h2>Mob Templates</h2>
            <p className="dm-summary-line">
              Build character-like mob sheets, import Codex payloads, and publish reusable mob templates.
            </p>
            <button
              type="button"
              className="flow-primary"
              onClick={() => navigate("/dm/mobs")}
            >
              Open Mob Library
            </button>
          </article>

          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">Mob Groups</p>
            <h2>Mob Group Library</h2>
            <p className="dm-summary-line">
              Assemble saved mobs into reusable encounter packs and merge groups together.
            </p>
            <button
              type="button"
              className="flow-primary"
              onClick={() => navigate("/dm/mob-groups")}
            >
              Open Mob Groups
            </button>
          </article>

          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">Portal Workshop</p>
            <h2>Portal Templates</h2>
            <p className="dm-summary-line">
              Author staged portals, attach saved mob groups, and export stages into combat.
            </p>
            <button
              type="button"
              className="flow-primary"
              onClick={() => navigate("/dm/portals")}
            >
              Open Portal Workshop
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
            <p className="section-kicker">Auction House</p>
            <h2>Auction House</h2>
            <p className="dm-summary-line">
              Browse the seeded auction catalog, import pasted rows, and auto-create shared item drafts.
            </p>
            <button
              type="button"
              className="flow-primary"
              onClick={() => navigate("/dm/auction-house")}
            >
              Open Auction House
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
              onClick={() => navigate("/dm/auction-house")}
            >
              Auction House
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

          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">Item Interactions</p>
            <h2>Item Interactions</h2>
            <p className="dm-summary-line">
              Enable supplementary slots, generate item cards, and share them to selected characters.
            </p>
            <button
              type="button"
              className="flow-primary"
              onClick={() => navigate("/dm/items/interactions")}
            >
              Item Interactions
            </button>
          </article>

          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">Knowledge Hub</p>
            <h2>Knowledge Hub</h2>
            <p className="dm-summary-line">
              Author place, faction, story, and custom knowledge revisions, then grant them to selected characters.
            </p>
            <button
              type="button"
              className="flow-primary"
              onClick={() => navigate("/dm/knowledge")}
            >
              Open Knowledge Hub
            </button>
          </article>
        </section>
      </section>
    </main>
  );
}
