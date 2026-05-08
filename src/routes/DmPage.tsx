import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAppFlow } from "../state/appFlow";

type DashboardTab =
  | "overview"
  | "session"
  | "combat"
  | "characters"
  | "world"
  | "items"
  | "knowledge"
  | "notes";

type DashboardAction = {
  label: string;
  route: string;
  tone?: "primary" | "secondary";
  description: string;
};

const tabs: Array<{ id: DashboardTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "session", label: "Session" },
  { id: "combat", label: "Combat" },
  { id: "characters", label: "Characters" },
  { id: "world", label: "World" },
  { id: "items", label: "Items" },
  { id: "knowledge", label: "Knowledge" },
  { id: "notes", label: "Notes" },
];

export function DmPage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    characters,
    items,
    auctionEntries,
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
    mobTemplates,
    mobGroups,
    portalTemplates,
    activeCombatEncounter,
  } = useAppFlow();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  const playerCharacterCount = characters.filter(
    (character) => character.ownerRole === "player"
  ).length;
  const npcCount = characters.filter((character) => character.ownerRole === "dm").length;
  const combatantCount = activeCombatEncounter?.participants.length ?? 0;
  const activeRound = activeCombatEncounter?.turnState.round ?? null;
  const activeParticipant =
    activeCombatEncounter?.participants.find(
      (participant) =>
        participant.characterId === activeCombatEncounter.turnState.activeParticipantId
    ) ?? null;

  const actionGroups = {
    session: [
      {
        label: "DM Screen",
        route: "/dm/screen",
        tone: "primary",
        description: "Live session tools, secret rolls, sharing, rewards, and notes.",
      },
    ],
    characters: [
      {
        label: "Player Characters",
        route: "/dm/characters",
        tone: "primary",
        description: "Open player character sheets from the DM side.",
      },
      {
        label: "NPC Creator",
        route: "/dm/npc-creator",
        description: "Create DM-controlled characters and NPC sheets.",
      },
    ],
    combat: [
      {
        label: "Combat Setup",
        route: "/dm/combat",
        tone: "primary",
        description: "Manage combatants and start a combat encounter.",
      },
      {
        label: "Mob Templates",
        route: "/dm/mobs",
        description: "Build reusable character-like mob sheets.",
      },
      {
        label: "Mob Groups",
        route: "/dm/mob-groups",
        description: "Assemble saved mobs into encounter packs.",
      },
      {
        label: "Portal Templates",
        route: "/dm/portals",
        description: "Author staged portals and export stages into combat.",
      },
    ],
    world: [
      {
        label: "Portal Templates",
        route: "/dm/portals",
        tone: "primary",
        description: "Prepare staged portals and encounter flow.",
      },
      {
        label: "Auction House",
        route: "/dm/auction-house",
        description: "Prepare player-facing shop stock.",
      },
      {
        label: "Knowledge Hub",
        route: "/dm/knowledge",
        description: "Author places, factions, story records, and custom cards.",
      },
    ],
    items: [
      {
        label: "Item Editing",
        route: "/dm/items/edit",
        tone: "primary",
        description: "Create and edit item instances in detail.",
      },
      {
        label: "Items List",
        route: "/dm/items",
        description: "Browse item instances.",
      },
      {
        label: "Auction House",
        route: "/dm/auction-house",
        description: "Manage auction catalog and stock.",
      },
      {
        label: "Blueprint Management",
        route: "/dm/items/blueprints",
        description: "Manage item blueprint classes.",
      },
      {
        label: "Definition Management",
        route: "/dm/items/definitions",
        description: "Manage item categories and subcategories.",
      },
      {
        label: "Item Interactions",
        route: "/dm/items/interactions",
        description: "Share item cards and manage supplementary slot interactions.",
      },
    ],
    knowledge: [
      {
        label: "Knowledge Hub",
        route: "/dm/knowledge",
        tone: "primary",
        description: "Author and grant knowledge revisions.",
      },
      {
        label: "Item Interactions",
        route: "/dm/items/interactions",
        description: "Generate and share item-linked cards.",
      },
    ],
  } satisfies Record<string, DashboardAction[]>;

  const middlePanels = [
    {
      eyebrow: "Live Table",
      title: "DM Screen",
      count: activeCombatEncounter ? "Live" : "Ready",
      detail: "Secret rolls, sharing, rewards, notes",
      actions: actionGroups.session,
    },
    {
      eyebrow: "Cast",
      title: "Characters",
      count: `${playerCharacterCount} PC / ${npcCount} NPC`,
      detail: "Player sheets and NPC creation",
      actions: actionGroups.characters,
    },
    {
      eyebrow: "Encounter",
      title: "Combat",
      count: activeCombatEncounter ? `Round ${activeRound}` : `${mobTemplates.length} mobs`,
      detail: "Combat setup, mobs, groups, portals",
      actions: actionGroups.combat,
    },
    {
      eyebrow: "World",
      title: "World Assets",
      count: `${portalTemplates.length} portals`,
      detail: "Portals, auction stock, knowledge",
      actions: actionGroups.world,
    },
    {
      eyebrow: "Archive",
      title: "Items",
      count: `${items.length} items`,
      detail: "Editing, definitions, auction, interactions",
      actions: actionGroups.items,
    },
    {
      eyebrow: "Lore",
      title: "Knowledge",
      count: `${knowledgeEntities.length} entities`,
      detail: "Cards, ownerships, revisions",
      actions: actionGroups.knowledge,
    },
  ];

  const metricTiles = [
    { label: "Player Characters", value: playerCharacterCount.toString() },
    { label: "NPCs", value: npcCount.toString() },
    { label: "Mob Templates", value: mobTemplates.length.toString() },
    { label: "Mob Groups", value: mobGroups.length.toString() },
    { label: "Portal Templates", value: portalTemplates.length.toString() },
    { label: "Items", value: items.length.toString() },
    { label: "Auction Entries", value: auctionEntries.length.toString() },
    { label: "Knowledge Cards", value: knowledgeRevisions.length.toString() },
  ];

  const renderActions = (actions: DashboardAction[]) => (
    <div className="dm-command-action-list">
      {actions.map((action) => (
        <article key={`${action.route}-${action.label}`} className="dm-command-action-row">
          <div>
            <strong>{action.label}</strong>
            <span>{action.description}</span>
          </div>
          <button
            type="button"
            className={action.tone === "primary" ? "flow-primary" : "flow-secondary"}
            onClick={() => navigate(action.route)}
          >
            Open
          </button>
        </article>
      ))}
    </div>
  );

  const tabActions =
    activeTab === "session"
      ? actionGroups.session
      : activeTab === "combat"
        ? actionGroups.combat
        : activeTab === "characters"
          ? actionGroups.characters
          : activeTab === "world"
            ? actionGroups.world
            : activeTab === "items"
              ? actionGroups.items
              : activeTab === "knowledge"
                ? actionGroups.knowledge
                : null;

  return (
    <main className="dm-page dm-command-page">
      <section className="dm-shell dm-command-shell">
        <header className="dm-command-chrome">
          <div className="dm-command-brand">
            <strong>Portals</strong>
            <span>game_hub5</span>
          </div>
          <div className="dm-command-title">
            <span>Dungeon Master</span>
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

        <section className="dm-command-top-zone">
          <article className="dm-command-panel dm-command-session-panel">
            <p className="section-kicker">Campaign Command</p>
            <h2>Convergence Table</h2>
            <p>
              Local DM dashboard for live table operations, combat preparation, world assets,
              items, and knowledge management.
            </p>
            <div className="dm-command-status-grid">
              <div>
                <span>Active Combat</span>
                <strong>{activeCombatEncounter?.label ?? "None"}</strong>
              </div>
              <div>
                <span>Round</span>
                <strong>{activeRound ?? "-"}</strong>
              </div>
              <div>
                <span>Active Turn</span>
                <strong>{activeParticipant?.displayName ?? "-"}</strong>
              </div>
            </div>
          </article>

          <article className="dm-command-panel dm-command-combat-panel">
            <p className="section-kicker">Current Session</p>
            <h2>{activeCombatEncounter ? "Combat Online" : "Table Ready"}</h2>
            <div className="dm-command-combat-strip">
              <div>
                <span>Combatants</span>
                <strong>{combatantCount}</strong>
              </div>
              <div>
                <span>Parties</span>
                <strong>{activeCombatEncounter?.parties.length ?? 0}</strong>
              </div>
              <div>
                <span>Events</span>
                <strong>{activeCombatEncounter?.activityLog.length ?? 0}</strong>
              </div>
            </div>
            <button type="button" className="flow-primary" onClick={() => navigate("/dm/screen")}>
              Open DM Screen
            </button>
          </article>

          <article className="dm-command-panel dm-command-metrics-panel">
            <p className="section-kicker">Library Snapshot</p>
            <div className="dm-command-metric-grid">
              {metricTiles.map((tile) => (
                <div key={tile.label}>
                  <span>{tile.label}</span>
                  <strong>{tile.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="dm-command-mid-zone" aria-label="DM command groups">
          {middlePanels.map((panel) => (
            <article key={panel.title} className="dm-command-summary-card">
              <header>
                <span>{panel.eyebrow}</span>
                <strong>{panel.count}</strong>
              </header>
              <h2>{panel.title}</h2>
              <p>{panel.detail}</p>
              <div className="dm-command-button-row">
                {panel.actions.slice(0, 3).map((action) => (
                  <button
                    key={`${panel.title}-${action.label}`}
                    type="button"
                    className={action.tone === "primary" ? "flow-primary" : "flow-secondary"}
                    onClick={() => navigate(action.route)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="dm-command-workspace">
          <nav className="dm-command-tabs" aria-label="DM dashboard sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={tab.id === activeTab ? "is-active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="dm-command-detail-panel">
            {activeTab === "overview" ? (
              <div className="dm-command-detail-grid">
                <article className="dm-command-panel">
                  <p className="section-kicker">Immediate Actions</p>
                  <h2>Run The Table</h2>
                  {renderActions([
                    ...actionGroups.session,
                    actionGroups.combat[0],
                    actionGroups.characters[0],
                    actionGroups.items[0],
                    actionGroups.knowledge[0],
                  ])}
                </article>
                <article className="dm-command-panel">
                  <p className="section-kicker">Session Snapshot</p>
                  <h2>{activeCombatEncounter?.label ?? "No active combat"}</h2>
                  <div className="dm-command-notes-list">
                    <span>
                      {activeCombatEncounter
                        ? `${combatantCount} combatants are in initiative order.`
                        : "Start combat from Combat Setup when the table is ready."}
                    </span>
                    <span>{`${knowledgeOwnerships.length} knowledge grants are currently tracked.`}</span>
                    <span>{`${auctionEntries.length} auction entries are available for player shopping.`}</span>
                  </div>
                </article>
              </div>
            ) : activeTab === "notes" ? (
              <div className="dm-command-detail-grid">
                <article className="dm-command-panel">
                  <p className="section-kicker">Notes</p>
                  <h2>Use DM Screen For Session Notes</h2>
                  <p className="dm-command-muted">
                    This dashboard does not add a second note store. Session notes stay in the
                    live DM Screen so local and realtime table context do not split.
                  </p>
                  {renderActions(actionGroups.session)}
                </article>
                <article className="dm-command-panel">
                  <p className="section-kicker">Pinned Work</p>
                  <h2>Useful Shortcuts</h2>
                  {renderActions([actionGroups.combat[0], actionGroups.knowledge[0]])}
                </article>
              </div>
            ) : tabActions ? (
              <div className="dm-command-detail-grid">
                <article className="dm-command-panel dm-command-wide-panel">
                  <p className="section-kicker">{tabs.find((tab) => tab.id === activeTab)?.label}</p>
                  <h2>{tabs.find((tab) => tab.id === activeTab)?.label} Tools</h2>
                  {renderActions(tabActions)}
                </article>
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
